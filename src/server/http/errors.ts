import { logger } from "../lib/logger";
import { sendError } from "./response";
import type { Next, Req, Res } from "./types";

/** Service error with an HTTP status and a SNAKE_CASE code (same shape as the Express services). */
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown[];
  constructor(message: string, statusCode = 400, code = "REQUEST_ERROR", details?: unknown[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function createError(message: string, statusCode: number, code?: string) {
  return Object.assign(new Error(message), { statusCode, code: code || "REQUEST_ERROR" });
}

/** Port of middleware/errorHandler.js. */
export function errorHandler(err: any, _req: Req, res: Res, _next: Next) {
  logger.error(err?.stack || err?.message || "Unhandled error");

  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") return sendError(res, "FILE_TOO_LARGE", "File is too large. Maximum allowed size is 20 MB.", 413);
    return sendError(res, "UPLOAD_ERROR", err.message || "File upload error.", 400);
  }
  if (err?.name === "ValidationError" && err.errors) {
    const details = Object.values(err.errors).map((e: any) => ({ field: e.path, message: e.message }));
    return sendError(res, "VALIDATION_ERROR", "Validation failed.", 400, details);
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return sendError(res, "CONFLICT", `Duplicate value for ${field}.`, 409);
  }
  if (err?.name === "CastError") return sendError(res, "NOT_FOUND", "Resource not found.", 404);

  const statusCode = err?.statusCode || 500;
  const code = (typeof err?.code === "string" && err.code) || (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
  const message = statusCode >= 500 ? "Something went wrong. Please try again later." : err.message;
  return sendError(res, code, message, statusCode);
}

export function notFoundHandler(req: Req, res: Res) {
  return sendError(res, "NOT_FOUND", `Route ${req.method} ${req.url} not found.`, 404);
}
