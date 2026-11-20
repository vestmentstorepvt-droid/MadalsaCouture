import React, { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { optimizePoster, optimizeVideo } from "../../../utils/imageUtils";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: Array<{
    _id: string;
    title: string;
    description?: string;
    videoUrl: string;
    posterUrl: string;
    linkUrl?: string;
    buttonText?: string;
  }>;
  initialVideoId: string;
}

const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose, videos, initialVideoId }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Set initial index when modal opens
  useEffect(() => {
    const index = videos.findIndex((v) => v._id === initialVideoId);
    if (index !== -1) {
      setCurrentIndex(index);
    }
  }, [initialVideoId, videos, isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, videos.length]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
  };

  if (!isOpen) return null;

  const currentVideo = videos[currentIndex];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-lg transition-colors lg:-top-10"
            aria-label="Close video"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Video Container */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              key={currentVideo._id}
              src={optimizeVideo(currentVideo.videoUrl, 1080)}
              poster={optimizePoster(currentVideo.posterUrl, 1080)}
              autoPlay
              controls
              playsInline
              className="w-full h-full"
            />
          </div>

          {/* Video Info */}
          <div className="mt-4 text-white">
            <h2 className="text-xl font-semibold mb-2">{currentVideo.title}</h2>
            {currentVideo.description && (
              <p className="text-sm text-gray-300 mb-4">{currentVideo.description}</p>
            )}
          </div>

          {/* Navigation Controls */}
          {videos.length > 1 && (
            <div className="mt-6 flex items-center justify-between gap-4">
              {/* Previous Button */}
              <button
                onClick={goToPrevious}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                aria-label="Previous video"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              {/* Counter */}
              <div className="text-white/60 text-sm">
                <span className="font-semibold text-white">{currentIndex + 1}</span> / {videos.length}
              </div>

              {/* Next Button */}
              <button
                onClick={goToNext}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors ml-auto"
                aria-label="Next video"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Keyboard Hint */}
          <div className="mt-4 text-center text-xs text-gray-400">
            💡 Use arrow keys to navigate, ESC to close
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoModal;
