// @ts-nocheck — ported from the Express backend (middleware/notFound.js); logic unchanged.
import __imp0 from "@/server/utils/response";

const { sendError } = __imp0;

const notFoundHandler = (req, res) => {
  return sendError(res, 'NOT_FOUND', `Route ${req.method} ${req.url} not found.`, 404);
};

const __exports: any = notFoundHandler;

export default __exports;
