import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useGetProductsQuery } from '../../../services/productsApi';
import { ProductCard, ProductGrid, ProductGridSkeleton } from '../../ui/ProductCard';
import { SectionHeader } from '../../ui/SectionHeader';

export interface CollectionItem {
  id: string | number;
  title: string;
  category: string;
  price: number;
  originalPrice?: number;
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
          originalPrice: p.originalPrice,
          discountText: discount > 0 ? `${discount}% OFF` : undefined,
          imageUrl: p.images[0] || '',
          slug: p.slug,
        };
      });
      setCollectionItems(mappedItems);
    }
  }, [productsData, items]);

  // Show only complete rows of four (the old grid left a hole: 7 items at 4 columns).
  const visibleCount = collectionItems.length >= 4 ? Math.min(8, collectionItems.length - (collectionItems.length % 4)) : collectionItems.length;

  if (!isLoading && collectionItems.length === 0) return null;

  return (
    <section id="couture" aria-labelledby="best-sellers-title" className="scroll-mt-24 border-t border-hairline bg-canvas py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="best-sellers-title"
          eyebrow="Most loved"
          title={displayedTitle}
          action={{ label: 'View all', to: '/products' }}
        />
        <div className="mt-10">
          {isLoading && !items ? (
            <ProductGridSkeleton count={4} />
          ) : (
            <ProductGrid>
              {collectionItems.slice(0, visibleCount).map((item, index) => (
                <ProductCard
                  key={item.id}
                  href={item.slug ? `/product/${item.slug}` : undefined}
                  title={item.title}
                  image={item.imageUrl}
                  price={item.price}
                  originalPrice={item.originalPrice}
                  priority={index < 4}
                />
              ))}
            </ProductGrid>
          )}
        </div>
      </div>
    </section>
  );
};

export default DynamicCollection;
