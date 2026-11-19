import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useGetCollectionsShowcaseQuery } from '../../../services/cmsApi';
import { optimizeImage } from '../../../utils/imageUtils';
import { SectionHeader } from '../../ui/SectionHeader';

export interface CollectionItem {
  id: string;
  title: string;
  image: string;
  link: string;
}

const CollectionList: FC = () => {
  const { data: collectionsData, isLoading, isError, refetch } = useGetCollectionsShowcaseQuery();

  // Defensively ensure we always have an array regardless of backend response shape
  const rawCollections = Array.isArray(collectionsData) ? collectionsData : [];
  const collections = [...rawCollections].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-hairline-soft" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-hairline-strong py-12 text-center">
          <p className="text-sm text-body">We couldn't load the collections.</p>
          <button type="button" onClick={() => refetch()} className="btn-secondary">
            Try again
          </button>
        </div>
      );
    }

    if (collections.length === 0) return null;

    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {collections.map((collection) => (
          <Link key={collection._id} to={`/collections/${collection.slug}`} className="group block rounded-2xl">
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-hairline bg-hairline-soft">
              <img
                src={optimizeImage(collection.imageUrl, 600)}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            </div>
            <p className="mt-3 flex items-center justify-between text-sm font-medium text-ink">
              {collection.name}
              <ArrowRight className="h-4 w-4 text-mute transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
            </p>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <section id="shop" aria-labelledby="collections-title" className="scroll-mt-24 bg-canvas py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader id="collections-title" eyebrow="Collections" title="Shop by collection" action={{ label: 'All products', to: '/products' }} />
        <div className="mt-10">{renderContent()}</div>
      </div>
    </section>
  );
};

export default CollectionList;
