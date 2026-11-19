import React from 'react';
import { Link } from 'react-router-dom';
import {
  Crown,
  Palette,
  ShieldCheck,
  Sparkles,
  Diamond,
  ArrowRight,
  Quote,
  CheckCircle2,
  ChevronRight,
  Heart,
  Award,
} from 'lucide-react';
const designerImageFallback = '/assets/madalsa-3.jpeg';
import { useGetAboutUsQuery } from '../../services/cmsApi';
import { optimizeImage } from '../../utils/imageUtils';

type CardIcon = 'sparkles' | 'crown' | 'palette' | 'shield' | 'diamond';

const iconMap = {
  sparkles: Sparkles,
  crown: Crown,
  palette: Palette,
  shield: ShieldCheck,
  diamond: Diamond,
} as const;

const DEFAULT_VIRTUES = [
  { label: 'Bespoke Tailoring', desc: 'Custom fits crafted to perfection' },
  { label: 'Ethical Luxury', desc: 'Sourced & made by master artisans' },
  { label: 'Handcrafted Detail', desc: 'Intricate zari & pearl embellishments' },
  { label: 'Global Delivery', desc: 'Insured white-glove express dispatch' },
];

const DEFAULT_CRAFT_BADGES = [
  { title: 'Heirloom Fabrics', description: 'Hand-selected silks, satins, and organzas', icon: 'award' },
  { title: 'Master Artisans', description: 'Hand embroidered zari and beadwork', icon: 'crown' },
  { title: 'Personalized Care', description: 'Dedicated stylist & sizing consultation', icon: 'heart' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const AboutSkeleton = () => (
  <div className="animate-pulse space-y-8 py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
    <div className="h-4 bg-stone-200 rounded w-1/3 mx-auto" />
    <div className="h-10 bg-stone-200 rounded w-3/4 mx-auto" />
    <div className="h-4 bg-stone-200 rounded w-2/3 mx-auto" />
    <div className="h-4 bg-stone-200 rounded w-1/2 mx-auto" />
    <div className="grid gap-6 md:grid-cols-3 pt-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-3xl bg-stone-100 p-8 h-48" />
      ))}
    </div>
  </div>
);

// ─── ErrorState ───────────────────────────────────────────────────────────────
const ErrorState: React.FC<{ message?: string; onRetry?: () => void }> = ({
  message = 'Failed to load About Us content.',
  onRetry,
}) => (
  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 flex flex-col items-center gap-4 text-center max-w-md mx-auto my-20">
    <p className="text-rose-700 font-semibold text-sm">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="btn-sm bg-ink text-white hover:bg-ink-hover"
      >
        Retry
      </button>
    )}
  </div>
);

const About = () => {
  const { data: aboutData, isLoading, isError, refetch } = useGetAboutUsQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas text-ink font-sans antialiased">
        <main className="pt-20 lg:pt-24">
          <AboutSkeleton />
        </main>
      </div>
    );
  }

  if (isError || !aboutData) {
    return (
      <div className="min-h-screen bg-canvas text-ink font-sans antialiased">
        <main className="pt-20 lg:pt-24 px-4">
          <ErrorState
            message="Failed to load About Us content. Please try again."
            onRetry={refetch}
          />
        </main>
      </div>
    );
  }

  // Helper to strip residual HTML tags
  const clean = (s?: string) => (s ? s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '');

  // ── Resolve CMS fields with safe fallbacks ──────────────────────────────────
  const heroLabel = clean(aboutData.heroLabel) || 'ABOUT MADALSA ATELIER';
  const heading = clean(aboutData.heading) || 'Timeless Elegance & Contemporary Grace';
  const body = clean(aboutData.subheading) || clean(aboutData.body) || 'Discover the artistry, heritage, and vision behind Madalsa Couture.';
  const designerName = clean(aboutData.designerName) || 'Madalsa Rai';
  const designerRole = clean(aboutData.designerRole) || 'Founder & Creative Director';
  const designerImage = aboutData.designerImageUrl || designerImageFallback;
  const founderQuote = clean(aboutData.founderQuote) || 'Couture is not merely fabric and thread—it is an intimate dialogue between emotion, art, and confidence.';

  const virtues = (aboutData.virtues && aboutData.virtues.length > 0) ? aboutData.virtues : DEFAULT_VIRTUES;
  const craftBadges = (aboutData.craftBadges && aboutData.craftBadges.length > 0) ? aboutData.craftBadges : DEFAULT_CRAFT_BADGES;

  // Cards
  type CmsCard = { title?: string; description?: string; imageUrl?: string; icon?: CardIcon };
  const rawCards = (aboutData.cards ?? []) as CmsCard[];
  const defaultIcons: CardIcon[] = ['sparkles', 'palette', 'shield'];
  const cards = rawCards.map((c, i) => ({
    title: c.title ?? '',
    description: c.description ?? '',
    icon: (c.icon && c.icon in iconMap ? c.icon : defaultIcons[i % defaultIcons.length]) as CardIcon,
  }));

  const imageBlocks = (aboutData.imageBlocks ?? [])
    .filter((b) => typeof b.imageUrl === 'string' && /^https?:\/\//i.test(b.imageUrl))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const storyParagraphs = aboutData.storyParagraphs ?? [];
  const highlights = (aboutData.highlights ?? []).map((h) =>
    typeof h === 'string' ? h : h.title ?? h.description ?? ''
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">

      <main>
        {/* Editorial Hero Banner */}
        <section className="relative overflow-hidden border-b border-hairline bg-canvas text-ink py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div aria-hidden="true" className="mesh-gradient pointer-events-none absolute inset-x-0 top-0 mx-auto h-full max-w-5xl" />

          <div className="relative z-10 mx-auto max-w-4xl text-center space-y-7">
            <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-2 text-sm text-mute">
              <Link to="/" className="hover:text-ink">Home</Link>
              <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
              <span className="text-ink">{heroLabel}</span>
            </nav>

            <h1 className="text-[32px] leading-10 tracking-[-1.28px] sm:text-5xl sm:leading-[48px] sm:tracking-[-2.4px] text-ink font-semibold">
              {heading}
            </h1>

            <p className="mx-auto max-w-2xl text-base text-body">
              {body}
            </p>

            <div className="pt-6 flex justify-center gap-4">
              <Link
                to="/products"
                className="btn-primary group"
              >
                Explore Collections <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* Virtues Bar */}
        <section className="border-b border-hairline bg-surface py-12 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl grid grid-cols-2 gap-8 lg:grid-cols-4">
            {virtues.map((v) => (
              <div key={v.label} className="text-center space-y-2">
                <p className="text-sm font-semibold text-ink">
                  {v.label}
                </p>
                <p className="text-xs text-stone-600 font-normal leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pillars Cards */}
        {cards.length > 0 && (
          <section className="py-24 lg:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-3">
              <span className="eyebrow">
                OUR ESSENCE
              </span>
              <h2 className="text-xl tracking-[-0.4px] sm:text-3xl tracking-[0.14em] text-ink font-semibold">
                The Pillars of Madalsa Atelier
              </h2>
              <div className="h-1 w-12 bg-ink mx-auto rounded-full" />
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {cards.map((card) => {
                const Icon = iconMap[card.icon];
                return (
                  <article
                    key={card.title}
                    className="group relative rounded-3xl border border-hairline bg-white p-8 sm:p-10 shadow-md transition-all duration-500 hover:-translate-y-3 hover:border-hairline hover:shadow-md"
                  >
                    <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface border border-hairline transition-all duration-500 group-hover:scale-110 group-hover:shadow-md">
                      <Icon className="h-6 w-6 text-accent" />
                    </div>
                    <h3 className="text-base font-semibold text-ink">
                      {card.title}
                    </h3>
                    <p className="mt-4 text-xs sm:text-sm leading-relaxed text-stone-600 font-normal">
                      {card.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Feature Story & Founder's Vision */}
        <section className="bg-surface py-24 lg:py-28 px-4 sm:px-6 lg:px-8 border-y border-hairline">
          <div className="mx-auto max-w-6xl space-y-20">

            {/* Story Showcase Row */}
            <div className="grid gap-16 lg:gap-20 lg:grid-cols-2 items-center">
              <div className="relative overflow-hidden rounded-3xl border border-hairline bg-surface p-4 shadow-md">
                <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl">
                  <img
                    src={optimizeImage(designerImage, 600)}
                    alt={designerName}
                    className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                  />
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-72 rounded-2xl bg-white/95 p-5 shadow-lg backdrop-blur border border-white/50 text-center">
                  <p className="text-sm font-semibold text-ink">
                    {designerName}
                  </p>
                  <p className="text-xs text-accent tracking-wider uppercase font-medium mt-1">
                    {designerRole}
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <span className="eyebrow">
                  CREATIVE JOURNEY
                </span>
                <h2 className="text-[32px] leading-10 tracking-[-1.28px] sm:text-4xl text-ink leading-tight font-semibold">
                  A Label Built on Thoughtful Expression
                </h2>

                {storyParagraphs.length > 0 ? (
                  storyParagraphs.map((para, idx) => (
                    <p key={idx} className="text-sm leading-relaxed text-stone-600 font-normal">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="text-sm leading-relaxed text-stone-600 font-normal">
                    Madalsa Couture was born from a deep love for design, detail, and the timeless power of self-expression.
                  </p>
                )}

                {/* Highlights list */}
                {highlights.length > 0 && (
                  <div className="pt-2 space-y-3">
                    {highlights.map((highlight) => (
                      <div key={highlight} className="flex items-start gap-3 text-xs sm:text-sm text-stone-700 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Founder Quote Card */}
            {founderQuote && (
              <div className="relative rounded-3xl border border-hairline bg-surface p-8 sm:p-12 text-center space-y-5 shadow-md">
                <Quote className="mx-auto h-8 w-8 text-accent opacity-70" />
                <blockquote className="text-base sm:text-2xl italic text-ink max-w-3xl mx-auto leading-relaxed font-semibold">
                  "{founderQuote}"
                </blockquote>
                <div className="h-px w-12 bg-gradient-to-r from-transparent via-ink to-transparent mx-auto" />
                <p className="text-xs uppercase tracking-wider text-accent font-semibold">
                  — {designerName}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Atelier Gallery (CMS image blocks) */}
        {imageBlocks.length > 0 && (
          <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {imageBlocks.map((block, idx) => (
                <figure
                  key={`${block.imageUrl}-${idx}`}
                  className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-md"
                >
                  <div className="aspect-[4/5] overflow-hidden">
                    <img
                      src={optimizeImage(block.imageUrl as string, 600)}
                      alt={block.caption || 'Madalsa atelier'}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                  </div>
                  {block.caption && (
                    <figcaption className="px-4 py-3 text-center text-xs font-normal tracking-wide text-stone-600">
                      {block.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Quality Badges Section */}
        <section className="py-24 lg:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-14">
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="eyebrow">
              CRAFT GUARANTEE
            </span>
            <h2 className="text-xl tracking-[-0.4px] sm:text-3xl tracking-[0.14em] text-ink font-semibold">
              The Madalsa Signature
            </h2>
            <div className="h-1 w-12 bg-ink mx-auto rounded-full" />
            <p className="text-xs text-stone-600 font-normal leading-relaxed">
              Every detail is meticulously perfected to ensure your wardrobe piece remains a treasured possession for years to come.
            </p>
          </div>

          <div className="grid gap-7 sm:grid-cols-3">
            {craftBadges.map((badge, idx) => (
              <div key={idx} className="group rounded-2xl border border-hairline bg-white p-7 space-y-3 text-center hover:border-hairline hover:shadow-lg transition-all duration-300">
                <div className="flex justify-center">
                  {badge.icon === 'crown' ? (
                    <Crown className="h-6 w-6 text-accent transition-transform duration-300 group-hover:scale-110" />
                  ) : badge.icon === 'heart' ? (
                    <Heart className="h-6 w-6 text-accent transition-transform duration-300 group-hover:scale-110" />
                  ) : (
                    <Award className="h-6 w-6 text-accent transition-transform duration-300 group-hover:scale-110" />
                  )}
                </div>
                <h4 className="text-sm font-semibold text-ink">
                  {badge.title}
                </h4>
                <p className="text-xs text-stone-600 font-normal leading-relaxed">{badge.description}</p>
              </div>
            ))}
          </div>

          <div className="pt-8">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-ink px-8 text-white duration-300 h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover"
            >
              View Signature Collections <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default About;
