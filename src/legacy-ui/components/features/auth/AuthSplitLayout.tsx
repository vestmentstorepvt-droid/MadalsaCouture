import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetProductsQuery } from '../../../services/productsApi';

const LOGO_SRC = '/assets/madalsa-logo.webp';
const FALLBACK_SRC = '/assets/madalsa-2.jpg';
const FALLBACK_POSITIONS = ['38% 20%', '100% 20%', '64% 20%', '0% 20%'];

/** Palette of the cutting-table panel. */
const T = {
  silk: '#f3ead7',
  madder: '#8e2a2a',
  maroon: '#5e0d1d',
  gold: '#e2c27a',
  ivory: '#f6ead2',
  brass: '#b88a3e',
  brassDeep: '#8a6528',
  tape: '#f7efd9',
} as const;

const CARD_W = 290;
const CARD_H = 370;
/** Swatches hang from an eyelet near their top-left corner. */
const PIVOT = 26;
/** Fan angles for the back and front swatch; the rest spread evenly between. */
const FAN_BACK = -30;
const FAN_FRONT = 12;
const fanAngle = (position: number, count: number) =>
  count < 2 ? FAN_FRONT : FAN_BACK + ((FAN_FRONT - FAN_BACK) * position) / (count - 1);
/** Loop: every few seconds the front swatch slides out and tucks in behind the stack. */
const LOOP_MS = 4200;
const LIFT_MS = 560;
const MAX_SWATCHES = 5;

/** Polygon for a card cut with pinking shears (zigzag on every edge), in px. */
const pinked = (w: number, h: number, tooth = 9, depth = 5) => {
  const pts: string[] = [];
  const edge = (len: number, map: (along: number, inset: number) => [number, number]) => {
    const n = Math.max(2, Math.round(len / tooth));
    const step = len / n;
    for (let i = 0; i < n; i++) {
      pts.push(map(i * step, depth).join('px ') + 'px');
      pts.push(map(i * step + step / 2, 0).join('px ') + 'px');
    }
  };
  edge(w, (a, d) => [a, d]); // top, left → right
  edge(h, (a, d) => [w - d, a]); // right, top → bottom
  edge(w, (a, d) => [w - a, h - d]); // bottom, right → left
  edge(h, (a, d) => [d, h - a]); // left, bottom → top
  return `polygon(${pts.join(', ')})`;
};
const SWATCH_CLIP = pinked(CARD_W, CARD_H);

/** Cloudinary: crop around the subject (bodice and embroidery) at swatch size. */
const swatchUrl = (url: string) =>
  url.includes('res.cloudinary.com') && /\/upload\/v\d/.test(url)
    ? url.replace('/upload/', '/upload/e_trim:15/c_fill,g_face,w_560,h_600,f_auto,q_auto/')
    : url;

/** Hand-block-print repeat (Bagru style): four-petal buti with dot clusters, rows offset. */
const BlockPrint: React.FC = () => (
  <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
    <defs>
      <g id="bp-motif" fill={T.madder}>
        {[0, 90, 180, 270].map((r) => (
          <path key={r} d="M0 -2 C4 -6 4 -11 0 -14 C-4 -11 -4 -6 0 -2Z" transform={`rotate(${r})`} />
        ))}
        <circle r="1.6" />
        {[45, 135, 225, 315].map((r) => (
          <circle key={r} cx="0" cy="-12" r="1.1" transform={`rotate(${r})`} />
        ))}
      </g>
      <pattern id="bp" width="72" height="72" patternUnits="userSpaceOnUse">
        <use href="#bp-motif" x="18" y="18" />
        <use href="#bp-motif" x="54" y="54" transform="rotate(8 54 54)" />
        <circle cx="54" cy="18" r="1.3" fill={T.madder} />
        <circle cx="18" cy="54" r="1.3" fill={T.madder} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bp)" opacity="0.075" />
  </svg>
);

/** Tailor's measuring tape with cm ticks and numbers. */
const MeasuringTape: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => {
  const cm = 26;
  const len = 70;
  return (
    <svg className={className} style={style} viewBox={`0 0 ${len * cm + 60} 46`} aria-hidden="true">
      <rect x="0" y="4" width={len * cm + 60} height="38" fill={T.tape} />
      <rect x="0" y="4" width={len * cm + 60} height="38" fill="none" stroke="#00000014" />
      {/* metal end tab */}
      <rect x="0" y="2" width="22" height="42" rx="2" fill={T.brass} />
      <rect x="4" y="6" width="3" height="34" fill="#ffffff55" />
      {Array.from({ length: len * 10 + 1 }, (_, i) => {
        const x = 30 + i * (cm / 10);
        const major = i % 10 === 0;
        const half = i % 5 === 0;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1="4" y2={major ? 18 : half ? 13 : 9} stroke={T.maroon} strokeWidth={major ? 1.4 : 0.7} />
            <line x1={x} x2={x} y1="42" y2={major ? 28 : half ? 33 : 37} stroke={T.maroon} strokeWidth={major ? 1.4 : 0.7} />
            {major && i > 0 && (
              <text x={x} y="27" textAnchor="middle" fontSize="9" fontWeight="600" fill={T.maroon} fontFamily="ui-sans-serif, system-ui">
                {i / 10}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

interface Swatch {
  src: string;
  name: string;
  fallbackPosition: string;
}

const SwatchCard: React.FC<{
  swatch: Swatch;
  angle: number;
  z: number;
  /** The front swatch on its way to the back of the stack. */
  lifted: boolean;
  open: boolean;
  /** Stagger for the first fan-out only. */
  delay: number;
}> = ({ swatch, angle, z, lifted, open, delay }) => {
  const [failed, setFailed] = useState(false);
  const useFallback = failed || swatch.src === FALLBACK_SRC;
  // Always "rotate() translate()" so poses interpolate cleanly. The front swatch slides straight
  // out to the right at its own angle (no swing), then slides back in behind the stack.
  const transform = !open
    ? `rotate(${FAN_BACK + 21}deg) translate(0px, 0px)`
    : lifted
      ? `rotate(${angle}deg) translate(${Math.round(CARD_W * 0.92)}px, 18px)`
      : `rotate(${angle}deg) translate(0px, 0px)`;
  return (
    <div
      className="group absolute left-0 top-0 motion-reduce:transition-none"
      style={{
        width: CARD_W,
        height: CARD_H,
        transformOrigin: `${PIVOT}px ${PIVOT}px`,
        transform,
        transitionProperty: 'transform',
        transitionTimingFunction: lifted ? 'cubic-bezier(0.45, 0, 0.25, 1)' : 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDuration: lifted ? `${LIFT_MS}ms` : '1000ms',
        transitionDelay: `${delay}ms`,
        zIndex: z,
      }}
    >
      <div
        className="h-full w-full transition-transform duration-300 ease-out group-hover:-translate-y-2 motion-reduce:transition-none"
        style={{ filter: 'drop-shadow(0 10px 14px rgb(60 30 10 / 0.22)) drop-shadow(0 2px 3px rgb(60 30 10 / 0.18))' }}
      >
        <div className="flex h-full w-full flex-col bg-[#fffaf0]" style={{ clipPath: SWATCH_CLIP }}>
          <div className="relative mx-[9px] mt-[9px] flex-1 overflow-hidden">
            <img
              src={useFallback ? FALLBACK_SRC : swatchUrl(swatch.src)}
              alt=""
              decoding="async"
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
              style={{ objectPosition: useFallback ? swatch.fallbackPosition : '50% 35%' }}
            />
            {/* the eyelet punched through the swatch */}
            <span
              className="absolute rounded-full"
              style={{
                left: PIVOT - 9 - 9,
                top: PIVOT - 9 - 9,
                width: 18,
                height: 18,
                background: `radial-gradient(circle, ${T.silk} 0 38%, ${T.brass} 40% 70%, ${T.brassDeep} 72% 100%)`,
                boxShadow: 'inset 0 1px 1px #fff8, 0 1px 2px #0005',
              }}
            />
          </div>
          {/* woven label */}
          <div className="mx-[9px] mb-[11px] mt-2 flex h-9 items-center gap-2 border-y border-dashed px-1" style={{ borderColor: `${T.madder}55` }}>
            <span className="truncate font-display text-base font-semibold leading-none" style={{ color: T.maroon }}>
              {swatch.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/** The left panel: a swatch book of current pieces on a silk cutting table. */
const CuttingTable: React.FC<{ collection: string }> = ({ collection }) => {
  const { data, isLoading } = useGetProductsQuery({ collection, limit: MAX_SWATCHES });
  const products = (data?.products ?? []).slice(0, MAX_SWATCHES);
  const count = Math.max(3, products.length);
  const swatches: Swatch[] = Array.from({ length: count }, (_, i) => {
    const p = products[i];
    const src = p?.primaryImage || p?.images?.[0];
    return {
      src: src || FALLBACK_SRC,
      // Short names: "Mayra – The Purple Anarkali Sharara Set" → "Mayra"
      name: p ? p.name.split(/\s*[–—-]\s+/)[0].trim() : ['Ivory', 'Rose', 'Emerald'][i % 3],
      fallbackPosition: FALLBACK_POSITIONS[i % FALLBACK_POSITIONS.length],
    };
  });

  // order[position] = swatch index; position 0 is the back, the last is the front.
  const initialOrder = Array.from({ length: count }, (_, i) => count - 1 - i);
  const [order, setOrder] = useState<number[]>([]);
  const stack = order.length === count ? order : initialOrder;
  const [lifted, setLifted] = useState<number | null>(null);

  // First fan-out once the photos are known, staggered back to front.
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    const openTimer = window.setTimeout(() => setOpen(true), 120);
    const settleTimer = window.setTimeout(() => setSettled(true), 1500);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(settleTimer);
    };
  }, [isLoading]);

  // The loop. Paused while the pointer is over the swatches or the tab is hidden; off for reduced motion.
  const paused = useRef(false);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  useEffect(() => {
    if (!settled || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let liftTimer: number | undefined;
    const interval = window.setInterval(() => {
      if (paused.current || document.hidden) return;
      const current = stackRef.current;
      const front = current[current.length - 1];
      setLifted(front);
      liftTimer = window.setTimeout(() => {
        setOrder([front, ...current.slice(0, -1)]);
        setLifted(null);
      }, LIFT_MS);
    }, LOOP_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(liftTimer);
    };
  }, [settled, count]);

  return (
    <aside aria-hidden="true" className="relative hidden overflow-hidden lg:sticky lg:top-0 lg:block lg:h-svh" style={{ backgroundColor: T.silk }}>
      {/* raw-silk slub texture and soft light */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(0deg, rgb(120 90 50 / 0.035) 0 1px, transparent 1px 3px)',
            'repeating-linear-gradient(90deg, rgb(120 90 50 / 0.025) 0 1px, transparent 1px 5px)',
            'radial-gradient(120% 90% at 30% 20%, rgb(255 255 255 / 0.55), transparent 60%)',
            'radial-gradient(90% 70% at 100% 100%, rgb(120 70 30 / 0.12), transparent 70%)',
          ].join(', '),
        }}
      />
      <BlockPrint />

      {/* tape across the top-right corner */}
      <MeasuringTape className="absolute -right-24 top-[9%] w-[78%] origin-right rotate-[-14deg] drop-shadow-[0_6px_8px_rgb(60_30_10/0.18)]" />

      {/* swatch book, hung from the eyelet */}
      <div
        className="absolute left-[34%] top-[12%] [@media(min-height:860px)]:top-[19%]"
        style={{ width: CARD_W, height: CARD_H }}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
      >
        {swatches.map((swatch, i) => {
          const position = stack.indexOf(i);
          return (
            <SwatchCard
              key={i}
              swatch={swatch}
              angle={fanAngle(position, count)}
              z={position + 1}
              lifted={lifted === i}
              open={open}
              delay={settled ? 0 : position * 110}
            />
          );
        })}

        {/* thread from the eyelet down to the hang tag */}
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" style={{ zIndex: 10 }}>
          <path
            d={`M${PIVOT} ${PIVOT} C ${PIVOT - 60} ${PIVOT + 120}, ${PIVOT - 130} ${PIVOT + 250}, ${PIVOT - 92} ${PIVOT + 392}`}
            fill="none"
            stroke={T.maroon}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx={PIVOT} cy={PIVOT} r="5" fill={T.brass} stroke={T.brassDeep} />
        </svg>

        {/* hang tag */}
        <div
          className="absolute z-20 w-52 origin-top -rotate-[7deg] rounded-[6px] px-5 pb-5 pt-7 shadow-[0_14px_24px_rgb(60_20_10/0.28)]"
          style={{
            left: PIVOT - 92 - 104,
            top: PIVOT + 384,
            backgroundColor: T.maroon,
            clipPath: 'polygon(14% 0, 86% 0, 100% 12%, 100% 100%, 0 100%, 0 12%)',
          }}
        >
          <span className="absolute left-1/2 top-2.5 h-3 w-3 -translate-x-1/2 rounded-full" style={{ backgroundColor: T.silk, boxShadow: `0 0 0 2px ${T.gold}` }} />
          <div className="border border-dashed px-3 py-3 text-center" style={{ borderColor: `${T.gold}99` }}>
            <p className="font-display text-2xl font-semibold uppercase leading-none tracking-[0.18em]" style={{ color: T.gold }}>
              Madalsa
            </p>
            <p className="mt-1 font-display text-sm font-medium uppercase tracking-[0.42em]" style={{ color: T.ivory }}>
              Couture
            </p>
            <p className="mt-3 text-xs leading-5" style={{ color: `${T.ivory}cc` }}>
              Handcrafted womenswear,
              <br />
              cut and stitched in Bhopal.
            </p>
          </div>
        </div>
      </div>

      {/* two loose pins on the table */}
      {[
        { l: '80%', t: '70%', r: 38, c: T.maroon },
        { l: '86%', t: '74%', r: -14, c: T.gold },
      ].map((pin, i) => (
        <svg key={i} className="absolute h-20 w-4 drop-shadow-[0_2px_2px_rgb(60_30_10/0.25)]" style={{ left: pin.l, top: pin.t, transform: `rotate(${pin.r}deg)` }} viewBox="0 0 8 80">
          <line x1="4" y1="9" x2="4" y2="79" stroke="#a7a7a7" strokeWidth="1.2" />
          <circle cx="4" cy="6" r="5.5" fill={pin.c} />
          <circle cx="2.6" cy="4.6" r="1.6" fill="#ffffff99" />
        </svg>
      ))}
    </aside>
  );
};

interface AuthSplitLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Shown under the form, e.g. "New to Madalsa? Create an account". */
  footer?: React.ReactNode;
  /** Collection whose pieces fill the swatch book. */
  photoCollection?: string;
}

/** A row of stitches, used as the section rule on auth screens. */
export const StitchRule: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} height="6" width="100%" aria-hidden="true">
    <line x1="0" y1="3" x2="100%" y2="3" stroke={T.maroon} strokeWidth="1.6" strokeDasharray="7 5" strokeLinecap="round" opacity="0.55" />
  </svg>
);

/**
 * Auth screen: on laptops and up, a silk cutting table with a swatch book of the
 * current collection; the form sits on the right. Below lg only the form shows.
 */
export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({ title, description, children, footer, photoCollection = 'new-arrivals' }) => (
  <div className="min-h-svh bg-canvas lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
    <CuttingTable collection={photoCollection} />

    <main className="flex justify-center px-5 pb-14 pt-10 sm:px-8 lg:items-center lg:py-16">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          aria-label="Madalsa Couture home"
          className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          <img src={LOGO_SRC} alt="" className="h-12 w-auto object-contain" />
        </Link>

        <h1 className="mt-8 font-display text-5xl font-medium leading-[1.05] text-ink">{title}</h1>
        {description && <p className="mt-3 text-sm leading-6 text-body">{description}</p>}
        <StitchRule className="mt-6" />

        <div className="mt-7">{children}</div>

        {footer && (
          <div className="mt-8 text-sm text-body">
            <StitchRule className="mb-6" />
            {footer}
          </div>
        )}
      </div>
    </main>
  </div>
);

export default AuthSplitLayout;
