import { useRef, useState, type FC } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, Star } from 'lucide-react';
import { useScrollReveal } from '../../../lib/motion';
import { useGetFeaturedReviewsQuery, type FeaturedReview } from '../../../services/cmsApi';
import { optimizeImage } from '../../../utils/imageUtils';
import { ButiPattern, GOLD, GOLD_TEXT, LotusDivider, Mandala } from '../../ui/CollectionBanner';

const BAND = '#3b0b18';
/** Seconds each card takes to travel its own width; sets the loop speed whatever the review count. */
const SECONDS_PER_CARD = 7;
/** A loop needs at least this many cards per half so it never shows a gap on wide screens. */
const MIN_CARDS_PER_HALF = 8;

const Stars: FC<{ rating: number }> = ({ rating }) => (
  <div className="flex gap-1" role="img" aria-label={`${rating} out of 5 stars`}>
    {Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-gold-deep text-gold-deep' : 'text-gold-muted'}`}
        aria-hidden="true"
      />
    ))}
  </div>
);

/** One review. Every card has the same size; long reviews are clamped. */
const ReviewCard: FC<{ review: FeaturedReview; hidden?: boolean; className?: string }> = ({
  review,
  hidden = false,
  className = '',
}) => (
  <li
    aria-hidden={hidden || undefined}
    className={`${className} relative mr-5 flex h-[330px] w-[290px] shrink-0 flex-col overflow-hidden rounded-[22px] border border-[#e2c27a]/60 bg-[#fbf4e6] p-7 text-left shadow-[0_18px_40px_rgba(0,0,0,0.28)] sm:mr-6 sm:h-[350px] sm:w-[360px]`}
  >
    <span
      className="pointer-events-none absolute -top-5 right-5 select-none font-display text-[9rem] leading-none text-gold-deep/25"
      aria-hidden="true"
    >
      ”
    </span>
    <Stars rating={review.rating} />
    <blockquote className="relative mt-5 min-w-0 flex-1 break-words">
      <p className="line-clamp-5 font-display text-xl font-medium leading-snug text-[#2a1712] sm:text-2xl sm:leading-snug">
        “{review.body}”
      </p>
    </blockquote>
    <div className="mt-5 flex items-center gap-3 border-t border-[#e2c27a]/50 pt-4">
      {review.product?.image && (
        <img
          src={optimizeImage(review.product.image, 96)}
          alt=""
          loading="lazy"
          className="h-12 w-10 shrink-0 rounded-md border border-[#e2c27a]/60 object-cover object-top"
        />
      )}
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold leading-tight text-[#2a1712]">{review.author}</p>
        {review.product && (
          <Link
            to={`/product/${review.product.slug}`}
            tabIndex={hidden ? -1 : undefined}
            className="block truncate text-sm text-[#6b5446] underline-offset-4 hover:text-[#2a1712] hover:underline"
          >
            {review.product.title}
          </Link>
        )}
      </div>
    </div>
  </li>
);

/**
 * Home page testimonials: real 4–5★ reviews from the site, revolving in an endless loop on a
 * maroon band that matches the collection banners. Pauses on hover, on keyboard focus and with
 * the pause button; for reduced motion it becomes a plain swipeable row.
 */
export const Testimonials: FC = () => {
  const { data: reviews = [], isLoading } = useGetFeaturedReviewsQuery(24);
  const [paused, setPaused] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  useScrollReveal(sectionRef, [reviews.length, isLoading]);
  if (!isLoading && reviews.length === 0) return null;

  // One half of the loop: the reviews repeated until it is wide enough, then shown twice so
  // translating by -50% lands exactly where it started.
  const repeats = reviews.length ? Math.ceil(MIN_CARDS_PER_HALF / reviews.length) : 0;
  const half = Array.from({ length: repeats }, () => reviews).flat();

  return (
    <section
      ref={sectionRef}
      aria-labelledby="testimonials-title"
      className="relative overflow-hidden py-16 sm:py-24"
      style={{ backgroundColor: BAND }}
    >
      <ButiPattern id="buti-testimonials" />
      <div
        className="absolute left-1/2 top-0 h-[70%] w-[90%] -translate-x-1/2"
        style={{ background: 'radial-gradient(closest-side, #7a1a33 0%, transparent 100%)' }}
        aria-hidden="true"
      />
      <Mandala className="absolute left-1/2 top-4 h-[300px] -translate-x-1/2 opacity-[0.14] sm:h-[380px]" />
      <div className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: GOLD, opacity: 0.5 }} aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ backgroundColor: GOLD, opacity: 0.5 }} aria-hidden="true" />

      <div data-reveal className="relative mx-auto flex max-w-3xl flex-col items-center px-4 text-center">
        <h2 id="testimonials-title" className="flex flex-col items-center leading-none">
          <span
            className="-mx-[0.15em] -mb-[0.25em] -mt-[0.3em] bg-clip-text px-[0.15em] pb-[0.15em] pt-[0.3em] font-script text-6xl text-transparent sm:text-8xl"
            style={{ backgroundImage: GOLD_TEXT }}
          >
            Testimonials
          </span>
          <span className="mt-3 font-display text-2xl font-medium uppercase tracking-[0.16em] text-[#f6ead2] sm:text-4xl">
            Loved by our customers
          </span>
        </h2>
        <LotusDivider className="mt-5 h-auto w-44 sm:w-[220px]" />
      </div>

      <div data-reveal className="relative mt-12 sm:mt-14">
        {isLoading ? (
          <ul className="flex justify-center gap-6 overflow-hidden px-4" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="h-[350px] w-[290px] shrink-0 animate-pulse rounded-[22px] bg-[#fbf4e6]/15 sm:w-[360px]" />
            ))}
          </ul>
        ) : (
          <>
            {/* Endless loop (motion allowed) */}
            <div
              className="group hidden overflow-hidden py-4 motion-safe:block [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
              onFocusCapture={() => setPaused(true)}
              onBlurCapture={() => setPaused(false)}
            >
              <ul
                className={`animate-testimonial-loop flex w-max group-hover:[animation-play-state:paused] ${
                  paused ? '[animation-play-state:paused]' : ''
                }`}
                style={{ ['--loop-duration' as string]: `${half.length * SECONDS_PER_CARD}s` }}
                aria-label="Customer reviews"
              >
                {half.map((review, i) => (
                  <ReviewCard key={`a-${review._id}-${i}`} review={review} hidden={i >= reviews.length} />
                ))}
                {half.map((review, i) => (
                  <ReviewCard key={`b-${review._id}-${i}`} review={review} hidden />
                ))}
              </ul>
            </div>
            {/* Reduced motion: a plain row you can swipe */}
            <ul
              className="flex snap-x snap-mandatory overflow-x-auto px-4 py-4 motion-safe:hidden sm:px-8"
              aria-label="Customer reviews"
            >
              {reviews.map((review) => (
                <ReviewCard key={review._id} review={review} className="snap-center" />
              ))}
            </ul>

            <div className="mt-8 hidden justify-center motion-safe:flex">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e2c27a]/70 px-5 text-sm font-medium text-[#f6ead2] transition-colors hover:bg-[#e2c27a] hover:text-[#1a1410] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c27a]"
              >
                {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                {paused ? 'Play reviews' : 'Pause reviews'}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
