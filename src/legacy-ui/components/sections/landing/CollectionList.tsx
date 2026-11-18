import type { FC } from 'react';
import { useGetCollectionsShowcaseQuery } from '../../../services/cmsApi';
import { optimizeImage } from '../../../utils/imageUtils';

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
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[2/3] overflow-hidden rounded-xl sm:rounded-2xl bg-slate-100 shadow-sm animate-pulse"
            />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center space-y-4">
          <p className="text-slate-500 text-sm">Failed to load collections.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="border border-slate-800 px-6 py-2 text-xs uppercase tracking-widest text-slate-800 hover:bg-slate-800 hover:text-white transition-all"
          >
            Retry
          </button>
        </div>
      );
    }

    if (collections.length === 0) {
      return (
        <div className="mt-8 flex items-center justify-center py-12">
          <p className="text-slate-400 text-sm">No collections available.</p>
        </div>
      );
    }

    return (
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {collections.map((collection) => (
          <a
            key={collection._id}
            href={`/collections/${collection.slug}`}
            className="group relative block overflow-hidden rounded-xl sm:rounded-2xl bg-slate-100 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden">
              <img
                src={optimizeImage(collection.imageUrl, 600)}
                alt={collection.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-3 sm:px-4 sm:py-4 text-center">
                <p className="text-[11px] sm:text-sm font-semibold tracking-widest uppercase text-white drop-shadow">
                  {collection.name}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    );
  };

  return (
    <section id="shop" className="scroll-mt-24 bg-white py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif text-slate-800 uppercase tracking-widest mb-2">
            Collection list
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-16 sm:w-full rounded-full bg-[#E2CBA6]" />
        </div>
        {renderContent()}
      </div>
    </section>
  );
};

export default CollectionList;
