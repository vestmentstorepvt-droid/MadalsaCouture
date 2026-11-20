import { useRef, useState, type FC } from 'react';
import { gsap, MOTION_OK, useGSAP } from '../../lib/motion';
import { Link } from 'react-router-dom';

export interface CollectionBannerTheme {
  /** Script word, e.g. "New". */
  script: string;
  /** Serif capitals, e.g. "Arrivals". */
  caps: string;
  /** One plain line about the collection. */
  line: string;
  /** Band colour and the lighter glow behind the models. */
  base: string;
  glow: string;
  /** Exposure lift for the centre model only, for a photo shot in low light (1 = unchanged). */
  centerBrightness?: number;
  /**
   * Phones only: size the models by height so they match Western wear's narrow photos (the main
   * model fills the band, the second stands small at the outer edge), whatever the photo's width.
   * Also fits a long capitals word ("Arrivals") beside them. Western wear itself leaves this off.
   */
  fitMobile?: boolean;
}

interface CollectionBannerProps {
  id: string;
  theme: CollectionBannerTheme;
  /** Product photos from this collection, best first; backgrounds are removed by Cloudinary. */
  photos: (string | undefined)[];
  viewAllTo: string;
  /** Mirror the layout (text on the right) so consecutive rows don't repeat. */
  flip?: boolean;
}

export const GOLD = '#e2c27a';
export const GOLD_TEXT = 'linear-gradient(180deg, #fbecc2 0%, #e2c27a 50%, #b4843a 100%)';

/** Raw Cloudinary upload → model cutout (AI background removal, then trimmed to the figure). */
const cutoutUrl = (url?: string, height = 900): string | undefined => {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return undefined;
  if (/\/upload\/(c_|e_|w_|h_|f_)/.test(url)) return undefined;
  return url.replace('/upload/', `/upload/c_limit,h_${height}/e_background_removal/e_trim/f_auto,q_auto/`);
};

/**
 * Inspects a loaded cutout.
 * - ok: background removal really worked. Measured on this catalogue: clean cutouts have at most
 *   ~7% half-transparent pixels; residue (e.g. Pearl) measures 12%+ and a ghosted box 25%+, so
 *   the limit is 9%.
 */
const inspectCutout = (img: HTMLImageElement): { ok: boolean; brightness: number } => {
  try {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return { ok: true, brightness: 1 };
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let clear = 0;
    let partial = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 10) clear++;
      else if (a <= 245) partial++;
    }
    const total = size * size;
    const ok = partial / total < 0.09 && clear / total > 0.05;
    return { ok, brightness: 1 };
  } catch {
    return { ok: true, brightness: 1.1 }; // canvas blocked: trust the cutout
  }
};

/**
 * A model cutout for one banner slot. The first request for a new cutout can answer 423 while
 * Cloudinary processes it, so retry a few times. If a photo can't be cut out cleanly (busy
 * background), move on to the next candidate; if none work, show nothing — never a boxed photo.
 */
export const Cutout: FC<{
  candidates: (string | undefined)[];
  className?: string;
  brightness?: number;
  /** False until the banner opens: the model waits below the band floor (clipped out of sight). */
  open: boolean;
  /** Stagger for the rise, in ms. */
  delay?: number;
}> = ({ candidates, className = '', brightness: lift = 1, open, delay = 0 }) => {
  const urls = candidates.map((c) => cutoutUrl(c)).filter(Boolean) as string[];
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [brightness, setBrightness] = useState<number | null>(null);
  const url = urls[index];
  if (!url) return null;
  const next = () => {
    setBrightness(null);
    setAttempt(0);
    setIndex((i) => i + 1);
  };
  const loaded = brightness !== null;
  return (
    <img
      key={url}
      src={attempt ? `${url}?r=${attempt}` : url}
      alt=""
      aria-hidden="true"
      crossOrigin="anonymous"
      decoding="async"
      loading="lazy"
      onLoad={(e) => {
        const result = inspectCutout(e.currentTarget);
        if (result.ok) setBrightness(lift);
        else next();
      }}
      onError={() => {
        if (attempt < 5) window.setTimeout(() => setAttempt((a) => a + 1), 3500);
        else next();
      }}
      style={{
        filter: `${lift !== 1 ? `brightness(${lift}) ` : ''}drop-shadow(0 24px 28px rgb(0 0 0 / 0.45))`,
        transitionDelay: open ? `${delay}ms` : '0ms',
      }}
      // The rise is driven by `open` (state), not by tweening this element: a replacement photo
      // (a cutout that failed its check) is a new element and must also wait for the banner to open.
      className={`pointer-events-none select-none object-contain object-bottom transition-[opacity,translate] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        loaded ? 'opacity-100' : 'opacity-0'
      } ${open ? 'translate-y-0' : 'translate-y-[105%]'} ${className}`}
    />
  );
};

/** Leaf/petal shape pointing up from radius r1 to r2, half-width w (mandala building block). */
const petal = (r1: number, r2: number, w: number) => {
  const k = (r2 - r1) * 0.3;
  return `M0 ${-r1} C ${w} ${-r1 - k} ${w} ${-r2 + k} 0 ${-r2} C ${-w} ${-r2 + k} ${-w} ${-r1 - k} 0 ${-r1}Z`;
};

/** Line-drawn mandala: lotus rings, bead ring and a pointed outer crown. */
export const Mandala: FC<{ className?: string }> = ({ className = '' }) => {
  const ring = (n: number, d: string, key: string, fill = 'none', opacity = 1) =>
    Array.from({ length: n }, (_, i) => (
      <path key={`${key}${i}`} d={d} transform={`rotate(${(i * 360) / n})`} fill={fill} opacity={opacity} />
    ));
  return (
    <svg data-anim="mandala" className={className} viewBox="-100 -100 200 200" fill="none" aria-hidden="true">
      <g stroke={GOLD} strokeWidth="0.6">
        <circle r="6" fill={GOLD} opacity="0.8" />
        <circle r="11" />
        {ring(8, petal(11, 26, 7), 'a')}
        <circle r="28" />
        {ring(16, petal(28, 44, 6), 'b')}
        {ring(16, petal(30, 40, 2.5), 'c', GOLD, 0.5)}
        <circle r="46" />
        <circle r="49" strokeDasharray="1 2.4" />
        {Array.from({ length: 48 }, (_, i) => (
          <circle key={`d${i}`} r="1" cy={-54} transform={`rotate(${i * 7.5})`} fill={GOLD} stroke="none" />
        ))}
        {ring(24, petal(57, 78, 7), 'e')}
        {ring(24, petal(60, 72, 2), 'f', GOLD, 0.45)}
        <circle r="80" />
        {ring(48, petal(81, 93, 3.2), 'g')}
        <circle r="96" strokeDasharray="0.8 3" />
      </g>
    </svg>
  );
};

/** A point on a cubic Bézier, used to place the cusps of the arch. */
const bezier = (p: number[][], t: number) => {
  const m = 1 - t;
  return [0, 1].map(
    (k) => m * m * m * p[0][k] + 3 * m * m * t * p[1][k] + 3 * m * t * t * p[2][k] + t * t * t * p[3][k],
  );
};

/** Inner arch edge as a chain of cusps (small arcs bulging inward): left half, then mirrored. */
const cuspedPath = (() => {
  const curve = [[44, 210], [44, 132], [112, 104], [160, 62]];
  const pts = Array.from({ length: 7 }, (_, i) => bezier(curve, i / 6));
  let d = `M44 440 V${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const r = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * 0.62;
    d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  }
  for (let i = pts.length - 2; i >= 0; i--) {
    const [x0, y0] = pts[i + 1];
    const [x1, y1] = pts[i];
    const r = Math.hypot(x1 - x0, y1 - y0) * 0.62;
    d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(320 - x1).toFixed(1)} ${y1.toFixed(1)}`;
  }
  return `${d} V440`;
})();

/** Jharokha: pointed outer arch, cusped inner arch with a jaali screen, pillars and a kalash finial. */
export const Arch: FC<{ id: string; className?: string }> = ({ id, className = '' }) => (
  <svg className={className} viewBox="0 -10 320 450" fill="none" aria-hidden="true">
    <defs>
      <pattern id={`jaali-${id}`} width="14" height="14" patternUnits="userSpaceOnUse">
        <path d="M7 0 L14 7 L7 14 L0 7Z" stroke={GOLD} strokeWidth="0.5" />
        <circle cx="7" cy="7" r="1.1" fill={GOLD} />
      </pattern>
      <clipPath id={`arch-in-${id}`}>
        <path d={cuspedPath} />
      </clipPath>
      <linearGradient id={`jaali-fade-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="1" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id={`jaali-mask-${id}`}>
        <rect y="-10" width="320" height="450" fill={`url(#jaali-fade-${id})`} />
      </mask>
    </defs>
    {/* Jaali screen in the crown of the arch, fading out behind the models */}
    <g clipPath={`url(#arch-in-${id})`} mask={`url(#jaali-mask-${id})`} opacity="0.55">
      <rect y="-10" width="320" height="450" fill={`url(#jaali-${id})`} />
    </g>
    <g stroke={GOLD} strokeWidth="1.2" strokeLinejoin="round">
      <path d="M22 440 V196 C22 118 82 88 116 66 C138 52 152 38 160 14 C168 38 182 52 204 66 C238 88 298 118 298 196 V440" />
      <path d="M32 440 V200 C32 128 88 98 120 78 C142 64 154 52 160 32 C166 52 178 64 200 78 C232 98 288 128 288 200 V440" opacity="0.5" />
      <path d={cuspedPath} strokeWidth="1" />
      {[8, 298].map((x) => (
        <g key={x}>
          <rect x={x} y="214" width="14" height="226" strokeWidth="0.9" />
          <path d={`M${x - 3} 214 H${x + 17} M${x - 1} 208 H${x + 15} M${x + 2} 202 H${x + 12}`} strokeWidth="0.9" />
          <circle cx={x + 7} cy="196" r="4" strokeWidth="0.9" />
        </g>
      ))}
      <path d="M160 14 C152 12 150 4 156 0 M160 14 C168 12 170 4 164 0" strokeWidth="0.9" />
      <circle cx="160" cy="-4" r="3" fill={GOLD} />
    </g>
  </svg>
);

/** Toran across the top edge: draped garland with mango leaves and hanging bead strings. */
export const Toran: FC<{ id: string }> = ({ id }) => (
  <svg data-anim="toran" className="absolute inset-x-0 top-0 h-[38px] w-full" aria-hidden="true">
    <defs>
      <pattern id={id} width="64" height="38" patternUnits="userSpaceOnUse">
        <path d="M0 7 Q32 26 64 7" fill="none" stroke={GOLD} strokeWidth="1" />
        <path d="M0 10 Q32 29 64 10" fill="none" stroke={GOLD} strokeWidth="0.5" opacity="0.6" />
        <path d="M32 18 C37 23 36 31 32 36 C28 31 27 23 32 18Z" fill={GOLD} fillOpacity="0.85" />
        <path d="M32 20 V34" stroke="#00000055" strokeWidth="0.6" />
        {[0, 64].map((x) => (
          <g key={x}>
            <path d={`M${x} 7 V20`} stroke={GOLD} strokeWidth="0.7" />
            <circle cx={x} cy="22.5" r="2.2" fill={GOLD} />
            <circle cx={x} cy="28" r="1.4" fill={GOLD} />
            <path d={`M${x} 30.5 L${x + 2} 34 L${x} 37 L${x - 2} 34Z`} fill={GOLD} />
          </g>
        ))}
      </pattern>
    </defs>
    <rect width="100%" height="2" y="1" fill={GOLD} opacity="0.9" />
    <rect width="100%" height="1" y="5" fill={GOLD} opacity="0.5" />
    <rect width="100%" height="38" fill={`url(#${id})`} />
  </svg>
);

/** Paisley chain along the bottom edge between two rules. */
export const PaisleyBorder: FC<{ id: string }> = ({ id }) => (
  <svg className="absolute inset-x-0 bottom-0 h-6 w-full" aria-hidden="true">
    <defs>
      <pattern id={id} width="44" height="24" patternUnits="userSpaceOnUse">
        <path
          d="M22 5 C30 5 32 14 26 17.5 C21 20 15.5 16.5 17 12 C18 9 21.5 9.5 21.5 12"
          fill="none"
          stroke={GOLD}
          strokeWidth="0.9"
        />
        <circle cx="21.5" cy="12" r="0.9" fill={GOLD} />
        <circle cx="0" cy="12" r="1.4" fill={GOLD} />
        <circle cx="44" cy="12" r="1.4" fill={GOLD} />
        <circle cx="5" cy="12" r="0.7" fill={GOLD} />
        <circle cx="39" cy="12" r="0.7" fill={GOLD} />
      </pattern>
    </defs>
    <rect width="100%" height="1" y="1" fill={GOLD} opacity="0.5" />
    <rect width="100%" height="24" fill={`url(#${id})`} />
    <rect width="100%" height="2" y="21" fill={GOLD} opacity="0.9" />
  </svg>
);

/** Divider under the heading: rule, diamond, lotus, diamond, rule. */
export const LotusDivider: FC<{ className?: string }> = ({ className = '' }) => (
  <svg data-anim="divider" className={className} viewBox="0 0 220 22" fill="none" aria-hidden="true">
    <g stroke={GOLD} strokeWidth="1">
      <path d="M0 11 H86 M134 11 H220" />
      <path d="M90 11 L94 7 L98 11 L94 15Z M122 11 L126 7 L130 11 L126 15Z" fill={GOLD} />
      <path d="M110 3 C115 8 115 14 110 19 C105 14 105 8 110 3Z" fill={GOLD} fillOpacity="0.9" />
      <path d="M110 19 C104 18 100 14 101 9 C104 11 107 14 110 19Z M110 19 C116 18 120 14 119 9 C116 11 113 14 110 19Z" />
    </g>
  </svg>
);

/** Tiny woven buti for the band's texture. */
export const ButiPattern: FC<{ id: string; color?: string }> = ({ id, color = GOLD }) => (
  <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden="true">
    <defs>
      <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
        <path d="M28 14 C33 20 33 26 28 32 C23 26 23 20 28 14Z" fill="none" stroke={color} strokeWidth="1" />
        <circle cx="28" cy="38" r="1.6" fill={color} />
        <circle cx="0" cy="0" r="1.2" fill={color} />
        <circle cx="56" cy="56" r="1.2" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

/**
 * Full-bleed collection banner: a jewel-toned band with a gold arch "stage" and three
 * background-removed models from the collection, the tallest breaking out above the band.
 */
export const CollectionBanner: FC<CollectionBannerProps> = ({ id, theme, photos, viewAllTo, flip = false }) => {
  // Three slots; each falls back through every third photo if a cutout fails.
  const slot = (n: number) => photos.filter((_, i) => i % 3 === n);
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // The shop-window opening: band wipes open from the centre, the toran drops, the heading writes
  // in, then the arch rises and the models step up one by one. Mandala and arch drift with scroll.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(root);
        const tl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          scrollTrigger: { trigger: root.current, start: 'top 78%', once: true },
        });
        tl.fromTo(
          q('[data-anim=band]'),
          { clipPath: 'inset(0% 50% 0% 50%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' },
        )
          .from(q('[data-anim=toran]'), { yPercent: -100, autoAlpha: 0, duration: 0.7 }, '-=0.4')
          .from(q('[data-anim=script]'), { autoAlpha: 0, y: 28, duration: 0.9 }, '-=0.45')
          .from(q('[data-anim=caps]'), { autoAlpha: 0, letterSpacing: '0.4em', duration: 1.1 }, '<0.15')
          .from(q('[data-anim=divider]'), { scaleX: 0, autoAlpha: 0, duration: 0.8 }, '-=0.7')
          .from(q('[data-anim=copy]'), { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.1 }, '-=0.5')
          .from(q('[data-anim=arch]'), { autoAlpha: 0, scale: 0.9, transformOrigin: '50% 100%', duration: 1 }, 0.55)
          // Models rise once the arch is in (see Cutout: CSS transition keyed to `open`).
          .call(() => setOpen(true), undefined, 0.7);

        const drift = { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: 1 };
        gsap.to(q('[data-anim=mandala]'), { rotation: 50, ease: 'none', scrollTrigger: drift });
        gsap.fromTo(q('[data-anim=arch-wrap]'), { y: 24 }, { y: -24, ease: 'none', scrollTrigger: { ...drift } });
      });
      // Reduced motion: no opening sequence, models are simply there.
      mm.add('(prefers-reduced-motion: reduce)', () => setOpen(true));
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative mt-16 h-[340px] overflow-x-clip sm:mt-20 sm:h-[400px] lg:mt-24 lg:h-[440px]">
      {/* Band (clipped) */}
      <div data-anim="band" className="absolute inset-0 overflow-hidden" style={{ backgroundColor: theme.base }}>
        <ButiPattern id={`buti-${id}`} />
        <div
          className={`absolute bottom-0 h-[130%] w-[70%] ${flip ? 'left-0' : 'right-0'}`}
          style={{ background: `radial-gradient(closest-side, ${theme.glow} 0%, transparent 100%)` }}
          aria-hidden="true"
        />
        {/* Large mandala half-hidden behind the heading side */}
        <Mandala
          className={`absolute top-1/2 hidden h-[150%] -translate-y-1/2 opacity-[0.16] md:block ${
            flip ? '-right-[10%]' : '-left-[10%]'
          }`}
        />
        <Toran id={`toran-${id}`} />
        <PaisleyBorder id={`paisley-${id}`} />
      </div>

      <div className={`relative mx-auto flex h-full max-w-7xl items-stretch px-4 sm:px-6 lg:px-8 ${flip ? 'flex-row-reverse' : ''}`}>
        {/* Heading */}
        <div className={`relative z-20 flex ${theme.fitMobile ? 'w-[52%]' : 'w-[58%]'} flex-col justify-center sm:w-1/2 lg:w-[44%] ${flip ? 'items-end text-right' : 'items-start'}`}>
          <h2 id={id} className="flex flex-col leading-none">
            <span
              data-anim="script"
              className="-mx-[0.15em] -mb-[0.3em] -mt-[0.3em] bg-clip-text px-[0.15em] pb-[0.15em] pt-[0.3em] font-script text-6xl text-transparent sm:text-8xl lg:text-9xl"
              style={{ backgroundImage: GOLD_TEXT }}
            >
              {theme.script}
            </span>
            <span
              data-anim="caps"
              className={`whitespace-nowrap font-display font-medium uppercase text-[#f6ead2] sm:text-6xl sm:tracking-[0.12em] lg:text-7xl ${
                theme.fitMobile && theme.caps.length > 4 ? 'text-2xl tracking-[0.1em]' : 'text-4xl tracking-[0.12em]'
              }`}
            >
              {theme.caps}
            </span>
          </h2>
          <LotusDivider className="mt-3 hidden h-auto w-40 sm:block lg:w-[220px]" />
          <p data-anim="copy" className="mt-3 hidden max-w-xs text-base text-[#f6ead2]/80 sm:block">{theme.line}</p>
          <Link
            data-anim="copy"
            to={viewAllTo}
            className="mt-5 inline-flex h-10 items-center rounded-full border border-[#e2c27a]/70 px-5 text-sm font-medium text-[#f6ead2] transition-colors hover:bg-[#e2c27a] hover:text-[#1a1410] sm:mt-6 sm:h-11"
          >
            View all {theme.script.toLowerCase()} {theme.caps.toLowerCase()}
          </Link>
        </div>

        {/* Stage: arch + models. Not clipped, so the tallest figure rises above the band. */}
        <div className="relative flex-1">
          <div data-anim="arch-wrap" className="absolute inset-0">
            <div data-anim="arch" className="absolute inset-0">
              <Arch id={id} className="absolute bottom-0 left-1/2 h-[92%] -translate-x-1/2 opacity-80" />
            </div>
          </div>
          <div
            className="absolute bottom-2 left-1/2 h-6 w-[80%] -translate-x-1/2 rounded-[50%] bg-black/40 blur-xl"
            aria-hidden="true"
          />
          {/* Clipped only at the band floor, so models rise from behind it but heads can still break out on top. */}
          {theme.fitMobile ? (
            // Phones: both models are sized by height. The main one stands next to the heading and the
            // second stands just behind her on the outer side (overlapping a little), and may run past
            // the screen edge. Tablet and up is the same three-model line-up as below.
            <div
              className={`absolute inset-x-0 bottom-0 flex h-full items-end justify-start [clip-path:inset(-60%_-200%_0_-200%)] md:flex-row md:justify-center md:[clip-path:inset(-60%_-20%_0_-20%)] ${
                flip ? 'flex-row-reverse' : ''
              }`}
            >
              <Cutout candidates={slot(1)} open={open} delay={140} className="relative z-0 -mr-8 hidden h-[96%] w-auto max-w-[34%] md:block lg:-mr-12" />
              <Cutout candidates={slot(0)} open={open} brightness={theme.centerBrightness} className="relative z-10 h-[104%] w-auto max-w-none shrink-0 sm:h-[118%] md:max-w-[40%] md:shrink" />
              <Cutout
                candidates={slot(2)}
                open={open}
                delay={280}
                className={`relative z-0 h-[62%] w-auto max-w-none shrink-0 md:h-[90%] md:max-w-[34%] md:shrink md:-ml-6 lg:-ml-12 ${
                  flip ? '-mr-12 md:mr-0' : '-ml-12'
                }`}
              />
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 flex h-full items-end justify-center [clip-path:inset(-60%_-20%_0_-20%)]">
              <Cutout candidates={slot(1)} open={open} delay={140} className="relative z-0 -mr-8 hidden h-[96%] w-auto max-w-[34%] md:block lg:-mr-12" />
              <Cutout candidates={slot(0)} open={open} brightness={theme.centerBrightness} className="relative z-10 h-[112%] w-auto max-w-[70%] sm:h-[118%] md:max-w-[40%]" />
              <Cutout candidates={slot(2)} open={open} delay={280} className="relative z-0 -ml-6 h-[90%] w-auto max-w-[48%] md:max-w-[34%] lg:-ml-12" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionBanner;
