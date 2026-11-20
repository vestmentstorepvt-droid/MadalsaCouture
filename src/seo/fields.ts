import { SITE_NAME } from "./config";
import { summarize, toText } from "./text";

// SEO titles/descriptions typed in the admin are used only when they look right: about THIS page,
// a sensible length, the brand (if any) at the end, and not a keyword list. Otherwise the page's
// own name/description is used. (Some admin entries are 480-character keyword lists, swapped
// title/description, or describe a different product.)
const words = (text: string) => toText(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/** The product's own name word, e.g. "noor" for "Noor- Emerald Green Anarkali Set". */
const nameKey = (name: string) => words(name).find((w) => w.length > 2) || "";
const mentionsName = (text: string, name: string) => !nameKey(name) || words(text).includes(nameKey(name));
/** "Purple Anarkali Suit, Designer Anarkali Suit, Party Wear Anarkali, …": many short comma/pipe pieces. */
const looksLikeKeywordList = (t: string) => {
  const pieces = t.split(/[,|]/).map((p) => p.trim()).filter(Boolean);
  if (pieces.length < 4) return false;
  const avgWords = pieces.reduce((n, p) => n + p.split(/\s+/).length, 0) / pieces.length;
  return avgWords <= 4.5;
};

export function usableSeoTitle(raw: unknown, name: string): string {
  const t = toText(raw).replace(/\s+/g, " ").trim();
  if (!t || t.length > 90 || looksLikeKeywordList(t) || !mentionsName(t, name)) return "";
  const brandAt = t.toLowerCase().indexOf(SITE_NAME.toLowerCase());
  if (brandAt !== -1 && brandAt + SITE_NAME.length !== t.length) return ""; // e.g. "… | Madalsa Coutureg"
  if (/^shop\b/i.test(t) || /[.!?]\s/.test(t)) return ""; // a sentence/description typed into the title box
  return t;
}

export function usableSeoDescription(raw: unknown, name: string): string {
  const d = toText(raw).replace(/\s+/g, " ").trim();
  if (d.length < 50 || d.length > 400 || looksLikeKeywordList(d) || !mentionsName(d, name)) return "";
  if (/\|\s*madalsa couture$/i.test(d)) return ""; // a title typed into the description box
  return summarize(d); // long ones are shortened at a word boundary
}
