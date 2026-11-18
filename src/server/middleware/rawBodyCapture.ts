// The API entry point always keeps the raw body on req.rawBody (needed for webhook
// HMAC checks), so this middleware from the Express app is now a pass-through.
const rawBodyCapture = (_req: unknown, _res: unknown, next: () => void) => next();
export default rawBodyCapture;
