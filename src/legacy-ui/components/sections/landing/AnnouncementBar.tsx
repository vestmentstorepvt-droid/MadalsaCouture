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
// Last answer seen in this browser, so the space can be held while the bar loads.
const LAST_BAR_KEY = 'announcement_bar_last';
const readLastBar = (): { shown: boolean; bg?: string } | null => {
  try {
    return JSON.parse(localStorage.getItem(LAST_BAR_KEY) || 'null');
  } catch {
    return null;
  }
};
const writeLastBar = (value: { shown: boolean; bg?: string }) => {
  try {
    localStorage.setItem(LAST_BAR_KEY, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
};

const AnnouncementBar: React.FC = () => {
  const { data, isLoading, isError } = useGetAnnouncementBarQuery();
  const countdown = useCountdown(data?.countdownTarget);
  const msg = data?.message || data?.text || '';
  const shown = Boolean(!isLoading && !isError && data?.isActive && msg.trim());

  useEffect(() => {
    if (!isLoading) writeLastBar({ shown, bg: data?.backgroundColor });
  }, [isLoading, shown, data?.backgroundColor]);

  // While loading, hold the bar's 36px (empty) unless it was off on the last visit. Popping in
  // after the page has drawn pushed the whole page down (the main layout shift on desktop).
  if (isLoading) {
    const last = readLastBar();
    if (last && !last.shown) return null;
    return <div className="relative z-30 h-9 w-full" style={{ backgroundColor: last?.bg || '#171717' }} aria-hidden="true" />;
  }

  // Hide on error, or when explicitly disabled
  if (!shown || !data) return null;

  const barStyle: React.CSSProperties = {
    backgroundColor: data.backgroundColor || '#171717',
    color: data.textColor || '#ffffff',
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      className="relative z-30 flex h-9 w-full items-center justify-center gap-3 px-4 text-center text-xs font-medium sm:text-sm"
      style={barStyle}
    >
      {data.link ? (
        <a href={data.link} className="min-w-0 truncate underline-offset-4 hover:underline" title={msg}>
          {msg}
        </a>
      ) : (
        <span className="min-w-0 truncate" title={msg}>{msg}</span>
      )}

      {/* Countdown Clock Badge */}
      {countdown && !countdown.isExpired && (
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-xs tabular-nums">
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
