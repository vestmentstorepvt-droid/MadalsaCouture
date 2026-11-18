import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
const cardFallbackImage = '/assets/madalsa-2.jpg';
import { useGetProductsQuery } from '../../../services/productsApi';
import { optimizeImage } from '../../../utils/imageUtils';

export interface CollectionItem {
  id: string | number;
  title: string;
  category: string;
  price: number;
  discountText?: string;
  imageUrl: string;
  slug?: string;
}

export interface DynamicCollectionProps {
  sectionTitle?: string;
  items?: CollectionItem[];
}

const DEFAULT_COLLECTION_TITLE = 'Best Sellers';

const DynamicCollection: FC<DynamicCollectionProps> = ({ sectionTitle, items }) => {
  const displayedTitle = sectionTitle ?? DEFAULT_COLLECTION_TITLE;

  const { data: productsData, isLoading } = useGetProductsQuery({
    category: 'best-seller',
    sort: 'createdAt:desc',
    limit: 12,
  });

  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>(items || []);

  useEffect(() => {
    if (items) {
      setCollectionItems(items);
    } else if (productsData?.products) {
      const mappedItems = productsData.products.map((p) => {
        const discount = p.originalPrice && p.originalPrice > p.price
          ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
          : 0;

        return {
          id: p._id,
          title: p.name,
          category: p.category,
          price: p.price,
          discountText: discount > 0 ? `${discount}% OFF` : undefined,
          imageUrl: p.images[0] || '',
          slug: p.slug,
        };
      });
      setCollectionItems(mappedItems);
    }
  }, [productsData, items]);

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    event.currentTarget.src = cardFallbackImage;
  };

  const formatPrice = (price: number): string =>
    `₹ ${price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  if (isLoading && !items) {
    return (
      <section id="couture" className="scroll-mt-24 bg-[#FFF9FA] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif text-slate-800 uppercase text-center mb-2">
              {displayedTitle}
            </h2>
            <div className="mx-auto mt-3 h-0.5 w-full rounded-full bg-[#E2CBA6]" />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (collectionItems.length === 0) return null;

  return (
    <section id="couture" className="scroll-mt-24 bg-[#FFF9FA] py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif text-slate-800 uppercase text-center mb-2">
            {displayedTitle}
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-full rounded-full bg-[#E2CBA6]" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {collectionItems.slice(0, 8).map((item) => {
            const content = (
              <>
                <div className="aspect-[3/4] overflow-hidden">
                  <img
                    src={optimizeImage(item.imageUrl, 500)}
                    alt={item.title}
                    loading="lazy"
                    onError={handleImageError}
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="space-y-1 px-3 py-3 sm:px-4">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-1 group-hover:text-[#B57D2B] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    {item.category}
                  </p>
                  <div className="flex items-center justify-between pt-0.5">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900">
                      {formatPrice(item.price)}
                    </p>
                    {item.discountText && (
                      <span className="rounded bg-[#D4AF37] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-black">
                        {item.discountText}
                      </span>
                    )}
                  </div>
                </div>
              </>
            );

            return item.slug ? (
              <Link
                key={item.id}
                to={`/product/${item.slug}`}
                className="group block overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                {content}
              </Link>
            ) : (
              <article
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                {content}
              </article>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 border border-slate-800 px-8 py-3 text-xs uppercase tracking-widest text-slate-800 hover:bg-slate-800 hover:text-white transition-all duration-300"
          >
            View All
          </Link>
        </div>
      </div>
    </section>
  );
};

export default DynamicCollection;
