// Escape a value before putting it inside email HTML, so text typed by a visitor
// (names, messages) can never add links, forms or images to an email we send.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** For email subjects and plain-text parts: no line breaks (header injection), trimmed length. */
export function plainLine(value: unknown, max = 200): string {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

export default escapeHtml;
