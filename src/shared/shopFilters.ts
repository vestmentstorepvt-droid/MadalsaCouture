// Shared by the shop page (legacy-ui) and the product list API (server).
//
// Variant colours are typed free-form in the admin ("Cherry Red Shade",
// "Black Colour", "Ivory with Lime Green Dupatta"), so the shop filters on
// colour *families*: each raw name maps to the family whose keyword appears
// first in it.

export interface ColorFamily {
  value: string;
  label: string;
  /** Swatch fill for the filter UI. */
  swatch: string;
  keywords: string[];
}

export const COLOR_FAMILIES: ColorFamily[] = [
  { value: 'red', label: 'Red', swatch: '#b3202a', keywords: ['red', 'cherry', 'maroon', 'wine', 'crimson', 'burgundy', 'scarlet'] },
  { value: 'pink', label: 'Pink', swatch: '#e88aa8', keywords: ['pink', 'rose', 'blush', 'magenta', 'fuchsia', 'peach'] },
  { value: 'orange', label: 'Orange', swatch: '#e0702b', keywords: ['orange', 'rust', 'coral', 'tangerine', 'saffron'] },
  { value: 'yellow', label: 'Yellow', swatch: '#e9c434', keywords: ['yellow', 'mustard', 'lemon', 'haldi'] },
  { value: 'green', label: 'Green', swatch: '#3f7d4e', keywords: ['green', 'olive', 'emerald', 'mint', 'lime', 'sage', 'bottle', 'mehendi'] },
  { value: 'blue', label: 'Blue', swatch: '#2e5aa8', keywords: ['blue', 'navy', 'teal', 'turquoise', 'aqua', 'sky', 'indigo', 'ocean'] },
  { value: 'purple', label: 'Purple', swatch: '#6b3a8f', keywords: ['purple', 'violet', 'lavender', 'lilac', 'plum', 'mauve'] },
  { value: 'black', label: 'Black', swatch: '#1c1c1c', keywords: ['black', 'onyx', 'jet'] },
  { value: 'white', label: 'White & ivory', swatch: '#f6f1e6', keywords: ['white', 'ivory', 'cream', 'off white', 'off-white', 'pearl'] },
  { value: 'beige', label: 'Beige & nude', swatch: '#d9c2a3', keywords: ['beige', 'nude', 'tan', 'sand', 'champagne', 'khaki'] },
  { value: 'brown', label: 'Brown', swatch: '#6e4a2f', keywords: ['brown', 'coffee', 'chocolate', 'mocha', 'camel'] },
  { value: 'grey', label: 'Grey', swatch: '#8a8a8a', keywords: ['grey', 'gray', 'charcoal', 'ash'] },
  { value: 'metallic', label: 'Gold & metallic', swatch: '#c9a54a', keywords: ['gold', 'golden', 'silver', 'copper', 'bronze', 'metallic'] },
];

export const OTHER_COLOR_FAMILY = 'other';

/** Map a raw variant colour name to a family value ('other' when nothing matches). */
export function colorFamilyOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const name = ` ${String(raw).toLowerCase().replace(/[^a-z]+/g, ' ')} `;
  let best: { value: string; at: number } | null = null;
  for (const family of COLOR_FAMILIES) {
    for (const keyword of family.keywords) {
      const at = name.indexOf(` ${keyword}`);
      if (at !== -1 && (!best || at < best.at)) best = { value: family.value, at };
    }
  }
  return best ? best.value : OTHER_COLOR_FAMILY;
}

/** Display order for sizes; unknown sizes sort after these, alphabetically. */
export const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'FREE SIZE'];

export function compareSizes(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Sort keys the shop sends to GET /products?sort=… */
export const SHOP_SORTS = [
  { value: 'newest', label: 'Newest first', api: 'createdAt:desc' },
  { value: 'price-asc', label: 'Price: low to high', api: 'basePrice:asc' },
  { value: 'price-desc', label: 'Price: high to low', api: 'basePrice:desc' },
  { value: 'discount', label: 'Biggest discount', api: 'discount:desc' },
] as const;

export type ShopSort = (typeof SHOP_SORTS)[number]['value'];
