// @ts-nocheck — ported from the Express backend (middleware/errorHandler.js); logic unchanged.
import __imp0 from "@/server/config/logger";
import __imp1 from "@/server/utils/response";

const logger = __imp0;
const { sendError } = __imp1;

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack || err.message || 'Unhandled error');

  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'FILE_TOO_LARGE', 'File is too large. Maximum allowed size is 20 MB.', 413);
    }
    return sendError(res, 'UPLOAD_ERROR', err.message || 'File upload error.', 400);
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
    return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, 'CONFLICT', `Duplicate value for ${field}.`, 409);
  }

  // Mongoose CastError (bad ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, 'NOT_FOUND', 'Resource not found.', 404);
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = statusCode >= 500 ? 'Something went wrong. Please try again later.' : err.message;
  return sendError(res, code, message, statusCode);
};

const __exports: any = errorHandler;

export default __exports;
