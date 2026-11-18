import { z } from "zod";
import { Router } from "@/server/http/router";
import { sendError, sendSuccess } from "@/server/http/response";
import type { Next, Req, Res } from "@/server/http/types";
import { logger } from "@/server/lib/logger";
import { createUploadTicket, verifyUpload } from "@/server/lib/storage";
import auth from "@/server/middleware/authMiddleware";
import auditMiddleware from "@/server/middleware/auditMiddleware";
import { authLimiter } from "@/server/middleware/security";
import mediaRepository from "@/server/repositories/mediaRepository";

// New endpoints for direct-to-storage uploads (Vercel's 4.5 MB body limit).
//   POST /api/v1/admin/media/upload-url  -> signed ticket for one file (admin)
//   POST /api/v1/admin/media/register    -> verify the uploaded file and add it to the media library;
//                                           responds exactly like the old POST /api/v1/admin/media
//   POST /api/v1/uploads/review-url      -> ticket for review photos/videos (anyone, rate limited)

const { authenticate, authorize, optionalAuthenticate } = auth as any;

const MAX_ADMIN_BYTES = 100 * 1024 * 1024; // same cap as the old multer limit
const MAX_REVIEW_BYTES = 25 * 1024 * 1024; // same cap as the old review upload
export const REVIEW_FOLDER = "madalsa/reviews";

const ticketSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive(),
  folder: z.string().max(200).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
});

const registerSchema = z.object({
  provider: z.enum(["cloudinary", "r2"]),
  publicId: z.string().optional(),
  key: z.string().optional(),
  resourceType: z.enum(["image", "video", "raw"]).optional(),
  folder: z.string().max(200).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
});

const normaliseTags = (value: unknown): string[] =>
  !value
    ? []
    : (Array.isArray(value) ? value : String(value).split(","))
        .map((t) => String(t).trim())
        .filter(Boolean);

function parse<T>(schema: z.ZodType<T>, req: Req, res: Res): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    sendError(
      res,
      "VALIDATION_ERROR",
      "Validation failed.",
      400,
      result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    );
    return null;
  }
  return result.data;
}

const adminRouter = new Router();

adminRouter.post("/upload-url", authenticate, authorize("ADMIN"), async (req: Req, res: Res, next: Next) => {
  try {
    const body = parse(ticketSchema, req, res);
    if (!body) return;
    const folder = body.folder || "Madalsa";
    if (body.size > MAX_ADMIN_BYTES) return sendError(res, "FILE_TOO_LARGE", "File is too large. Maximum allowed size is 100 MB.", 413);
    if (folder === "Madalsa/homepage-video-cards") {
      if (!body.contentType.startsWith("video/") && !body.contentType.startsWith("image/")) {
        return sendError(res, "INVALID_FILE_TYPE", "Only video or image files are accepted for homepage video cards.", 415);
      }
      if (body.contentType.startsWith("video/") && body.size > 20 * 1024 * 1024) {
        return sendError(res, "FILE_TOO_LARGE", "Homepage video cards must be 20 MB or smaller.", 413);
      }
    }
    const ticket = await createUploadTicket({
      fileName: body.fileName,
      contentType: body.contentType,
      folder,
      tags: normaliseTags(body.tags),
    });
    return sendSuccess(res, { ...ticket, folder });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/register", authenticate, authorize("ADMIN"), auditMiddleware, async (req: Req, res: Res, next: Next) => {
  try {
    const body = parse(registerSchema, req, res);
    if (!body) return;
    const folder = body.folder || "Madalsa";
    const file = await verifyUpload({ provider: body.provider, publicId: body.publicId, key: body.key, resourceType: body.resourceType, folder });
    const existing = await mediaRepository.findByPublicId(file.publicId);
    if (!existing) {
      await mediaRepository.create({
        cloudinaryPublicId: file.publicId,
        url: file.url,
        format: file.format,
        resourceType: file.resourceType,
        folder,
        tags: normaliseTags(body.tags),
        bytes: file.bytes,
        width: file.width,
        height: file.height,
        uploadedBy: req.user?.id || null,
      });
      logger.info(`Media uploaded: ${file.publicId} by actor ${req.user?.id}`);
    }
    return sendSuccess(res, { url: file.url, publicId: file.publicId }, 201);
  } catch (err) {
    next(err);
  }
});

const publicRouter = new Router();

publicRouter.post("/review-url", authLimiter, optionalAuthenticate, async (req: Req, res: Res, next: Next) => {
  try {
    const body = parse(ticketSchema, req, res);
    if (!body) return;
    if (!body.contentType.startsWith("image/") && !body.contentType.startsWith("video/")) {
      return sendError(res, "VALIDATION_ERROR", "Only image and video files are allowed.", 400);
    }
    if (body.size > MAX_REVIEW_BYTES) return sendError(res, "FILE_TOO_LARGE", "File is too large. Maximum allowed size is 25 MB.", 413);
    const ticket = await createUploadTicket({ fileName: body.fileName, contentType: body.contentType, folder: REVIEW_FOLDER, tags: ["review"] });
    return sendSuccess(res, { ...ticket, folder: REVIEW_FOLDER });
  } catch (err) {
    next(err);
  }
});

const mediaUploadRoutes = { adminRouter, publicRouter };
export default mediaUploadRoutes;
