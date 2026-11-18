// @ts-nocheck — ported from the Express backend (services/mediaService.js); logic unchanged.
import { deleteR2Object } from "@/server/lib/storage";
import * as __imp0 from "node:stream";
import __imp1 from "@/server/config/cloudinary";
import __imp2 from "@/server/repositories/mediaRepository";
import __imp3 from "@/server/constants/messages";
import __imp4 from "@/server/config/logger";

const { Readable } = __imp0;
const cloudinary = __imp1;
const mediaRepository = __imp2;
const { ERROR } = __imp3;
const logger = __imp4;

/**
 * Determine the Cloudinary resource_type from a MIME type string.
 *
 * @param {string} mimetype - MIME type of the file (e.g. 'image/jpeg').
 * @returns {'image'|'video'|'raw'}
 */
function resolveResourceType(mimetype = '') {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw';
}

/**
 * Upload a Buffer to Cloudinary via upload_stream, wrapped in a Promise.
 *
 * @param {Buffer} buffer        - File data.
 * @param {Object} uploadOptions - Options forwarded to upload_stream (folder, tags, resource_type, …).
 * @returns {Promise<Object>} Cloudinary upload result.
 */
function uploadBufferToCloudinary(buffer, uploadOptions) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { timeout: 120000, ...uploadOptions },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    // Convert the buffer to a readable stream and pipe it into the upload stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null); // signal end-of-stream
    readable.pipe(stream);
  });
}

class MediaService {
  /**
   * Upload a file to Cloudinary and persist a MediaAsset record.
   *
   * @param {Object}          file     - Multer file object (`buffer`, `mimetype`).
   * @param {string}          folder   - Target Cloudinary folder.
   * @param {string[]}        tags     - Tags to attach to the Cloudinary asset.
   * @param {string|ObjectId} actorId  - ObjectId of the user performing the upload.
   * @returns {Promise<{ url: string, publicId: string }>}
   */
  async uploadMedia(file, folder, tags, actorId) {
    if (!cloudinary) throw Object.assign(new Error('Cloudinary is not configured'), { statusCode: 503, code: 'CLOUDINARY_DISABLED' });
    const resourceType = resolveResourceType(file.mimetype);

    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadBufferToCloudinary(file.buffer, {
        folder,
        tags,
        resource_type: resourceType
      });
    } catch (err) {
      logger.error('Cloudinary upload error:', err);
      const isTimeout = err?.message?.includes('Timeout') || err?.http_code === 499;
      const msg = isTimeout
        ? 'Media upload timed out connecting to Cloudinary. Please try a smaller image file or check network connection.'
        : (err?.message || ERROR.MEDIA_UPLOAD_FAILED);
      throw Object.assign(new Error(msg), { statusCode: 502, code: 'CLOUDINARY_UPLOAD_ERROR' });
    }


    const {
      public_id: cloudinaryPublicId,
      secure_url: url,
      format,
      bytes,
      width,
      height
    } = cloudinaryResult;

    await mediaRepository.create({
      cloudinaryPublicId,
      url,
      format: format || null,
      resourceType,
      folder: folder || '',
      tags: tags || [],
      bytes: bytes || null,
      width: width || null,
      height: height || null,
      uploadedBy: actorId || null
    });

    logger.info(`Media uploaded: ${cloudinaryPublicId} by actor ${actorId}`);

    return { url, publicId: cloudinaryPublicId };
  }

  /**
   * Delete a media asset from Cloudinary and soft-delete the MediaAsset record.
   *
   * If any active references to the asset exist (in products, variants, or CMS
   * collections), the deletion is rejected with a 409 CONFLICT.
   *
   * @param {string}          cloudinaryPublicId - Cloudinary public ID of the asset.
   * @param {string|ObjectId} actorId            - ObjectId of the user performing the deletion.
   * @returns {Promise<Object>} The soft-deleted MediaAsset document.
   */
  async deleteMedia(cloudinaryPublicId, actorId) {
    // 1 — Ensure the asset record exists (try publicId first, then _id fallback)
    let asset = await mediaRepository.findByPublicId(cloudinaryPublicId);
    if (!asset) {
      // Frontend may send the MongoDB _id instead of the Cloudinary publicId
      asset = await mediaRepository.findById(cloudinaryPublicId);
    }
    if (!asset) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    // Use the real Cloudinary public ID from the document for the destroy call
    const realPublicId = asset.cloudinaryPublicId;

    // 2 — Check for active references across all collections
    // Pass asset.url (Cloudinary delivery URL) — images are stored as URLs, not public IDs
    const references = await mediaRepository.findReferences(asset.url);
    if (references.length > 0) {
      const err = new Error(ERROR.CONFLICT);
      err.statusCode = 409;
      err.code = 'CONFLICT';
      err.references = references;
      throw err;
    }

    // 3 — Remove from storage (R2 files are stored with an "r2:" public id)
    if (String(realPublicId).startsWith('r2:')) {
      try {
        await deleteR2Object(realPublicId);
      } catch (err) {
        logger.error(`R2 delete error for ${realPublicId}:`, err);
        const r2Err = new Error('Failed to remove asset from storage. Please try again.');
        r2Err.statusCode = 502;
        throw r2Err;
      }
    } else if (!cloudinary) {
      logger.warn(`Cloudinary not configured — skipping remote destroy for ${realPublicId}`);
    } else {
      try {
        await cloudinary.uploader.destroy(realPublicId, {
          resource_type: asset.resourceType || 'image'
        });
      } catch (err) {
        logger.error(`Cloudinary destroy error for ${realPublicId}:`, err);
        const cloudErr = new Error('Failed to remove asset from Cloudinary. Please try again.');
        cloudErr.statusCode = 502;
        throw cloudErr;
      }
    }

    // 4 — Soft-delete the database record
    const deleted = await mediaRepository.softDelete(asset._id);

    logger.info(`Media deleted: ${realPublicId} by actor ${actorId}`);

    return deleted;
  }

  /**
   * Paginated list of media assets with optional filtering.
   *
   * Supported filter keys (delegated to the repository):
   *   folder, tags, resourceType, search
   *
   * @param {Object} filters       - Filter criteria.
   * @param {number} [page=1]      - 1-based page number.
   * @param {number} [limit=20]    - Items per page.
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async listMedia(filters = {}, page = 1, limit = 20) {
    return mediaRepository.findAll(filters, page, limit);
  }
}

const __exports: any = new MediaService();

export default __exports;
