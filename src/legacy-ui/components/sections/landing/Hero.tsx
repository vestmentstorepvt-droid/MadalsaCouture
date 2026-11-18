import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetHeroQuery } from '../../../services/cmsApi';
import { optimizeImage, optimizeVideo, getCloudinaryVideoPoster } from '../../../utils/imageUtils';
import { VideoCardsErrorBoundary } from './VideoCardsErrorBoundary';

const FestiveBanner = lazy(() => import('./FestiveBanner'));
const CollectionList = lazy(() => import('./CollectionList'));
const PromoBanner = lazy(() => import('./PromoBanner'));
const DynamicCollection = lazy(() => import('./DynamicCollection'));
const OurStory = lazy(() => import('./OurStory'));
const VideoCards = lazy(() => import('./VideoCards'));
const FALLBACK_HERO_IMAGE =
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1920';

// ─── Loading skeleton ─────────────────────────────────────────────────────────
const HeroSkeleton: React.FC = () => (
  <section
    id="hero"
    className="relative aspect-[3/4] w-full overflow-hidden bg-[#110E1B] animate-pulse sm:aspect-video"
    aria-hidden="true"
  >
    <div className="absolute bottom-10 left-4 z-20 w-[calc(100%-2rem)] space-y-4 sm:bottom-16 sm:left-12 sm:w-auto sm:max-w-2xl lg:left-16">
      <div className="h-6 w-48 bg-white/10 rounded sm:h-8 sm:w-80" />
      <div className="h-3 w-36 bg-white/10 rounded sm:h-4 sm:w-64" />
      <div className="h-9 w-32 bg-white/10 rounded sm:h-10 sm:w-40" />
    </div>
  </section>
);

// ─── Error state ──────────────────────────────────────────────────────────────
const HeroError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <section
    id="hero"
    className="relative aspect-[3/4] w-full overflow-hidden bg-[#110E1B] flex items-center justify-center sm:aspect-video"
  >
    <div className="text-center text-white space-y-4">
      <p className="text-sm tracking-widest uppercase text-white/70">
        Hero section is currently unavailable.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="border border-[#D4AF37] px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all duration-300"
      >
        Retry
      </button>
    </div>
  </section>
);

// ─── Hero media — renders either <video> or <img> based on mediaType ─────────
interface HeroMediaProps {
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mobileMediaUrl?: string;
  headline: string;
  loopVideo: boolean;
  onVideoEnded?: () => void;
}

const HeroMedia: React.FC<HeroMediaProps> = ({ mediaType, mediaUrl, mobileMediaUrl, headline, loopVideo, onVideoEnded }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  if (mediaType === 'video') {
    return (
      <video
        autoPlay
        muted
        playsInline
        loop={loopVideo}
        preload="metadata"
        poster={getCloudinaryVideoPoster(mediaUrl, 1920)}
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
        onEnded={onVideoEnded}
      >
        {/* Let the browser choose the right codec — Cloudinary serves mp4 */}
        <source src={optimizeVideo(mediaUrl, 1920)} type="video/mp4" />
        <source src={mediaUrl} type="video/webm" />
      </video>
    );
  }

  if (fallbackFailed) {
    return (
      <div
        role="img"
        aria-label="Hero image unavailable"
        className="aspect-video w-full bg-gradient-to-br from-[#3D2C24] via-[#8A6A58] to-[#D8BFAE]"
      />
    );
  }

  return (
    <picture className="block w-full">
      {!imageFailed && mobileMediaUrl && (
        <source
          media="(max-width: 639px)"
          srcSet={optimizeImage(mobileMediaUrl, 1200)}
        />
      )}
      <img
        src={imageFailed ? FALLBACK_HERO_IMAGE : optimizeImage(mediaUrl, 1920)}
        srcSet={!imageFailed
          ? [640, 960, 1280, 1920]
              .map((width) => `${optimizeImage(mediaUrl, width)} ${width}w`)
              .join(', ')
          : undefined}
        sizes="100vw"
        alt={headline}
        className="block h-auto w-full"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onError={() => {
          if (!imageFailed) {
            setImageFailed(true);
            return;
          }
          setFallbackFailed(true);
        }}
      />
    </picture>
  );
};

// ─── Main Hero component ──────────────────────────────────────────────────────
const Hero: React.FC = () => {
  const { data: hero, isLoading, isError, refetch } = useGetHeroQuery();
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const mediaItems = hero?.media?.length
    ? hero.media
    : hero?.mediaUrl
      ? [{ mediaType: hero.mediaType || 'image', mediaUrl: hero.mediaUrl }]
    : [{ mediaType: 'image' as const, mediaUrl: FALLBACK_HERO_IMAGE }];
  const mediaIndex = currentMediaIndex % mediaItems.length;
  const currentMedia = mediaItems[mediaIndex];

  const advanceSlide = useCallback(() => {
    setCurrentMediaIndex((index) => (index + 1) % mediaItems.length);
  }, [mediaItems.length]);

  const renderHeroSection = () => {
    if (isLoading) return <HeroSkeleton />;
    if (isError) return <HeroError onRetry={refetch} />;

    const headline = hero?.headline || '';
    const subHeadline = hero?.subHeadline || '';
    const ctaLabel = hero?.cta?.label || '';
    const ctaUrl = hero?.cta?.url || '';

    const styles = hero?.styles || {};
    const headlineSize = styles.headlineSize || 'large';
    const subHeadlineSize = styles.subHeadlineSize || 'medium';
    const buttonSize = styles.buttonSize || 'medium';
    const buttonStyle = styles.buttonStyle || 'outline';
    const alignment = styles.alignment || 'bottom-left';

    // Alignment classes
    const alignClass =
      alignment === 'bottom-center'
        ? 'bottom-10 sm:bottom-16 left-1/2 -translate-x-1/2 text-center items-center w-[90%] sm:w-auto'
        : alignment === 'center'
          ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center items-center w-[90%] sm:w-auto'
          : alignment === 'bottom-right'
            ? 'bottom-10 sm:bottom-16 right-4 sm:right-12 lg:right-16 text-right items-end'
            : 'bottom-10 sm:bottom-16 left-4 sm:left-12 lg:left-16 text-left items-start';

    // Headline size classes
    const headlineClass =
      headlineSize === 'small'
        ? 'text-lg sm:text-xl md:text-2xl'
        : headlineSize === 'medium'
          ? 'text-xl sm:text-2xl md:text-3xl'
          : headlineSize === 'xlarge'
            ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
            : 'text-2xl sm:text-3xl md:text-4xl'; // large (default)

    // Sub-headline size classes
    const subHeadlineClass =
      subHeadlineSize === 'small'
        ? 'text-xs sm:text-sm'
        : subHeadlineSize === 'large'
          ? 'text-base sm:text-lg md:text-xl'
          : 'text-sm sm:text-base'; // medium (default)

    // Button size classes
    const buttonSizeClass =
      buttonSize === 'small'
        ? 'px-4 py-2 text-[11px]'
        : buttonSize === 'large'
          ? 'px-8 py-3.5 text-sm sm:text-base'
          : 'px-6 py-3 text-xs sm:text-sm'; // medium (default)

    // Button visual style classes
    const buttonStyleClass =
      buttonStyle === 'solid'
        ? 'bg-[#D4AF37] text-black hover:bg-[#c49f2e] border border-[#D4AF37]'
        : buttonStyle === 'gold_glow'
          ? 'bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-black shadow-lg shadow-[#D4AF37]/30 hover:scale-105 border-none'
          : 'border border-[#D4AF37] bg-black/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black'; // outline (default)

    return (
      <section
        id="hero"
        className={`relative w-full overflow-hidden bg-[#110E1B] ${
          currentMedia.mediaType === 'video' ? 'aspect-[3/4] sm:aspect-video' : ''
        }`}
        aria-label="Hero section"
      >
        {/* Background media */}
        <Link
          to="/products"
          aria-label="Shop all products"
          className={currentMedia.mediaType === 'video' ? 'absolute inset-0 z-10' : 'relative z-10 block'}
        >
          <HeroMedia
            key={`${mediaIndex}-${currentMedia.mediaUrl}-${currentMedia.mobileMediaUrl || ''}`}
            mediaType={currentMedia.mediaType}
            mediaUrl={currentMedia.mediaUrl}
            mobileMediaUrl={currentMedia.mobileMediaUrl}
            headline={headline}
            loopVideo={mediaItems.length === 1}
            onVideoEnded={mediaItems.length > 1 ? advanceSlide : undefined}
          />
        </Link>

        {/* Text content — dynamically aligned & sized via CMS */}
        {(headline || subHeadline || (ctaLabel && ctaUrl)) && (
          <div className={`absolute z-20 flex flex-col max-w-[calc(100%-2rem)] sm:max-w-2xl ${alignClass}`}>
            {headline && (
              <h1 className={`mt-3 font-serif uppercase tracking-[0.1em] sm:tracking-[0.3em] text-white drop-shadow-md font-normal ${headlineClass}`}>
                {headline}
              </h1>
            )}

            {subHeadline && (
              <p className={`mt-1.5 sm:mt-2 font-light tracking-[0.08em] sm:tracking-[0.15em] text-white/90 drop-shadow-sm ${subHeadlineClass}`}>
                {subHeadline}
              </p>
            )}

            {ctaLabel && ctaUrl && (
              <div className="mt-4 sm:mt-6">
                {ctaUrl.startsWith('#') ? (
                  <a
                    href={ctaUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      const target = document.querySelector(ctaUrl);
                      if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className={`inline-flex items-center gap-2 font-medium uppercase tracking-[0.15em] sm:tracking-[0.3em] backdrop-blur-sm transition-all duration-300 ${buttonSizeClass} ${buttonStyleClass}`}
                  >
                    {ctaLabel}
                  </a>
                ) : (
                  <Link
                    to={ctaUrl}
                    className={`inline-flex items-center gap-2 font-medium uppercase tracking-[0.15em] sm:tracking-[0.3em] backdrop-blur-sm transition-all duration-300 ${buttonSizeClass} ${buttonStyleClass}`}
                  >
                    {ctaLabel}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {mediaItems.length > 1 && (
          <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 gap-2" aria-label="Hero slide indicators">
              {mediaItems.map((item, index) => (
                <span
                  key={`${item.mediaUrl}-${index}`}
                  aria-current={index === mediaIndex ? 'true' : undefined}
                  className={`h-2.5 rounded-full transition-all ${index === mediaIndex ? 'w-7 bg-white' : 'w-2.5 bg-white/60'}`}
                />
              ))}
          </div>
        )}
      </section>
    );
  };

  useEffect(() => {
    if (mediaItems.length < 2 || currentMedia.mediaType === 'video') return;

    const timer = window.setTimeout(advanceSlide, 5500);
    return () => window.clearTimeout(timer);
  }, [advanceSlide, currentMedia.mediaType, currentMedia.mediaUrl, mediaItems.length, mediaIndex]);

  return (
    <div className="min-h-screen bg-[#110E1B] text-slate-100">
      <main id="home">
        {renderHeroSection()}
        <Suspense fallback={<div className="h-32 w-full flex items-center justify-center bg-[#110E1B]"><div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div></div>}>
          <FestiveBanner />
          <CollectionList />
          <PromoBanner />
          <DynamicCollection />
          <VideoCardsErrorBoundary>
            <Suspense fallback={<div className="h-64 animate-pulse bg-slate-100" aria-label="Loading video stories" />}>
              <VideoCards />
            </Suspense>
          </VideoCardsErrorBoundary>
          <OurStory />
        </Suspense>
      </main>
    </div>
  );
};

export default Hero;
