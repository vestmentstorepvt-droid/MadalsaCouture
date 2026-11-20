import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetHeroQuery } from '../../../services/cmsApi';
import { optimizeImage, optimizeVideo, getCloudinaryVideoPoster } from '../../../utils/imageUtils';
import { VideoCardsErrorBoundary } from './VideoCardsErrorBoundary';
import { gsap, MOTION_OK, useGSAP } from '../../../lib/motion';

// Home page order (client brief, Nov 2026): banner → video stories → new arrivals → best sellers →
// western → ethnic → reviews → our story → footer. FestiveBanner / CollectionList / PromoBanner /
// DynamicCollection are no longer on the home page (files kept for reuse).
const OurStory = lazy(() => import('./OurStory'));
const VideoCards = lazy(() => import('./VideoCards'));
const ProductRow = lazy(() => import('./ProductRow'));
const Testimonials = lazy(() => import('./Testimonials'));
const FALLBACK_HERO_IMAGE =
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1920';

// On phones (< sm) the hero fills most of the screen. Mobile banners are designed at
// 1080x1920 with a crop-safe zone, so object-cover works across phone aspect ratios.
const MOBILE_HERO_HEIGHT = 'h-[85svh] min-h-[26rem] sm:h-auto sm:min-h-0';
const SWIPE_THRESHOLD_PX = 50;
// Desktop banners are designed at 1920x1080 and shown whole, never taller than the screen below
// the header. The space held while loading matches that, so nothing moves when the photo arrives.
const DESKTOP_BANNER_BOX = 'sm:aspect-video sm:max-h-[calc(100svh-var(--site-header-h,108px))]';

// ─── Loading skeleton ─────────────────────────────────────────────────────────
const HeroSkeleton: React.FC = () => (
  <section
    id="hero"
    className={`relative ${MOBILE_HERO_HEIGHT} w-full animate-pulse overflow-hidden bg-hairline-soft ${DESKTOP_BANNER_BOX}`}
    aria-hidden="true"
  >
  </section>
);

// No active hero (the API answers 404) or a network error: show nothing rather than an error to shoppers.

// ─── Hero media — renders either <video> or <img> based on mediaType ─────────
interface HeroMediaProps {
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mobileMediaUrl?: string;
  headline: string;
  loopVideo: boolean;
  /** Section is full-height on phones; image must fill it instead of using its natural height. */
  tallMobile: boolean;
  /** Stacked slide: fill the hero box (whose height is set by the first slide) instead of sizing it. */
  fill?: boolean;
  onVideoEnded?: () => void;
  /** Called once the image has loaded or finally failed (its size is then known). */
  onSettled?: () => void;
}

const HeroMedia: React.FC<HeroMediaProps> = ({ mediaType, mediaUrl, mobileMediaUrl, headline, loopVideo, tallMobile, fill = false, onVideoEnded, onSettled }) => {
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
        className="aspect-video w-full bg-ink"
      />
    );
  }

  const hasMobileArt = !imageFailed && Boolean(mobileMediaUrl);
  // Tall phone layout without dedicated mobile art: letterbox the desktop banner
  // over a blurred copy of itself rather than cropping its text away.
  const letterboxOnMobile = tallMobile && !hasMobileArt;
  // Desktop: the whole banner, never taller than the screen below the sticky header
  // (--site-header-h is set by the navbar). Leftover width is filled by a blurred copy.
  const desktopFit =
    'sm:relative sm:mx-auto sm:h-auto sm:max-h-[calc(100svh-var(--site-header-h,108px))] sm:w-auto sm:max-w-full sm:object-contain';
  const imgClass = fill
    ? `relative block h-full w-full ${hasMobileArt ? 'object-cover sm:object-contain' : 'object-contain'}`
    : !tallMobile
    ? 'block h-auto w-full'
    : letterboxOnMobile
      ? `relative block h-full w-full object-contain ${desktopFit}`
      : `block h-full w-full object-cover object-center ${desktopFit}`;

  return (
    <picture className={fill ? 'absolute inset-0 block' : tallMobile ? 'relative block h-full w-full sm:h-auto' : 'block w-full'}>
      {hasMobileArt && (
        <source
          media="(max-width: 639px)"
          srcSet={[640, 1080]
            .map((width) => `${optimizeImage(mobileMediaUrl, width)} ${width}w`)
            .join(', ')}
          sizes="100vw"
        />
      )}
      {tallMobile && (
        <img
          src={imageFailed ? FALLBACK_HERO_IMAGE : optimizeImage(mediaUrl, 640)}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-90 ${letterboxOnMobile || fill ? '' : 'hidden sm:block'}`}
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
        className={imgClass}
        loading="eager"
        decoding="async"
        fetchPriority={fill ? 'low' : 'high'}
        onLoad={onSettled}
        onError={() => {
          if (!imageFailed) {
            setImageFailed(true);
            return;
          }
          setFallbackFailed(true);
          onSettled?.();
        }}
      />
    </picture>
  );
};

// ─── Main Hero component ──────────────────────────────────────────────────────
const Hero: React.FC = () => {
  const { data: hero, isLoading, isError } = useGetHeroQuery();
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const mediaItems = hero?.media?.length
    ? hero.media
    : hero?.mediaUrl
      ? [{ mediaType: hero.mediaType || 'image', mediaUrl: hero.mediaUrl }]
    : [{ mediaType: 'image' as const, mediaUrl: FALLBACK_HERO_IMAGE }];
  const mediaIndex = currentMediaIndex % mediaItems.length;
  const currentMedia = mediaItems[mediaIndex];
  const firstIsVideo = mediaItems[0]?.mediaType === 'video';
  // On desktop the hero takes the first banner's own height, which is 0 until the photo arrives:
  // the page below jumped up and then back down. Hold the banner's box until it has loaded.
  const [sizerLoaded, setSizerLoaded] = useState(false);
  const markSizerLoaded = useCallback(() => setSizerLoaded(true), []);

  const advanceSlide = useCallback(() => {
    setCurrentMediaIndex((index) => (index + 1) % mediaItems.length);
  }, [mediaItems.length]);

  // Touch swipe between slides (phones have no other way to page except the dots).
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = e.changedTouches[0]?.clientX;
    if (startX === null || endX === undefined || mediaItems.length < 2) return;
    const dx = endX - startX;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    setCurrentMediaIndex((index) =>
      dx < 0 ? (index + 1) % mediaItems.length : (index - 1 + mediaItems.length) % mediaItems.length,
    );
  };

  // Hero: settles in from a slight zoom, then drifts slower than the page while you scroll away.
  const pageRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const media = pageRef.current?.querySelector('[data-anim=hero-media]');
        if (!media) return;
        gsap.from(media, { scale: 1.08, duration: 1.6, ease: 'power3.out' });
        gsap.to(media, {
          yPercent: 14,
          ease: 'none',
          scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
        });
      });
      return () => mm.revert();
    },
    { scope: pageRef, dependencies: [isLoading], revertOnUpdate: true },
  );

  const renderHeroSection = () => {
    if (isLoading) return <HeroSkeleton />;
    if (isError) return null;

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
        ? 'h-9 px-4 text-sm'
        : buttonSize === 'large'
          ? 'h-12 px-6 text-base'
          : 'h-11 px-5 text-sm sm:text-base'; // medium (default)

    // Button visual style classes
    // CMS styles kept (solid / gold_glow / outline) but drawn as DESIGN.md pills over the photo.
    const buttonStyleClass =
      buttonStyle === 'outline'
        ? 'border border-white/80 bg-black/20 text-white hover:bg-white hover:text-ink'
        : 'bg-white text-ink hover:bg-hairline-soft';

    return (
      <section
        id="hero"
        className={`relative w-full overflow-hidden bg-hairline-soft ${MOBILE_HERO_HEIGHT} ${
          firstIsVideo ? 'sm:aspect-video' : sizerLoaded ? '' : DESKTOP_BANNER_BOX
        }`}
        aria-label="Hero section"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Background media */}
        <Link
          to="/products"
          aria-label="Shop all products"
          data-anim="hero-media"
          className={firstIsVideo ? 'absolute inset-0 z-10' : 'relative z-10 block h-full sm:h-auto'}
        >
          {/* Every slide stays mounted and they crossfade. The first image slide is the only one in
              the flow, so the hero's height never changes when slides change (no page jumps). */}
          {mediaItems.map((item, index) => {
            const active = index === mediaIndex;
            const sizer = index === 0 && !firstIsVideo;
            // Videos only play while shown; images stay mounted so they are already loaded.
            if (item.mediaType === 'video' && !active) return null;
            return (
              <div
                key={`${index}-${item.mediaUrl}-${item.mobileMediaUrl || ''}`}
                aria-hidden={active ? undefined : true}
                className={`transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
                  sizer ? 'relative h-full sm:h-auto' : 'absolute inset-0'
                } ${active ? 'opacity-100' : 'opacity-0'}`}
              >
                <HeroMedia
                  mediaType={item.mediaType}
                  mediaUrl={item.mediaUrl}
                  mobileMediaUrl={item.mobileMediaUrl}
                  headline={active ? headline : ''}
                  loopVideo={mediaItems.length === 1}
                  tallMobile
                  fill={!sizer}
                  onVideoEnded={mediaItems.length > 1 ? advanceSlide : undefined}
                  onSettled={sizer ? markSizerLoaded : undefined}
                />
              </div>
            );
          })}
        </Link>

        {/* Text content — dynamically aligned & sized via CMS */}
        {(headline || subHeadline || (ctaLabel && ctaUrl)) && (
          <div className={`absolute z-20 flex flex-col max-w-[calc(100%-2rem)] sm:max-w-2xl ${alignClass}`}>
            {headline && (
              <h1 className={`font-semibold tracking-[-0.04em] text-white drop-shadow-md ${headlineClass}`}>
                {headline}
              </h1>
            )}

            {subHeadline && (
              <p className={`mt-2 text-white/90 drop-shadow-sm ${subHeadlineClass}`}>
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
                    className={`inline-flex items-center gap-2 rounded-full font-medium backdrop-blur-sm transition-colors duration-150 ${buttonSizeClass} ${buttonStyleClass}`}
                  >
                    {ctaLabel}
                  </a>
                ) : (
                  <Link
                    to={ctaUrl}
                    className={`inline-flex items-center gap-2 rounded-full font-medium backdrop-blur-sm transition-colors duration-150 ${buttonSizeClass} ${buttonStyleClass}`}
                  >
                    {ctaLabel}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {mediaItems.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/25 px-2 py-1.5 backdrop-blur-sm" role="group" aria-label="Choose banner">
            {mediaItems.map((item, index) => (
              <button
                type="button"
                key={`${item.mediaUrl}-${index}`}
                onClick={() => setCurrentMediaIndex(index)}
                aria-label={`Banner ${index + 1} of ${mediaItems.length}`}
                aria-current={index === mediaIndex ? 'true' : undefined}
                className="flex h-6 items-center px-1"
              >
                <span className={`block h-1.5 rounded-full transition-all ${index === mediaIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/60'}`} />
              </button>
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
    <div ref={pageRef} className="min-h-screen bg-canvas text-ink">
      <main id="home">
        {/* The home page had no main heading; this one is for screen readers and search engines only. */}
        <h1 className="sr-only">Madalsa Couture — designer Anarkali, kurta and sharara sets</h1>
        {renderHeroSection()}
        <VideoCardsErrorBoundary>
          <Suspense fallback={<div className="h-64 animate-pulse bg-hairline-soft" aria-label="Loading video stories" />}>
            <VideoCards />
          </Suspense>
        </VideoCardsErrorBoundary>
        <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
          {/* Each row has its own jewel tone; layouts alternate sides. */}
          <ProductRow
            slug="new-arrivals"
            theme={{ script: 'New', caps: 'Arrivals', line: 'The latest pieces from our atelier.', base: '#5e0d1d', glow: '#9a2238', fitMobile: true }}
          />
          <ProductRow
            slug="best-seller"
            flip
            theme={{ script: 'Best', caps: 'Sellers', line: 'The pieces our customers order most.', base: '#0a3a2f', glow: '#1f7158', fitMobile: true }}
          />
          <ProductRow
            slug="western-wear"
            theme={{ script: 'Western', caps: 'Wear', line: 'Dresses for brunches, dates and parties.', base: '#1d1814', glow: '#5a4632' }}
          />
          <ProductRow
            slug="ethnic-wear"
            flip
            theme={{ script: 'Ethnic', caps: 'Wear', line: 'Anarkalis, shararas and suits for every celebration.', base: '#550d42', glow: '#952d74', centerBrightness: 1.3, fitMobile: true }}
          />
          <Testimonials />
          <OurStory />
        </Suspense>
      </main>
    </div>
  );
};

export default Hero;
