// Plain-text helpers for titles, descriptions and the server-rendered page summary.

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&ndash;": "–", "&mdash;": "—" };

/** HTML (or messy text) -> clean single-spaced text. */
export function toText(value: unknown): string {
  return String(value ?? "")
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Paragraphs of an HTML body, for the page summary. */
export const toParagraphs = (html: unknown, max = 40) =>
  toText(html)
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, max);

/** A meta description: whole words, ~155 characters, ending cleanly. */
export function summarize(value: unknown, max = 158): string {
  const text = toText(value).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = cut.lastIndexOf(". ");
  if (sentence > max * 0.6) return cut.slice(0, sentence + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\-–—|]+$/, "")}…`;
}

/** Camera file names ("IMG_5347", "CAN07030_copy") are not useful image descriptions. */
export const isFileNameAlt = (alt: unknown) =>
  !alt || /^(img|dsc|can|pxl|whatsapp|photo|image)[\s_-]?\d/i.test(String(alt)) || /_copy$|\.(jpe?g|png|webp|heic)$/i.test(String(alt));

export const formatInr = (n: unknown) =>
  Number.isFinite(Number(n)) ? `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "";

/** A list of names joined naturally: "A, B and C". */
export function joinNames(names: string[], max = 3): string {
  const list = names.filter(Boolean).slice(0, max);
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}
