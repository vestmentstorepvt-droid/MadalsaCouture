import type { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { optimizeImage } from '../../utils/imageUtils';

const FALLBACK_IMAGE = '/assets/madalsa-2.jpg';

export const formatINR = (value: number) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

export interface ProductCardProps {
  href?: string;
  title: string;
  image?: string;
  price: number;
  /** MRP before discount; shown struck through with the % saved when higher than price. */
  originalPrice?: number;
  /** Small label on the photo, e.g. "New". One at most — the photo is the product. */
  badge?: string;
  /** Eager-load the first row of a grid. */
  priority?: boolean;
}

/** One product tile used by every grid (home, shop, collections). */
export const ProductCard: FC<ProductCardProps> = ({ href, title, image, price, originalPrice, badge, priority }) => {
  const hasDiscount = Boolean(originalPrice && originalPrice > price);
  const percentOff = hasDiscount ? Math.round(((originalPrice! - price) / originalPrice!) * 100) : 0;

  const body = (
    <>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-hairline bg-hairline-soft">
        <img
          src={optimizeImage(image || FALLBACK_IMAGE, 600)}
          alt={title}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={(event) => {
            if (!event.currentTarget.src.endsWith(FALLBACK_IMAGE)) event.currentTarget.src = FALLBACK_IMAGE;
          }}
          className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        {badge && (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-hairline bg-surface px-2 py-0.5 font-mono text-xs font-medium uppercase leading-4 text-ink">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1 px-0.5">
        <h3 className="line-clamp-1 text-sm font-medium text-ink underline-offset-4 group-hover:underline">{title}</h3>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium text-ink tabular-nums">{formatINR(price)}</span>
          {hasDiscount && (
            <>
              <span className="text-xs text-mute line-through tabular-nums">
                <span className="sr-only">Was </span>
                {formatINR(originalPrice!)}
              </span>
              <span className="text-xs font-medium text-accent">{percentOff}% off</span>
            </>
          )}
        </p>
      </div>
    </>
  );

  return href ? (
    <Link to={href} className="group block rounded-2xl">
      {body}
    </Link>
  ) : (
    <article className="group">{body}</article>
  );
};

/** Grid used for product tiles everywhere: 2 → 3 → 4 columns. */
export const ProductGrid: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
);

export const ProductGridSkeleton: FC<{ count?: number }> = ({ count = 8 }) => (
  <ProductGrid>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="animate-pulse" aria-hidden="true">
        <div className="aspect-[3/4] rounded-2xl bg-hairline-soft" />
        <div className="mt-3 h-4 w-3/4 rounded bg-hairline-soft" />
        <div className="mt-2 h-4 w-1/3 rounded bg-hairline-soft" />
      </div>
    ))}
  </ProductGrid>
);

export default ProductCard;
