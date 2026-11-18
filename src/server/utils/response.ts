// @ts-nocheck — ported from the Express backend (utils/response.js); logic unchanged.


/**
 * Send a success response.
 * @param {object} res - Express response object
 * @param {object|array} data - Response payload
 * @param {number} [statusCode=200]
 * @param {object} [meta] - Optional meta (e.g. pagination)
 */
const sendSuccess = (res, data = {}, statusCode = 200, meta = {}) => {
  const body = { data };
  if (meta && Object.keys(meta).length > 0) {
    body.meta = meta;
  }
  return res.status(statusCode).json(body);
};

/**
 * Send an error response.
 * @param {object} res - Express response object
 * @param {string} code - SNAKE_CASE error code
 * @param {string} message - Human-readable message
 * @param {number} [statusCode=500]
 * @param {array} [details=[]] - Field-level details for validation errors
 */
const sendError = (res, code, message, statusCode = 500, details = []) => {
  return res.status(statusCode).json({
    error: { code, message, details }
  });
};

/**
 * Send a validation error response.
 * @param {object} res - Express response object
 * @param {string} message - Human-readable message
 * @param {array} [details=[]] - Field-level details
 */
const sendValidationError = (res, message, details = []) => {
  return sendError(res, 'VALIDATION_ERROR', message, 400, details);
};

const __exports: any = { sendSuccess, sendError, sendValidationError };

export default __exports;
