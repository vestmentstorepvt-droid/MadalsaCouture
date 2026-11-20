import { useRef, type FC } from 'react';
import { Link } from 'react-router-dom';
import { useScrollReveal } from '../../../lib/motion';
import { useGetPublicCollectionBySlugQuery } from '../../../services/collectionsApi';
import { ProductCard } from '../../ui/ProductCard';
import { CollectionBanner, type CollectionBannerTheme } from '../../ui/CollectionBanner';

interface ProductRowProps {
  /** Collection slug managed in Admin → Collections. */
  slug: string;
  /** Banner wording and colours for this row. */
  theme: CollectionBannerTheme;
  /** Mirror the banner layout. */
  flip?: boolean;
  /** How many products to show (client brief: 6). */
  count?: number;
}

const imageOf = (product: any): string | undefined =>
  product?.primaryImage || product?.images?.find((i: any) => i.role === 'primary')?.url || product?.images?.[0]?.url;

/** Home rows in page order; banners lower down avoid models already used above. */
export const HOME_ROW_SLUGS = ['new-arrivals', 'best-seller', 'western-wear', 'ethnic-wear'] as const;

/** Banner models come only from the products shown in this section's grid. */
const bannerCandidates = (all: any[], count: number) =>
  all.slice(0, count).map(imageOf).filter(Boolean) as string[];

/** Banner photos for `slug`, skipping the first three picks of every earlier row (cached queries). */
const useBannerPhotos = (slug: string, count: number): string[] => {
  const rows = [
    useGetPublicCollectionBySlugQuery(HOME_ROW_SLUGS[0]).data,
    useGetPublicCollectionBySlugQuery(HOME_ROW_SLUGS[1]).data,
    useGetPublicCollectionBySlugQuery(HOME_ROW_SLUGS[2]).data,
    useGetPublicCollectionBySlugQuery(HOME_ROW_SLUGS[3]).data,
  ];
  const used = new Set<string>();
  const position = HOME_ROW_SLUGS.indexOf(slug as (typeof HOME_ROW_SLUGS)[number]);
  for (let i = 0; i < position; i++) {
    const earlier = bannerCandidates((rows[i]?.collection?.products as any[]) || [], count).filter((u) => !used.has(u));
    earlier.slice(0, 3).forEach((u) => used.add(u));
  }
  const own = bannerCandidates((rows[Math.max(position, 0)]?.collection?.products as any[]) || [], count);
  if (position < 0) return own.slice(0, 9);
  const fresh = own.filter((u) => !used.has(u));
  // Fresh models first; repeats only as a last resort.
  return [...fresh, ...own.filter((u) => used.has(u))].slice(0, 9);
};

/**
 * Home page product row: a full-bleed banner, then the first `count` products of an
 * admin-managed collection as 3 × 2. Hidden when the collection is empty.
 */
export const ProductRow: FC<ProductRowProps> = ({ slug, theme, flip, count = 6 }) => {
  const { data, isLoading, isError } = useGetPublicCollectionBySlugQuery(slug);
  const all = (data?.collection?.products as any[]) || [];
  const products = all.slice(0, count);
  const headingId = `row-${slug}`;
  const photos = useBannerPhotos(slug, count);
  const sectionRef = useRef<HTMLElement>(null);
  useScrollReveal(sectionRef, [products.length, isLoading]);

  if (isError || (!isLoading && products.length === 0)) return null;


  return (
    <section ref={sectionRef} aria-labelledby={headingId} className="bg-canvas pb-2 sm:pb-4">
      {isLoading ? (
        // Same box as the banner, so nothing below moves when it arrives.
        <div className="mt-16 h-[340px] sm:mt-20 sm:h-[400px] lg:mt-24 lg:h-[440px]" aria-hidden="true" />
      ) : (
        <CollectionBanner id={headingId} theme={theme} photos={photos} viewAllTo={`/collections/${slug}`} flip={flip} />
      )}

      {/* Client brief: 6 products as 3 × 2 (2 across on phones). Six always fills complete rows. */}
      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-x-3 gap-y-10 px-4 sm:grid-cols-3 sm:gap-x-6 sm:px-6 lg:px-8">
        {isLoading
          ? Array.from({ length: count }, (_, i) => (
              <div key={i} className="animate-pulse" aria-hidden="true">
                <div className="aspect-[3/4] rounded-2xl bg-hairline-soft" />
                <div className="mt-3 h-4 w-3/4 rounded bg-hairline-soft" />
                <div className="mt-2 h-4 w-1/3 rounded bg-hairline-soft" />
              </div>
            ))
          : products.map((product: any) => (
              <div key={product._id} data-reveal>
              <ProductCard
                href={`/product/${product.slug}`}
                title={product.title || product.name}
                image={imageOf(product)}
                price={product.basePrice ?? product.price ?? 0}
                originalPrice={product.mrp}
              />
              </div>
            ))}
      </div>

      {!isLoading ? (
        <div className="mt-8 flex justify-center px-4 sm:mt-10">
          <Link
            to={`/collections/${slug}`}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-ink px-8 text-sm font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            View all
            <span className="sr-only"> {`${theme.script} ${theme.caps}`.toLowerCase()}</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
};

export default ProductRow;
