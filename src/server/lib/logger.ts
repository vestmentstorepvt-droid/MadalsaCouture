// Console logger with the same levels the Express app used (winston). On Vercel these
// lines appear in the function logs.
const level = (process.env.LOG_LEVEL || "info").toLowerCase();
const order = ["error", "warn", "info", "debug"];
const enabled = (l: string) => order.indexOf(l) <= order.indexOf(level);
const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);

export const logger = {
  error: (msg: unknown) => enabled("error") && console.error(`[${stamp()}] ERROR: ${msg}`),
  warn: (msg: unknown) => enabled("warn") && console.warn(`[${stamp()}] WARN: ${msg}`),
  info: (msg: unknown) => enabled("info") && console.log(`[${stamp()}] INFO: ${msg}`),
  debug: (msg: unknown) => enabled("debug") && console.log(`[${stamp()}] DEBUG: ${msg}`),
};
export default logger;
