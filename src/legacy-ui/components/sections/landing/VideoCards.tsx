import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, VideoOff, Play } from "lucide-react";
import { useGetVideoCardsQuery } from "../../../services/cmsApi";
import VideoModal from "./VideoModal";

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
      className="relative aspect-[2/3] overflow-hidden bg-slate-100 cursor-pointer group"
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
        src={isVisible ? videoUrl : undefined}
        poster={posterUrl}
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
        <h3 className="line-clamp-2 text-xs font-semibold leading-4">{title}</h3>
        {description && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/90">{description}</p>}
      </div>

      {/* Play Button Overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/90 group-hover:bg-white transition-colors">
          <Play className="h-6 w-6 text-slate-900 ml-0.5" fill="currentColor" />
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
      <section aria-label="Video stories" className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 h-7 w-48 animate-pulse rounded bg-slate-100" />
          <div className="flex gap-3 sm:gap-4 overflow-hidden">
            {[1, 2, 3].map((item) => <div key={item} className="aspect-[2/3] w-[160px] sm:w-[220px] lg:w-[260px] shrink-0 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        </div>
      </section>
    );
  }

  if (cards.length === 0) return null;

  return (
    <>
      <section aria-label="Video stories" className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-7 text-center sm:mb-9">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif text-slate-800 uppercase text-center mb-2">Video Stories</h2>
            <div className="mx-auto mt-3 h-0.5 w-full rounded-full bg-[#E2CBA6]" />
          </div>

          <div className="flex snap-x snap-mandatory gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-hide">
            {cards.map((card) => (
              <article key={card._id} className="group w-[160px] sm:w-[220px] lg:w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <VideoCardMedia
                  title={card.title}
                  description={card.description}
                  videoUrl={card.videoUrl}
                  posterUrl={card.posterUrl}
                  onPlay={() => handleVideoPlay(card._id)}
                />
                {card.linkUrl && (
                  card.linkUrl.startsWith('/') ? (
                    <Link to={card.linkUrl} className="flex min-h-11 items-center justify-between bg-[#6B4D3E] px-3 text-xs font-medium text-white transition-colors hover:bg-[#52392c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]">
                      <span>{card.buttonText?.trim() || "Add To Cart"}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <a href={card.linkUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between bg-[#6B4D3E] px-3 text-xs font-medium text-white transition-colors hover:bg-[#52392c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]">
                      <span>{card.buttonText?.trim() || "Add To Cart"}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )
                )}
              </article>
            ))}
          </div>
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
