import React from 'react';
import { useParams } from 'react-router-dom';
import { Grid } from 'lucide-react';
import { useGetPublicCollectionBySlugQuery } from '../../services/collectionsApi';
import { ProductCard, ProductGrid, ProductGridSkeleton } from '../../components/ui/ProductCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { EmptyState } from '../../components/ui/EmptyState';

export const CollectionPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useGetPublicCollectionBySlugQuery(slug || '');

  const collection = data?.collection as any;
  const products = data?.collection?.products || [];

  return (
    <div className="min-h-screen bg-canvas px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          as="h1"
          eyebrow="Collection"
          title={collection?.name || (isLoading ? ' ' : 'Collection')}
          description={collection?.description || undefined}
        />

        <div className="mt-10 border-t border-hairline pt-8">
          {isLoading ? (
            <ProductGridSkeleton />
          ) : isError || products.length === 0 ? (
            <EmptyState
              icon={<Grid className="h-8 w-8" />}
              title="Nothing in this collection yet"
              description="New pieces are on their way. Check back soon."
            />
          ) : (
            <ProductGrid>
              {products.map((product: any, index: number) => (
                <ProductCard
                  key={product._id}
                  href={`/product/${product.slug}`}
                  title={product.title || product.name}
                  image={product.primaryImage || product.images?.[0]?.url}
                  price={product.basePrice ?? product.price ?? 0}
                  originalPrice={product.mrp}
                  priority={index < 4}
                />
              ))}
            </ProductGrid>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionPage;
