import React, { useState, useEffect } from 'react';
import { useGetAnnouncementBarQuery } from '../../../services/cmsApi';
import { Clock } from 'lucide-react';

/**
 * Calculates remaining time formatted as DD : HH : MM : SS
 */
function useCountdown(targetDateStr?: string | null) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null);

  useEffect(() => {
    if (!targetDateStr) {
      setTimeLeft(null);
      return;
    }

    const targetTime = new Date(targetDateStr).getTime();
    if (isNaN(targetTime)) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr]);

  return timeLeft;
}

/**
 * AnnouncementBar
 *
 * Fetches its content from GET /cms/announcement-bar.
 * Hidden when isActive is false, when the API errors, or while loading.
 */
const AnnouncementBar: React.FC = () => {
  const { data, isLoading, isError } = useGetAnnouncementBarQuery();
  const countdown = useCountdown(data?.countdownTarget);

  // Hide on load, error, or when explicitly disabled
  if (isLoading || isError || !data || !data.isActive) return null;

  const msg = data.message || data.text || '';
  if (!msg.trim()) return null;

  const barStyle: React.CSSProperties = {
    backgroundColor: data.backgroundColor || '#D4AF37',
    color: data.textColor || '#000000',
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      className="w-full py-2 px-4 text-center text-xs font-semibold tracking-wider uppercase transition-colors duration-300 relative z-30 shadow-xs flex items-center justify-center gap-3 flex-wrap"
      style={barStyle}
    >
      {data.link ? (
        <a
          href={data.link}
          className="hover:underline inline-flex items-center gap-2"
        >
          <span>{msg}</span>
        </a>
      ) : (
        <span>{msg}</span>
      )}

      {/* Countdown Clock Badge */}
      {countdown && !countdown.isExpired && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/15 text-[11px] font-mono font-bold tracking-normal backdrop-blur-xs">
          <Clock className="w-3 h-3 opacity-70" />
          <span>
            {countdown.days > 0 && `${countdown.days}d `}
            {pad(countdown.hours)}h : {pad(countdown.minutes)}m : {pad(countdown.seconds)}s
          </span>
        </div>
      )}
    </div>
  );
};

export default AnnouncementBar;
