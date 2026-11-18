import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useGetStaticPageQuery } from '../../services/cmsApi';
import DOMPurify from 'dompurify';

interface StaticCmsPageProps {
  slug: string;
  title: string;
}

/**
 * Generic CMS-driven static page.
 * Fetches content from GET /cms/static-pages/:slug and renders the HTML body.
 */
const StaticCmsPage: React.FC<StaticCmsPageProps> = ({ slug, title }) => {
  const { data, isLoading, isError, refetch } = useGetStaticPageQuery(slug);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D2C24] font-sans antialiased selection:bg-[#B38756]/20">
      {/* Header Banner */}
      <section className="bg-[#271C16] text-[#FAF7F2] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto space-y-7">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]"
          >
            <Link to="/" className="hover:text-[#FFF8ED] transition-colors duration-200">
              Home
            </Link>
            <ChevronRight className="h-3 w-3 text-[#D4AF37]/50" />
            <span className="text-stone-400">{title}</span>
          </nav>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-[0.1em] uppercase text-[#FFF8ED]">
            {title}
          </h1>
        </div>
      </section>

      {/* Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        {isLoading && (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-gradient-to-r from-stone-200 to-stone-100 rounded w-full" />
            ))}
            <div className="h-4 bg-gradient-to-r from-stone-200 to-stone-100 rounded w-3/4" />
          </div>
        )}

        {!isLoading && (isError || !data) && (
          <div className="flex flex-col items-center gap-4 text-center py-16">
            <p className="text-stone-500 text-sm">Content not available.</p>
            {isError && (
              <button
                type="button"
                onClick={() => refetch()}
                className="border border-[#3D2C24] px-6 py-2.5 text-xs uppercase tracking-widest text-[#3D2C24] hover:bg-[#3D2C24] hover:text-[#FFF8ED] transition-all"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!isLoading && data && (
          <>
            <style>{`
              .cms-content {
                word-wrap: break-word;
                overflow-wrap: break-word;
                white-space: normal;
              }
              .cms-content h1,
              .cms-content h2,
              .cms-content h3,
              .cms-content h4,
              .cms-content h5,
              .cms-content h6 {
                font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
                text-transform: uppercase;
                color: #271C16;
                font-weight: 500;
                letter-spacing: 0.05em;
                margin-top: 2.75rem;
                margin-bottom: 1.5rem;
                line-height: 1.4;
              }
              .cms-content h1 {
                font-size: 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #D4AF37;
                margin-bottom: 2rem;
              }
              .cms-content h2 {
                font-size: 1.65rem;
                padding-bottom: 0.75rem;
                border-bottom: 1px solid #E2CBA6;
                margin-bottom: 1.75rem;
              }
              .cms-content h3 { font-size: 1.35rem; }
              .cms-content h4 { font-size: 1.15rem; }
              .cms-content p {
                margin-bottom: 1.75rem;
                line-height: 1.85;
                color: #5C4D46;
                font-size: 0.95rem;
              }
              .cms-content ul,
              .cms-content ol {
                margin-bottom: 1.75rem;
                padding-left: 2rem;
              }
              .cms-content ul {
                list-style-type: disc;
              }
              .cms-content ol {
                list-style-type: decimal;
              }
              .cms-content li {
                margin-bottom: 0.75rem;
                line-height: 1.8;
                color: #5C4D46;
              }
              .cms-content a {
                color: #B38756;
                text-decoration: underline;
              }
              .cms-content a:hover {
                color: #8C6239;
              }
              .cms-content > *:first-child {
                margin-top: 0;
              }
              .cms-content > *:last-child {
                margin-bottom: 0;
              }
            `}</style>
            <article
              className="cms-content max-w-none text-sm md:text-base leading-relaxed rounded-2xl border border-[#E2D9CC]/40 bg-gradient-to-br from-white to-[#FEFBF7] p-10 sm:p-12 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(data.body)
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\u00a0/g, ' '),
              }}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default StaticCmsPage;
