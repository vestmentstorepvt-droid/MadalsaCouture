import { useCallback, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertCircle, Heart, MapPin, Package, UserRound, type LucideIcon } from 'lucide-react';

/* Shared pieces for the customer account area (profile, orders, wishlist, addresses). */

export const ACCOUNT_LINKS: { label: string; path: string; icon: LucideIcon; hint: string }[] = [
  { label: 'My profile', path: '/profile', icon: UserRound, hint: 'Name, photo, email and password' },
  { label: 'My orders', path: '/my-orders', icon: Package, hint: 'Track, cancel or exchange' },
  { label: 'Wishlist', path: '/wishlist', icon: Heart, hint: 'Pieces you saved' },
  { label: 'Saved addresses', path: '/addresses', icon: MapPin, hint: 'Where we deliver' },
];

/** Square, face-centred crop for Cloudinary photos; other URLs are used as they are. */
export function avatarSrc(url: string | null | undefined, size: number) {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    const px = Math.round(size * 2);
    return url.replace('/upload/', `/upload/c_fill,g_face,w_${px},h_${px},f_auto,q_auto/`);
  }
  return url;
}

const initialsOf = (name?: string | null) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || 'U';

export const Avatar = ({
  name,
  src,
  size = 40,
  className = '',
  tone = 'ink',
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
  tone?: 'ink' | 'gold';
}) => {
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = !!src && broken !== src;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium select-none ${
        tone === 'gold' ? 'bg-gold text-ink' : 'bg-ink text-white'
      } ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={avatarSrc(src, size)}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(src ?? null)}
          draggable={false}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
};

/** Page title row inside the account area. */
export const AccountHeading = ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="font-display text-3xl font-medium leading-tight text-ink sm:text-4xl">{title}</h1>
      {description ? <p className="mt-1.5 max-w-prose text-sm text-mute">{description}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

/** A titled block of content. */
export const Panel = ({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`rounded-2xl border border-hairline bg-surface ${className}`}>
    {title || action ? (
      <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
        <div className="min-w-0">
          {title ? <h2 className="text-base font-medium text-ink">{title}</h2> : null}
          {description ? <p className="mt-0.5 text-sm text-mute">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    ) : null}
    <div className="px-5 py-5 sm:px-6">{children}</div>
  </section>
);

export const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
export const btnSecondary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-hairline-strong bg-surface px-6 text-sm font-medium text-ink transition-colors hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
export const btnSmall =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-hairline-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
export const fieldClass =
  'h-11 w-full rounded-xl border border-hairline-strong bg-surface px-3.5 text-base text-ink outline-none transition placeholder:text-faint focus:border-ink focus:ring-2 focus:ring-ink/10 sm:text-sm read-only:border-hairline read-only:bg-canvas read-only:text-mute';
export const fieldErrorClass = 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-200';
export const labelClass = 'mb-1.5 block text-sm font-medium text-ink';

export const FormMessage = ({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) => (
  <p
    role={tone === 'error' ? 'alert' : 'status'}
    className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${
      tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
    }`}
  >
    {tone === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
    <span>{children}</span>
  </p>
);

/* ── Toast ─────────────────────────────────────────────────────────────────── */

type Toast = { message: string; type: 'success' | 'error'; id: number };

export function useAccountToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToast({ message, type, id });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
  }, []);
  const node =
    toast && typeof document !== 'undefined'
      ? createPortal(
          <div className="pointer-events-none fixed inset-x-4 bottom-5 z-[90] flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end">
            <div
              role={toast.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              >
                {toast.type === 'success' ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              </span>
              {toast.message}
            </div>
          </div>,
          document.body,
        )
      : null;
  return { show, node };
}

/* ── Dialog shell ──────────────────────────────────────────────────────────── */

export const Dialog = ({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) => {
  if (typeof document === 'undefined') return null;
  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl ${width}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-2xl font-medium text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-mute">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-mute transition-colors hover:bg-hairline-soft hover:text-ink"
            aria-label="Close"
          >
            <span aria-hidden="true" className="text-xl leading-none">×</span>
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <footer className="flex justify-end gap-2 border-t border-hairline px-5 py-4 sm:px-6">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
};
