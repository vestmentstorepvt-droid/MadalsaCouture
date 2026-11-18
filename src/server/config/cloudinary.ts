// Port of config/cloudinary.js: the configured Cloudinary client, or null when the
// CLOUDINARY_* variables are missing (callers then answer 503 CLOUDINARY_DISABLED).
import { v2 as cloudinary } from "cloudinary";
import logger from "@/server/config/logger";

let configured: typeof cloudinary | null = null;
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  logger.warn("Cloudinary integration disabled. Missing variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = cloudinary;
}

export default configured;
