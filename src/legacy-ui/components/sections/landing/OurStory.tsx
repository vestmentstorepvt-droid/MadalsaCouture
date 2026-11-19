import type { JSX } from 'react/jsx-runtime';
import { useRef } from 'react';
import { useScrollReveal } from '../../../lib/motion';
const storyImg = '/assets/madalsa-3.jpeg';
import { useGetAboutUsQuery } from '../../../services/cmsApi';
import { optimizeImage } from '../../../utils/imageUtils';

// ─── Text skeleton for the right column ──────────────────────────────────────
const TextSkeleton = () => (
  <div className="animate-pulse space-y-4 max-w-2xl">
    <div className="h-3 bg-stone-200 rounded w-1/4" />
    <div className="h-3 bg-stone-200 rounded w-full" />
    <div className="h-3 bg-stone-200 rounded w-5/6" />
    <div className="h-3 bg-stone-200 rounded w-full" />
    <div className="h-3 bg-stone-200 rounded w-3/4" />
    <div className="h-3 bg-stone-200 rounded w-full" />
    <div className="h-3 bg-stone-200 rounded w-2/3" />
  </div>
);

const OurStory = (): JSX.Element => {
  const { data: aboutData, isLoading } = useGetAboutUsQuery();
  const sectionRef = useRef<HTMLElement>(null);
  useScrollReveal(sectionRef, [isLoading]);

  const clean = (s?: string) => (s ? s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '');

  const rawParagraphs = aboutData?.storyParagraphs;
  const cmsParagraphs = Array.isArray(rawParagraphs)
    ? rawParagraphs.map(clean).filter(Boolean)
    : [];
  const hasCmsParagraphs = cmsParagraphs.length > 0;
  const designerImage = aboutData?.designerImageUrl || storyImg;
  const designerName = clean(aboutData?.designerName) || 'Madalsa Rai';
  const designerRole = clean(aboutData?.designerRole) || 'Founder & Creative Director';
  const establishedYear = clean(aboutData?.establishedYear) || 'Est. 2024';

  return (
    <section ref={sectionRef} aria-labelledby="our-story-title" className="border-t border-hairline bg-canvas px-4 py-14 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div data-reveal className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-3xl border border-hairline bg-hairline-soft">
              <img
                src={optimizeImage(designerImage, 800)}
                alt={`${designerName}, ${designerRole}`}
                className="block aspect-[4/5] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <span className="absolute bottom-4 left-4 rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-xs uppercase text-ink">
                {establishedYear}
              </span>
            </div>
          </div>

          {/* Right Column: Narrative content */}
          <div data-reveal className="lg:col-span-7 flex flex-col justify-center text-left lg:pl-4">
            <p className="eyebrow mb-2">Our story</p>
            <h2 id="our-story-title" className="section-title mb-6">The creative vision</h2>

            {/* <h2 className="font-serif italic font-normal text-slate-900 text-4xl sm:text-5xl lg:text-6xl mb-8 leading-tight select-none">
              
              Our Story
            </h2> */}

            {isLoading ? (
              <TextSkeleton />
            ) : hasCmsParagraphs ? (
              <div className="max-w-2xl space-y-4 text-base leading-7 text-body">
                {cmsParagraphs!.map((para, idx) => (
                  <p key={idx}>
                    {idx === 0 ? (
                      <>
                        {para}
                      </>
                    ) : (
                      para
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <div className="max-w-2xl space-y-4 text-base leading-7 text-body">
                <p>
                  Madalsa Couture was born from a deep love for design, detail, and the timeless power of self-expression. Founded by fashion designer Madalsa Rai, the brand is a celebration of modern femininity rooted in confidence, grace, and individuality.
                </p>
                <p>
                  Each design reflects her artistic journey, blending contemporary silhouettes with refined craftsmanship and thoughtful detailing. At Madalsa Couture, fashion is not just about clothing; it's about how it makes you feel.
                </p>
                <p>
                  We believe couture should empower. Whether it's a statement dress or an understated classic, our creations are made for women who own their presence, embrace their strength, and express their individuality with style.
                </p>
              </div>
            )}

            {/* Signature Section */}
            <div className="mt-8 border-t border-hairline pt-5">
              <p className="text-base font-semibold text-ink">{designerName}</p>
              <p className="mt-0.5 text-sm text-mute">{designerRole}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OurStory;
