import type { ProductVariant } from '../services/productsApi';

export const normalizeSize = (size: string | null | undefined): string =>
  (size || '').trim().toUpperCase();

export const getAvailableVariantStock = (variant: ProductVariant): number => {
  const available = variant.available ??
    (Number(variant.stock || 0) - Number(variant.reservedStock || 0));
  return Math.max(0, Number(available) || 0);
};

export const findAvailableVariantForSize = (
  variants: ProductVariant[] | undefined,
  size: string
): ProductVariant | undefined => {
  const normalizedSize = normalizeSize(size);
  return variants?.find(
    (variant) =>
      normalizeSize(variant.size) === normalizedSize &&
      getAvailableVariantStock(variant) > 0
  );
};

export const isSizeUnavailable = (
  variants: ProductVariant[] | undefined,
  size: string
): boolean => {
  if (!variants?.length) return true;
  return !findAvailableVariantForSize(variants, size);
};
