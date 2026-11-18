import type { Res } from "./types";

// Same JSON envelopes as the Express backend: `{ data, meta? }` and `{ error: { code, message, details } }`.

export const sendSuccess = (res: Res, data: unknown = {}, statusCode = 200, meta: Record<string, unknown> = {}) => {
  const body: Record<string, unknown> = { data };
  if (meta && Object.keys(meta).length > 0) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const sendError = (res: Res, code: string, message: string, statusCode = 500, details: unknown[] = []) =>
  res.status(statusCode).json({ error: { code, message, details } });

export const sendValidationError = (res: Res, message: string, details: unknown[] = []) =>
  sendError(res, "VALIDATION_ERROR", message, 400, details);
