// @ts-nocheck — ported from the Express backend (utils/slugify.js); logic unchanged.


/**
 * Convert any string to a URL-safe slug: ^[a-z0-9-]+$
 */
const slugify = (text) => {
  if (!text || typeof text !== 'string') return 'item';
  const slug = text
    .normalize('NFD')                         // decompose unicode
    .replace(/[\u0300-\u036f]/g, '')          // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')            // remove non-alphanumeric except spaces and hyphens
    .replace(/[\s]+/g, '-')                   // spaces → hyphens
    .replace(/-+/g, '-')                      // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');                 // trim leading/trailing hyphens
  return slug || 'item';
};

const __exports: any = { slugify };

export default __exports;
