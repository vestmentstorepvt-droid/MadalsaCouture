// @ts-nocheck — ported from the Express backend (controllers/mediaController.js); logic unchanged.
import __imp0 from "@/server/services/mediaService";
import __imp1 from "@/server/validators/mediaValidator";
import __imp2 from "@/server/utils/response";

const mediaService = __imp0;
const { listMediaSchema } = __imp1;
const { sendSuccess, sendError } = __imp2;

/**
 * Helper — split a comma-separated tag string into a trimmed string array.
 * If the value is already an array it is returned as-is (after trimming each
 * element).  Falsy values return an empty array.
 *
 * @param {string|string[]|undefined} value
 * @returns {string[]}
 */
function normaliseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((t) => t.trim()).filter(Boolean);
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

class MediaController {
  /**
   * POST /api/v1/admin/media/upload
   *
   * Expects a multipart/form-data request processed by multer (memoryStorage).
   * The uploaded file is available at req.file (Buffer mode).
   *
   * Body fields:
   *   folder  {string}          — target Cloudinary folder (optional)
   *   tags    {string|string[]} — comma-separated or repeated tag values (optional)
   *
   * Responds with 201 and the asset's public URL + Cloudinary public ID.
   */
  async uploadMedia(req, res, next) {
    try {
      // Multer attaches the file to req.file when using single() or similar
      if (!req.file) {
        return sendError(res, 'VALIDATION_ERROR', 'No file was uploaded.', 400);
      }

      const folder = req.body.folder || "Madalsa";
      const mime = req.file.mimetype || '';

      // Homepage video cards only accept video or image MIME types
      if (folder === 'Madalsa/homepage-video-cards') {
        if (!mime.startsWith('video/') && !mime.startsWith('image/')) {
          return sendError(res, 'INVALID_FILE_TYPE', 'Only video or image files are accepted for homepage video cards.', 415);
        }
        if (mime.startsWith('video/') && req.file.size > 20 * 1024 * 1024) {
          return sendError(res, 'FILE_TOO_LARGE', 'Homepage video cards must be 20 MB or smaller.', 413);
        }
      }
      const tags = normaliseTags(req.body.tags);

      const { url, publicId } = await mediaService.uploadMedia(
        req.file,
        folder,
        tags,
        req.user.id
      );

      return sendSuccess(res, { url, publicId }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/media
   *
   * Returns a paginated list of media assets with optional filtering.
   *
   * Query params (all optional):
   *   folder        {string}             — Cloudinary folder
   *   tags          {string|string[]}    — comma-separated or repeated tags
   *   resourceType  {'image'|'video'|'raw'}
   *   search        {string}             — free-text search
   *   page          {number}             — 1-based page (default 1)
   *   limit         {number}             — items per page (default 20, max 100)
   */
  async listMedia(req, res, next) {
    try {
      // Validate and coerce query params
      const parseResult = listMediaSchema.safeParse(req.query);
      if (!parseResult.success) {
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
      }

      const { page, limit, tags: rawTags, ...rest } = parseResult.data;

      // Normalise tags: if still a string after schema parsing, split it
      const tags = rawTags ? normaliseTags(rawTags) : undefined;

      const filters = { ...rest };
      if (tags && tags.length > 0) filters.tags = tags;

      const result = await mediaService.listMedia(filters, page, limit);

      return sendSuccess(res, { media: result.data }, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/media/:publicId(*)
   *
   * Deletes a Cloudinary asset and its database record.
   *
   * The Cloudinary public ID can contain forward-slashes (e.g. "folder/file"),
   * so the route should use a wildcard parameter and the raw value arrives as
   * req.params[0] or req.params.publicId depending on how the route is defined.
   * This handler reads from req.params.publicId and falls back to req.params[0],
   * then URL-decodes the result to support percent-encoded slashes.
   *
   * Errors:
   *   404 — asset not found in the database.
   *   409 — asset is still referenced by other documents; includes reference list.
   */
  async deleteMedia(req, res, next) {
    try {
      // Express 5 wildcard captures segments as an array; join them back into a path.
      // Express 4 captures as a plain string in req.params[0].
      let rawId = req.params.publicId ?? req.params[0];
      if (Array.isArray(rawId)) {
        rawId = rawId.join('/');
      }

      if (!rawId || String(rawId).trim() === '') {
        return sendError(res, 'VALIDATION_ERROR', 'publicId is required.', 400);
      }

      const publicId = decodeURIComponent(String(rawId));

      const deleted = await mediaService.deleteMedia(publicId, req.user.id);

      return sendSuccess(res, { media: deleted });
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, 'NOT_FOUND', error.message, 404);
      }
      if (error.statusCode === 409 || error.code === 'CONFLICT') {
        return sendError(res, 'CONFLICT', error.message, 409, error.references || []);
      }
      if (error.statusCode === 502) {
        return sendError(res, 'UPSTREAM_ERROR', error.message, 502);
      }
      next(error);
    }
  }
}

const __exports: any = new MediaController();

export default __exports;
