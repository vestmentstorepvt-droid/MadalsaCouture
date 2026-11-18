import type { JSX } from 'react/jsx-runtime';
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
    <section className="bg-[#FAF6F3] py-14 md:py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200/40 relative overflow-hidden">
      {/* Decorative background elements */}
      
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif text-slate-800 uppercase text-center mb-5">Our Story</h2>
      {/* <div className="absolute top-0 left-0 w-96 h-96 bg-[#FFF2F5] rounded-full filter blur-3xl opacity-60 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#FAF0E6] rounded-full filter blur-3xl opacity-60 translate-x-1/2 translate-y-1/2" /> */}

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          <div className="lg:col-span-5 flex justify-center group">
            <div className="relative w-full max-w-[420px]">
              {/* Layered Decorative Gold Offset Frame */}
              <div className="absolute inset-0 border border-[#B57D2B]/30 rounded-[2rem] translate-x-4 translate-y-4 -z-10 transition-transform duration-500 group-hover:translate-x-2 group-hover:translate-y-2" />
              <div className="absolute inset-0 bg-[#E85D88]/5 rounded-[2rem] translate-x-2 translate-y-2 -z-10" />

              {/* Main Image Container */}
              <div className="w-full rounded-[2rem] overflow-hidden shadow-2xl border border-white/50 bg-[#F5EBE6] aspect-[4/5]">
                <img
                  src={optimizeImage(designerImage, 800)}
                  alt={`${designerName} - ${designerRole}`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 select-none block"
                  loading="lazy"
                />
              </div>

              {/* Visual badge */}
              <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md border border-white/60 px-4 py-2 rounded-full shadow-lg">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#B57D2B]">{establishedYear}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Narrative content */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left lg:pl-4">
            <span className="text-[#B57D2B] text-xs font-bold uppercase tracking-[0.3em] mb-3 block select-none">
              The Creative Vision
            </span>

            {/* <h2 className="font-serif italic font-light text-slate-900 text-4xl sm:text-5xl lg:text-6xl mb-8 leading-tight select-none">
              
              Our Story
            </h2> */}

            {isLoading ? (
              <TextSkeleton />
            ) : hasCmsParagraphs ? (
              <div className="space-y-2 text-slate-600 text-sm md:text-[15px] leading-relaxed font-light text-justify max-w-2xl">
                {cmsParagraphs!.map((para, idx) => (
                  <p key={idx} className={idx === 0 ? 'overflow-hidden' : ''}>
                    {idx === 0 ? (
                      <>
                        <span className="float-left text-5xl md:text-5xl font-serif text-[#B57D2B] mr-1 leading-none font-light">
                          {para.charAt(0)}
                        </span>
                        {para.slice(1)}
                      </>
                    ) : (
                      para
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <div className="space-y-4 text-slate-600 text-sm md:text-[15px] leading-relaxed font-light text-justify max-w-2xl">
                <p>
                  <span className="float-left text-5xl md:text-5xl font-serif text-[#B57D2B] mr-1 leading-none font-light">
                    M
                  </span>
                  adalsa Couture was born from a deep love for design, detail, and the timeless power of self-expression. Founded by fashion designer Madalsa Rai, the brand is a celebration of modern femininity rooted in confidence, grace, and individuality.
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
            <div className="mt-10 pt-4 border-t border-slate-200/60 flex items-center gap-4 animate-fade-in">
              <div className="w-12 h-0.5 bg-[#B57D2B]/40" />
              <div>
                <p className="font-serif italic text-xl text-slate-800 leading-none">{designerName}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B57D2B] mt-1.5">{designerRole}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OurStory;
