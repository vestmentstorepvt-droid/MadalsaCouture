import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v2 as cloudinary } from "cloudinary";

// Direct-to-storage uploads. Vercel functions accept at most 4.5 MB per
// request, so the browser uploads files straight to storage with a short-lived
// signature, then registers the file with the API.
//
//   Images -> Cloudinary (keeps automatic f_auto,q_auto optimisation)
//   Videos -> Cloudflare R2 when configured (free egress), else Cloudinary
// MEDIA_IMAGE_STORAGE / MEDIA_VIDEO_STORAGE ("cloudinary" | "r2") override this.

export type Provider = "cloudinary" | "r2";
export type ResourceType = "image" | "video" | "raw";

export function resourceTypeFor(mime = ""): ResourceType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "raw";
}

const cloudinaryReady = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
const r2Ready = () =>
  Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL,
  );

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

let r2: S3Client | null = null;
function r2Client() {
  r2 ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  return r2;
}

const r2PublicBase = () => process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");

export function providerFor(resourceType: ResourceType): Provider {
  const configured = (resourceType === "video" ? process.env.MEDIA_VIDEO_STORAGE : process.env.MEDIA_IMAGE_STORAGE)?.toLowerCase();
  if (configured === "r2" && r2Ready()) return "r2";
  if (configured === "cloudinary" && cloudinaryReady()) return "cloudinary";
  if (resourceType === "video" && r2Ready()) return "r2";
  if (cloudinaryReady()) return "cloudinary";
  if (r2Ready()) return "r2";
  throw Object.assign(new Error("No media storage is configured (Cloudinary or R2)."), { statusCode: 503, code: "STORAGE_DISABLED" });
}

const safeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80) || "file";

export type UploadTicket =
  | { provider: "cloudinary"; method: "POST"; uploadUrl: string; fields: Record<string, string>; resourceType: ResourceType }
  | { provider: "r2"; method: "PUT"; uploadUrl: string; headers: Record<string, string>; key: string; publicUrl: string; resourceType: ResourceType };

/** A short-lived permission for the browser to upload one file. */
// File formats customers may upload (reviews, profile photos). No SVG/HTML: those can carry scripts.
export const CUSTOMER_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif"];
export const CUSTOMER_VIDEO_FORMATS = ["mp4", "mov", "webm", "m4v"];
export const CUSTOMER_IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/i;
export const CUSTOMER_VIDEO_TYPES = /^video\/(mp4|quicktime|webm|x-m4v)$/i;

/**
 * A signed ticket for ONE upload.
 *  - size: R2 signs the exact Content-Length, so the URL can't be used for a bigger file.
 *  - allowedFormats: Cloudinary signs the format list, so the signature can't be reused for
 *    other kinds of files (e.g. HTML/raw files hosted on the shop's Cloudinary account).
 */
export async function createUploadTicket(opts: { fileName: string; contentType: string; folder: string; tags?: string[]; size?: number; allowedFormats?: string[] }): Promise<UploadTicket> {
  const resourceType = resourceTypeFor(opts.contentType);
  const provider = providerFor(resourceType);
  if (provider === "cloudinary") {
    const c = configureCloudinary();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const params: Record<string, string> = { folder: opts.folder, timestamp };
    if (opts.tags?.length) params.tags = opts.tags.join(",");
    if (opts.allowedFormats?.length) params.allowed_formats = opts.allowedFormats.join(",");
    const signature = c.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
    return {
      provider,
      method: "POST",
      resourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      fields: { ...params, api_key: process.env.CLOUDINARY_API_KEY!, signature },
    };
  }
  const key = `${opts.folder.replace(/^\/+|\/+$/g, "")}/${randomUUID()}-${safeName(opts.fileName)}`;
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: opts.contentType,
    ...(opts.size ? { ContentLength: opts.size } : {}),
  });
  const uploadUrl = await getSignedUrl(r2Client(), command, {
    expiresIn: 600,
    signableHeaders: new Set(opts.size ? ["content-type", "content-length"] : ["content-type"]),
  });
  return {
    provider,
    method: "PUT",
    resourceType,
    uploadUrl,
    headers: { "Content-Type": opts.contentType },
    key,
    publicUrl: `${r2PublicBase()}/${key}`,
  };
}

export type VerifiedFile = {
  /** Cloudinary public_id, or "r2:<key>" for R2 files. */
  publicId: string;
  url: string;
  format: string | null;
  resourceType: ResourceType;
  bytes: number | null;
  width: number | null;
  height: number | null;
};

const badRequest = (message: string, code = "VALIDATION_ERROR") => Object.assign(new Error(message), { statusCode: 400, code });

/**
 * Confirm an uploaded file really exists in our storage (never trust the
 * browser's word), and read its details from the storage provider.
 */
export async function verifyUpload(input: {
  provider: Provider;
  publicId?: string;
  key?: string;
  resourceType?: ResourceType;
  folder?: string;
  /** Reject (and delete) a file bigger than this. */
  maxBytes?: number;
}): Promise<VerifiedFile> {
  const file = await readUpload(input);
  if (input.maxBytes && file.bytes != null && file.bytes > input.maxBytes) {
    try {
      if (file.publicId.startsWith("r2:")) await deleteR2Object(file.publicId);
      else await configureCloudinary().uploader.destroy(file.publicId, { resource_type: file.resourceType });
    } catch {
      /* best effort */
    }
    throw Object.assign(new Error("File is too large."), { statusCode: 413, code: "FILE_TOO_LARGE" });
  }
  return file;
}

async function readUpload(input: { provider: Provider; publicId?: string; key?: string; resourceType?: ResourceType; folder?: string }): Promise<VerifiedFile> {
  const folder = input.folder?.replace(/^\/+|\/+$/g, "");
  if (input.provider === "cloudinary") {
    if (!input.publicId) throw badRequest("publicId is required.");
    if (folder && !input.publicId.startsWith(folder + "/")) throw badRequest("Uploaded file is not in the expected folder.");
    const c = configureCloudinary();
    let resource: any;
    try {
      resource = await c.api.resource(input.publicId, { resource_type: input.resourceType || "image" });
    } catch {
      throw badRequest("Uploaded file was not found in storage.", "UPLOAD_NOT_FOUND");
    }
    return {
      publicId: resource.public_id,
      url: resource.secure_url,
      format: resource.format || null,
      resourceType: (resource.resource_type || input.resourceType || "image") as ResourceType,
      bytes: resource.bytes ?? null,
      width: resource.width ?? null,
      height: resource.height ?? null,
    };
  }
  const key = input.key || "";
  if (!key || (folder && !key.startsWith(folder + "/"))) throw badRequest("Uploaded file is not in the expected folder.");
  let head: any;
  try {
    head = await r2Client().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
  } catch {
    throw badRequest("Uploaded file was not found in storage.", "UPLOAD_NOT_FOUND");
  }
  const ext = key.includes(".") ? key.split(".").pop()!.toLowerCase() : null;
  return {
    publicId: `r2:${key}`,
    url: `${r2PublicBase()}/${key}`,
    format: ext,
    resourceType: head.ContentType ? resourceTypeFor(head.ContentType) : input.resourceType || "raw",
    bytes: head.ContentLength ?? null,
    width: null,
    height: null,
  };
}

export async function deleteR2Object(publicId: string) {
  await r2Client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: publicId.replace(/^r2:/, "") }));
}
