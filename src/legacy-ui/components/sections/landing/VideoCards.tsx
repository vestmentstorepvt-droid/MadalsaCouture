import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, VideoOff, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionHeader } from "../../ui/SectionHeader";
import { useGetVideoCardsQuery } from "../../../services/cmsApi";
import VideoModal from "./VideoModal";
import { useScrollReveal } from "../../../lib/motion";
import { optimizePoster, optimizeVideo } from "../../../utils/imageUtils";

interface VideoCardMediaProps {
  title: string;
  description?: string;
  videoUrl: string;
  posterUrl: string;
  onPlay?: () => void;
}

const VideoCardMedia: React.FC<VideoCardMediaProps> = ({ title, description, videoUrl, posterUrl, onPlay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isVisible) {
      video.pause();
      return;
    }
    video.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setHasFailed(true);
      }
    });
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      className="group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-2xl bg-hairline-soft"
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay?.();
        }
      }}
    >
      <video
        ref={videoRef}
        // Cards are ~230–300px wide. The raw uploads (5–10 MB each, some .mov) all played at once
        // on laptops, ~45 MB per visit; 480px MP4/WebM via Cloudinary is ~2–3.5 MB each.
        src={isVisible ? optimizeVideo(videoUrl, 480) : undefined}
        poster={optimizePoster(posterUrl, 600)}
        autoPlay={isVisible && !hasFailed}
        muted
        loop
        playsInline
        preload={isVisible ? "metadata" : "none"}
        aria-label={title}
        onError={() => setHasFailed(true)}
        onPlaying={() => setHasFailed(false)}
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-12 text-white">
        <h3 className="line-clamp-2 text-sm font-medium leading-5">{title}</h3>
        {description && <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-white/85">{description}</p>}
      </div>

      {/* Play Button Overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/90 group-hover:bg-white transition-colors">
          <Play className="ml-0.5 h-5 w-5 text-ink" fill="currentColor" />
        </div>
      </div>

      {hasFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 p-5 text-center text-white">
          <VideoOff className="h-7 w-7" />
          <p className="text-sm">This video couldn’t play automatically.</p>
        </div>
      )}
    </div>
  );
};

const VideoCards: React.FC = () => {
  const { data: cards = [], isLoading, isError } = useGetVideoCardsQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  useScrollReveal(sectionRef, [cards.length, isLoading]);
  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  };

  // Which card is at the start of the row, for the position dots on phones.
  const [active, setActive] = useState(0);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const first = track.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0");
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      setActive(atEnd ? track.children.length - 1 : Math.round(track.scrollLeft / step));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [cards.length, isLoading]);

  const goTo = (index: number) => {
    const card = trackRef.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  const handleVideoPlay = (videoId: string) => {
    setSelectedVideoId(videoId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  if (isError) return null;

  if (isLoading) {
    return (
      <section aria-label="Video stories" className="bg-canvas py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 h-8 w-48 animate-pulse rounded bg-hairline-soft" />
          <div className="flex gap-3 sm:gap-4 overflow-hidden">
            {[1, 2, 3].map((item) => <div key={item} className="aspect-[2/3] w-[160px] sm:w-[220px] lg:w-[260px] shrink-0 animate-pulse rounded-2xl bg-hairline-soft" />)}
          </div>
        </div>
      </section>
    );
  }

  if (cards.length === 0) return null;

  return (
    <>
      <section ref={sectionRef} aria-labelledby="video-stories-title" className="bg-canvas py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <SectionHeader id="video-stories-title" eyebrow="Watch" title="Video stories" />
            <div className="hidden gap-2 sm:flex">
              <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll videos left" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink hover:border-ink">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll videos right" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink hover:border-ink">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bleeds to the screen edge on phones so the next card peeks in (scroll affordance). */}
          <div
            ref={trackRef}
            className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 scrollbar-hide sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0"
          >
            {cards.map((card) => (
              <article key={card._id} data-reveal className="w-[44vw] max-w-[260px] shrink-0 snap-start sm:w-[220px] lg:w-[calc((100%-4rem)/5)]">
                <VideoCardMedia
                  title={card.title}
                  description={card.description}
                  videoUrl={card.videoUrl}
                  posterUrl={card.posterUrl}
                  onPlay={() => handleVideoPlay(card._id)}
                />
                {card.linkUrl && (
                  card.linkUrl.startsWith('/') ? (
                    <Link to={card.linkUrl} className="mt-2 flex h-10 items-center justify-between rounded-full border border-hairline bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-ink">
                      <span>{card.buttonText?.trim() || "Add To Cart"}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <a href={card.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex h-10 items-center justify-between rounded-full border border-hairline bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-ink">
                      <span>{card.buttonText?.trim() || "Add To Cart"}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )
                )}
              </article>
            ))}
          </div>

          {/* Phones have no arrow buttons: dots show where you are and jump to a video. */}
          {cards.length > 1 && (
            <div className="mt-4 flex justify-center sm:hidden">
              {cards.map((card, i) => (
                <button
                  key={card._id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show video ${i + 1} of ${cards.length}`}
                  aria-current={i === active ? "true" : undefined}
                  className="flex h-6 items-center px-1"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      i === active ? "w-5 bg-gold-deep" : "w-1.5 bg-hairline-strong"
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Video Modal with Previous/Next Navigation */}
      <VideoModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        videos={cards}
        initialVideoId={selectedVideoId}
      />
    </>
  );
};

export default VideoCards;
