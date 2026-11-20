import { z } from "zod";
import { Router } from "@/server/http/router";
import { sendError, sendSuccess } from "@/server/http/response";
import type { Next, Req, Res } from "@/server/http/types";
import { logger } from "@/server/lib/logger";
import { createUploadTicket, deleteR2Object, verifyUpload } from "@/server/lib/storage";
import cloudinary from "@/server/config/cloudinary";
import auth from "@/server/middleware/authMiddleware";
import { authLimiter } from "@/server/middleware/security";
import userRepository from "@/server/repositories/userRepository";

// Customer profile photo. Same direct-to-storage flow as review uploads:
//   POST   /api/v1/auth/avatar/upload-url -> signed ticket for one image (own folder per user)
//   PUT    /api/v1/auth/avatar            -> verify the upload and save it on the account
//   DELETE /api/v1/auth/avatar            -> remove the photo

const { authenticate } = auth as any;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const folderFor = (userId: string) => `madalsa/avatars/${userId}`;

const ticketSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive(),
});

const saveSchema = z.object({
  provider: z.enum(["cloudinary", "r2"]),
  publicId: z.string().max(300).optional(),
  key: z.string().max(300).optional(),
  resourceType: z.enum(["image", "video", "raw"]).optional(),
});

const userIdOf = (req: Req) => String((req as any).user?.id ?? "");

/** Best effort: a stale photo left in storage is not worth failing the request over. */
async function removeStored(publicId?: string | null) {
  if (!publicId) return;
  try {
    if (publicId.startsWith("r2:")) await deleteR2Object(publicId);
    else if (cloudinary) await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    logger.warn(`Could not delete old avatar ${publicId}: ${(err as Error).message}`);
  }
}

const router = new Router();

router.post("/upload-url", authLimiter, authenticate, async (req: Req, res: Res, next: Next) => {
  try {
    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, "VALIDATION_ERROR", "Validation failed.", 400);
    const body = parsed.data;
    if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/i.test(body.contentType)) {
      return sendError(res, "INVALID_FILE_TYPE", "Choose a JPG, PNG or WebP photo.", 415);
    }
    if (body.size > MAX_AVATAR_BYTES) return sendError(res, "FILE_TOO_LARGE", "Photo must be 5 MB or smaller.", 413);
    const folder = folderFor(userIdOf(req));
    const ticket = await createUploadTicket({ fileName: body.fileName, contentType: body.contentType, folder, tags: ["avatar"], size: body.size, allowedFormats: ["jpg", "jpeg", "png", "webp", "avif", "heic", "heif"] });
    return sendSuccess(res, { ...ticket, folder });
  } catch (err) {
    next(err);
  }
});

router.put("/", authLimiter, authenticate, async (req: Req, res: Res, next: Next) => {
  try {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, "VALIDATION_ERROR", "Validation failed.", 400);
    const userId = userIdOf(req);
    const file = await verifyUpload({ ...parsed.data, resourceType: "image", folder: folderFor(userId), maxBytes: MAX_AVATAR_BYTES });
    if (file.resourceType !== "image") return sendError(res, "INVALID_FILE_TYPE", "Only photos can be used.", 415);

    const user: any = await userRepository.findById(userId);
    if (!user) return sendError(res, "NOT_FOUND", "Account not found.", 404);
    const previous = user.avatarPublicId;
    await userRepository.updateById(userId, { avatar: file.url, avatarPublicId: file.publicId });
    if (previous && previous !== file.publicId) await removeStored(previous);
    return sendSuccess(res, { avatar: file.url });
  } catch (err) {
    next(err);
  }
});

router.delete("/", authLimiter, authenticate, async (req: Req, res: Res, next: Next) => {
  try {
    const userId = userIdOf(req);
    const user: any = await userRepository.findById(userId);
    if (!user) return sendError(res, "NOT_FOUND", "Account not found.", 404);
    await userRepository.updateById(userId, { avatar: null, avatarPublicId: null });
    await removeStored(user.avatarPublicId);
    return sendSuccess(res, { avatar: null });
  } catch (err) {
    next(err);
  }
});

export default router;
