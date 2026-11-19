import React from 'react';
import { Link } from 'react-router-dom';
import { useGetBannersQuery } from '../../../services/cmsApi';
const bannerImg = '/assets/madalsa-2.jpg';
import { optimizeImage } from '../../../utils/imageUtils';

const PromoBanner: React.FC = () => {
  const { data: banners, isLoading } = useGetBannersQuery({ placement: 'homepage-hero' });

  // Find first active banner for homepage
  const activeBanner = banners?.find((b) => b.status === 'active');

  // While loading, show skeleton
  if (isLoading) {
    return (
      <section className="relative w-full overflow-hidden">
        <div className="aspect-[4/5] w-full bg-slate-200 animate-pulse sm:aspect-[4/3] lg:aspect-[16/7]" />
      </section>
    );
  }

  // If no active banner, hide section silently
  if (!activeBanner) return null;

  const imageSource = activeBanner.imageUrl || bannerImg;
  const quoteText = activeBanner.title || '';
  const ctaLink = activeBanner.ctaUrl || activeBanner.linkUrl || '/products';
  const ctaText = activeBanner.ctaLabel || 'EXPLORE NOW';
  const isInternalLink = ctaLink.startsWith('/') && !ctaLink.startsWith('//');
  const ctaClassName =
    'mt-6 sm:mt-8 inline-flex items-center justify-center border border-white bg-white/10 backdrop-blur-sm px-8 py-3 text-xs font-medium uppercase tracking-[0.22em] text-white transition-all duration-300 hover:bg-white hover:text-slate-900';

  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative w-full aspect-[4/5] sm:aspect-[4/3] lg:aspect-[16/7]">
        <img
          src={optimizeImage(imageSource, 1920)}
          alt={activeBanner.title || 'Madalsa promo'}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/30" />
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <div className="mx-auto w-full max-w-2xl">
            {quoteText && (
              <p className="text-base sm:text-2xl lg:text-3xl italic tracking-[0.08em] text-white leading-relaxed font-semibold">
                {quoteText}
              </p>
            )}
            {activeBanner.showCtaButton && (
              isInternalLink ? (
                <Link to={ctaLink} className={ctaClassName}>
                  {ctaText}
                </Link>
              ) : (
                <a href={ctaLink} className={ctaClassName}>
                  {ctaText}
                </a>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
