import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Grid } from 'lucide-react';
import { optimizeImage } from '../../utils/imageUtils';
import { useGetPublicCollectionBySlugQuery } from '../../services/collectionsApi';

export const CollectionPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useGetPublicCollectionBySlugQuery(slug || '');

  const collection = data?.collection as any;
  const products = data?.collection?.products || [];

  return (
    <>
      <div className="min-h-screen bg-white pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">

          <div className="space-y-2 text-center pt-2 sm:pt-4">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.35em] text-[#D4AF37]">
              {collection?.type === 'rule-based' ? 'Automated Collection' : 'Curated Collection'}
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl tracking-wide text-slate-900">
              {collection?.name || 'Collection'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
              {collection?.description || 'Browse our exclusive pieces curated just for you.'}
            </p>
            <div className="mx-auto mt-3 h-0.5 w-16 bg-[#D4AF37]" />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <div key={item} className="animate-pulse space-y-2 rounded-2xl border border-slate-100 bg-white p-2 sm:p-3">
                  <div className="aspect-[3/4] w-full rounded-xl bg-slate-200" />
                  <div className="h-3 w-3/4 rounded bg-slate-200" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : isError || products.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-white py-16 text-center">
              <Grid className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="text-sm sm:text-base font-medium text-slate-700">No items found in this collection</h3>
              <p className="mx-auto max-w-sm text-xs text-slate-400">
                This collection might be empty or still being curated. Check back later!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
              {products.map((product: any) => (
                <Link
                  key={product._id}
                  to={`/product/${product.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:border-[#D4AF37]/40 hover:shadow-md cursor-pointer"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-slate-50">
                    <img
                      src={optimizeImage(product.primaryImage || product.images?.[0]?.url, 600)}
                      alt={product.title || product.name}
                      loading="lazy"
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                      onError={(event) => {
                        event.currentTarget.src = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800';
                      }}
                    />

                    {product.mrp && product.mrp > product.basePrice && (
                      <span className="absolute right-2 top-2 rounded bg-[#D4AF37] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-black">
                        {Math.round(((product.mrp - product.basePrice) / product.mrp) * 100)}% OFF
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between space-y-1.5 p-3 sm:p-4">
                    <h3 className="line-clamp-1 text-xs sm:text-sm font-medium text-slate-800 transition-colors group-hover:text-[#D4AF37]">
                      {product.title || product.name}
                    </h3>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900">
                        ₹{(product.basePrice ?? product.price ?? 0).toLocaleString('en-IN')}
                      </span>
                      {product.mrp && product.mrp > product.basePrice && (
                        <span className="text-[10px] sm:text-xs text-slate-400 line-through">
                          ₹{(product.mrp ?? 0).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CollectionPage;
