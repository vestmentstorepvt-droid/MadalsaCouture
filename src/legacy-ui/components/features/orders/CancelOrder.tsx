import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info, Ruler, ShoppingBag, Truck, X } from 'lucide-react';
import { useGetSizeOptionsQuery, useRequestSizeChangeMutation, type Order } from '../../../services/ordersApi';
import { optimizeImage } from '../../../utils/imageUtils';
import {
  CANCEL_NOTE_MAX,
  CANCEL_REASONS,
  CUSTOMER_CANCELLABLE_STATUSES,
  cancelReasonLabel,
} from '../../../../shared/cancelReasons';

// Plain Tailwind colours (no theme tokens) so this works on both the live site and the redesign.

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const formatDateTime = (s: string) =>
  new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const SHIPPED_STATUSES = ['Shipped', 'OutForDelivery', 'FailedDelivery'];

/** Can the customer still cancel? Not once a courier is assigned (AWB) or the parcel has left. */
export function cancelState(order: Order): 'can_cancel' | 'with_courier' | 'none' {
  if (order.status === 'Cancelled') return 'none';
  const withCourier = !!order.shiprocketShipping?.awb || SHIPPED_STATUSES.includes(order.status);
  if (withCourier) return 'with_courier';
  return CUSTOMER_CANCELLABLE_STATUSES.includes(order.status) ? 'can_cancel' : 'none';
}

/** One line under the order: until when it can be cancelled, or why it can't be any more. */
export const CancelHint: React.FC<{ order: Order }> = ({ order }) => {
  const state = cancelState(order);
  if (state === 'can_cancel') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        You can cancel until your order is handed to the courier.
      </p>
    );
  }
  if (state === 'with_courier') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Already with the courier, so it can't be cancelled here.{' '}
        <Link to="/contact" className="font-semibold text-slate-800 underline underline-offset-2">
          Contact support
        </Link>
      </p>
    );
  }
  return null;
};

/** On a cancelled order: when, and why. */
export const CancellationNote: React.FC<{ order: Order }> = ({ order }) => {
  if (order.status !== 'Cancelled') return null;
  const c = order.cancellation;
  const when = c?.at || order.statusHistory?.find((h) => h.status === 'Cancelled')?.timestamp;
  const reason = c ? cancelReasonLabel(c.reason) || c.reasonLabel : null;
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
      <p className="font-semibold">
        Cancelled{when ? ` on ${formatDateTime(when)}` : ''}
        {c?.by === 'customer' ? ' by you' : ''}
      </p>
      {reason && (
        <p className="mt-0.5 text-rose-800">
          Reason: {reason}
          {c?.note ? `: ${c.note}` : ''}
        </p>
      )}
      <p className="mt-1 text-rose-700">
        {order.paymentMethod === 'online'
          ? 'Your refund goes back to your original payment method within 5–7 working days.'
          : 'Cash on Delivery: nothing was charged, so there is nothing to refund.'}
      </p>
    </div>
  );
};

/** On an order with a size change waiting for the team. */
export const SizeChangeNote: React.FC<{ order: Order }> = ({ order }) => {
  const r = order.sizeChangeRequest;
  if (!r || r.status !== 'pending' || order.status === 'Cancelled') return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <p className="font-semibold">Size change requested on {formatDateTime(r.at)}</p>
      {r.changes.map((c) => (
        <p key={c.itemId} className="mt-0.5">
          {c.productTitle}: {c.fromSize || '—'} → {c.toSize}
        </p>
      ))}
      <p className="mt-1 text-amber-800">Our team will confirm the swap with you before your order ships.</p>
    </div>
  );
};

/* ── Small pieces ──────────────────────────────────────────────────────────── */

const ItemRow: React.FC<{ item: Order['items'][number] }> = ({ item }) => {
  const img = item.productImage || item.image || '';
  return (
    <li className="flex items-center gap-3">
      <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {img ? (
          <img src={optimizeImage(img, 120)} alt="" className="h-full w-full object-cover" />
        ) : (
          <ShoppingBag className="m-auto mt-4 h-5 w-5 text-slate-300" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{item.productTitle || item.name}</p>
        <p className="text-xs text-slate-500">
          {[item.size && `Size ${item.size}`, item.color].filter(Boolean).join(' · ')}
          {item.size || item.color ? ' · ' : ''}Qty {item.quantity}
        </p>
      </div>
      <p className="text-sm text-slate-700">{formatINR((item.unitPrice ?? 0) * item.quantity)}</p>
    </li>
  );
};

/** Which step of the sheet is showing. */
const STEP_TITLES = ['Reason', 'Review', 'Confirm'] as const;
const Steps: React.FC<{ current: number }> = ({ current }) => (
  <ol className="flex items-center gap-2 text-xs" aria-label="Steps">
    {STEP_TITLES.map((t, i) => (
      <li key={t} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
            i < current ? 'bg-slate-900 text-white' : i === current ? 'bg-rose-700 text-white' : 'border border-slate-300 bg-white text-slate-700'
          }`}
        >
          {i + 1}
        </span>
        <span className={i === current ? 'font-medium text-slate-900' : 'text-slate-500'}>{t}</span>
        {i < STEP_TITLES.length - 1 && <span className="h-px w-5 bg-slate-300" aria-hidden="true" />}
      </li>
    ))}
  </ol>
);

/** Spinner shown while the cancellation runs (the courier booking is cancelled too). */
const Working: React.FC<{ title: string; lines: string[] }> = ({ title, lines }) => {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setLine((l) => Math.min(l + 1, lines.length - 1)), 1100);
    return () => window.clearInterval(t);
  }, [lines.length]);
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center" role="status" aria-live="polite">
      <span className="relative h-16 w-16" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-4 border-slate-200" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-rose-700 motion-reduce:animate-none" />
        <span className="absolute inset-[22px] animate-pulse rounded-full bg-rose-700/80 motion-reduce:animate-none" />
      </span>
      <p className="mt-6 text-base font-semibold text-slate-900">{title}</p>
      <p key={line} className="cancel-fade-in mt-1 text-sm text-slate-500">
        {lines[line]}
      </p>
    </div>
  );
};

/** Drawn tick (or a soft amber one for "request sent"). */
const Done: React.FC<{ tone: 'rose' | 'amber'; title: string; children: React.ReactNode; onClose: () => void }> = ({
  tone,
  title,
  children,
  onClose,
}) => (
  <div className="flex flex-col items-center px-6 py-10 text-center">
    <svg viewBox="0 0 64 64" className="cancel-pop h-16 w-16" aria-hidden="true">
      <circle cx="32" cy="32" r="30" className={tone === 'rose' ? 'fill-rose-50 stroke-rose-700' : 'fill-amber-50 stroke-amber-600'} strokeWidth="3" />
      <path
        d="M19 33 l9 9 l17 -19"
        fill="none"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`cancel-draw ${tone === 'rose' ? 'stroke-rose-700' : 'stroke-amber-600'}`}
      />
    </svg>
    <p className="mt-5 text-lg font-semibold text-slate-900">{title}</p>
    <div className="mt-2 max-w-sm text-sm text-slate-600">{children}</div>
    <button
      type="button"
      onClick={onClose}
      autoFocus
      className="mt-6 h-11 rounded-full bg-slate-900 px-8 text-sm font-medium text-white hover:bg-slate-800"
    >
      Done
    </button>
  </div>
);

/* ── Change size instead ───────────────────────────────────────────────────── */

const SizeChangeStep: React.FC<{
  order: Order;
  onBack: () => void;
  onCancelInstead: () => void;
  onSent: () => void;
}> = ({ order, onBack, onCancelInstead, onSent }) => {
  const { data, isLoading, isError } = useGetSizeOptionsQuery(order._id);
  const [requestSizeChange, { isLoading: isSending }] = useRequestSizeChangeMutation();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const changes = Object.entries(picked).map(([itemId, variantId]) => ({ itemId, variantId }));

  const send = async () => {
    setError(null);
    if (!changes.length) {
      setError('Choose the new size first.');
      return;
    }
    try {
      await requestSizeChange({ id: order._id, changes, note: note.trim() || undefined }).unwrap();
      onSent();
    } catch (err) {
      const e = err as { data?: { error?: { message?: string }; message?: string } };
      setError(e?.data?.error?.message || e?.data?.message || 'Could not send the request. Please try again.');
    }
  };

  if (isSending) return <Working title="Sending your request" lines={['Telling our team which size you want…']} />;

  return (
    <>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <p className="text-sm text-slate-600">
          Keep your order and we'll swap the size before it ships. Your request goes to our team straight away.
        </p>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : isError || !data ? (
          <p className="text-sm text-rose-700">We couldn't load the sizes. You can still cancel the order.</p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-slate-600">These pieces come in one size only.</p>
        ) : (
          data.items.map((item) => (
            <fieldset key={item.itemId}>
              <legend className="text-sm font-semibold text-slate-900">
                {item.productTitle}
                <span className="ml-1 font-normal text-slate-500">· now {item.currentSize || '—'}</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.options.map((o) => {
                  const selected = picked[item.itemId] === o.variantId;
                  return (
                    <button
                      key={o.variantId}
                      type="button"
                      disabled={o.current || !o.available}
                      onClick={() => setPicked((p) => ({ ...p, [item.itemId]: o.variantId }))}
                      aria-pressed={selected}
                      title={o.current ? 'Your current size' : !o.available ? 'Out of stock' : undefined}
                      className={`h-10 min-w-12 rounded-lg border px-3 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : o.current
                            ? 'border-slate-300 bg-slate-100 text-slate-400'
                            : !o.available
                              ? 'border-slate-200 text-slate-300 line-through'
                              : 'border-slate-300 text-slate-800 hover:border-slate-900'
                      }`}
                    >
                      {o.size}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))
        )}
        <div>
          <label htmlFor="size-note" className="text-xs font-medium text-slate-700">
            Anything we should know? <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="size-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, CANCEL_NOTE_MAX))}
            placeholder="For example, it runs small on me"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
          />
        </div>
        {error && (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {error}
          </p>
        )}
        <button type="button" onClick={onCancelInstead} className="text-sm font-medium text-rose-700 underline underline-offset-4">
          I'd still rather cancel the order
        </button>
      </div>
      <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-slate-300 px-5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={() => void send()}
          disabled={!changes.length}
          className="h-11 flex-1 rounded-full bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Request this size
        </button>
      </div>
    </>
  );
};

/* ── The sheet ─────────────────────────────────────────────────────────────── */

type Step = 'reason' | 'size' | 'review' | 'confirm' | 'working' | 'cancelled' | 'sizeSent';

/**
 * Cancel an order in three steps (reason → review → confirm), the way the big marketplaces do it.
 * Choosing "different size" offers a size swap instead, sent to the team straight away.
 * `onConfirm` cancels and resolves when done (or rejects with the server's message).
 * A bottom sheet on phones, a centred dialog from tablet up.
 */
export const CancelOrderSheet: React.FC<{
  order: Order | null;
  onConfirm: (reason: string, note: string) => Promise<void>;
  onClose: () => void;
}> = ({ order, onConfirm, onClose }) => {
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const firstOption = useRef<HTMLInputElement>(null);
  const busy = step === 'working';

  // Fresh form for each order; focus the first reason; Escape closes; page doesn't scroll behind.
  useEffect(() => {
    if (!order) return;
    setStep('reason');
    setReason('');
    setNote('');
    setTried(false);
    setError(null);
    firstOption.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?._id]);

  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, busy, onClose]);

  if (!order) return null;

  const needsNote = reason === 'other';
  const missingReason = !reason;
  const missingNote = needsNote && !note.trim();
  const reasonText = cancelReasonLabel(reason);
  const refundLine =
    order.paymentMethod === 'cod'
      ? 'Cash on Delivery: nothing has been charged, so there is nothing to refund.'
      : `${formatINR(order.total)} goes back to your original payment method within 5–7 working days.`;

  const toReview = () => {
    setTried(true);
    if (missingReason || missingNote) return;
    setStep('review');
  };

  const cancelNow = async () => {
    setError(null);
    setStep('working');
    const started = Date.now();
    try {
      await onConfirm(reason, note.trim());
      // Let the animation finish a beat even when the server is quick.
      const wait = Math.max(0, 1600 - (Date.now() - started));
      window.setTimeout(() => setStep('cancelled'), wait);
    } catch (err) {
      setError((err as Error)?.message || 'Could not cancel the order. Please try again.');
      setStep('confirm');
    }
  };

  const stepIndex = step === 'reason' ? 0 : step === 'review' ? 1 : 2;
  const showHeader = step !== 'working' && step !== 'cancelled' && step !== 'sizeSent';

  // Rendered into <body>: the account pages sit in their own stacking context, which would
  // otherwise leave the site header above the backdrop.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        {showHeader && (
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold text-slate-900">
                  {step === 'size' ? 'Change the size instead' : `Cancel order #${order.orderNumber}`}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {order.items.length} {order.items.length === 1 ? 'item' : 'items'} · {formatINR(order.total)} ·{' '}
                  {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {step !== 'size' && (
              <div className="mt-3">
                <Steps current={stepIndex} />
              </div>
            )}
          </div>
        )}
        {!showHeader && (
          <h2 id={titleId} className="sr-only">
            Cancel order #{order.orderNumber}
          </h2>
        )}

        {/* 1. Reason */}
        {step === 'reason' && (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900">Why do you want to cancel?</legend>
                <div className="mt-2 space-y-1.5">
                  {CANCEL_REASONS.map((r, i) => (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                        reason === r.id ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        ref={i === 0 ? firstOption : undefined}
                        type="radio"
                        name="cancel-reason"
                        value={r.id}
                        checked={reason === r.id}
                        onChange={() => setReason(r.id)}
                        className="h-4 w-4 accent-slate-900"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                {tried && missingReason && (
                  <p role="alert" className="mt-2 text-xs font-medium text-rose-700">
                    Choose a reason to continue.
                  </p>
                )}
              </fieldset>

              {reason === 'size_or_colour' && (
                <div className="cancel-fade-in flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <Ruler className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900">Keep your order, change the size</p>
                    <p className="mt-0.5 text-amber-800">We can swap it before it ships. No need to cancel and order again.</p>
                    <button
                      type="button"
                      onClick={() => setStep('size')}
                      className="mt-2.5 h-9 rounded-full bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-800"
                    >
                      Change size instead
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="cancel-note" className="text-xs font-medium text-slate-700">
                  {needsNote ? 'Tell us a little more' : 'Anything else?'}{' '}
                  {!needsNote && <span className="font-normal text-slate-500">(optional)</span>}
                </label>
                <textarea
                  id="cancel-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, CANCEL_NOTE_MAX))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                  placeholder={needsNote ? 'What made you change your mind?' : 'Optional'}
                />
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-rose-700">{tried && missingNote ? 'Please add a short reason.' : ''}</span>
                  <span className="text-slate-400">
                    {note.length}/{CANCEL_NOTE_MAX}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="h-11 flex-1 rounded-full border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={toReview}
                className="h-11 flex-1 rounded-full bg-slate-900 text-sm font-medium text-white hover:bg-slate-800"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Size swap instead of cancelling */}
        {step === 'size' && (
          <SizeChangeStep
            order={order}
            onBack={() => setStep('reason')}
            onCancelInstead={() => setStep('review')}
            onSent={() => setStep('sizeSent')}
          />
        )}

        {/* 2. Review */}
        {step === 'review' && (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">You're cancelling</p>
              <ul className="space-y-2">
                {order.items.map((item, i) => (
                  <ItemRow key={i} item={item} />
                ))}
              </ul>
              <dl className="space-y-2 rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Reason</dt>
                  <dd className="text-right text-slate-900">
                    {reasonText}
                    {note.trim() ? `: ${note.trim()}` : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Order total</dt>
                  <dd className="text-slate-900">{formatINR(order.total)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Refund</dt>
                  <dd className="text-right text-slate-900">{order.paymentMethod === 'cod' ? 'Nothing to refund (COD)' : `${formatINR(order.total)} to your original payment method`}</dd>
                </div>
              </dl>
            </div>
            <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setStep('reason')}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-slate-300 px-5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="h-11 flex-1 rounded-full bg-slate-900 text-sm font-medium text-white hover:bg-slate-800"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* 3. Final confirmation */}
        {step === 'confirm' && (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
              <p className="text-base font-semibold text-slate-900">Cancel this order?</p>
              <p className="text-sm text-slate-600">
                Order #{order.orderNumber} will be cancelled and the courier booking withdrawn. This can't be undone. {refundLine} We'll email you a
                confirmation.
              </p>
              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="h-11 flex-1 rounded-full border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={() => void cancelNow()}
                className="h-11 flex-1 rounded-full bg-rose-700 text-sm font-medium text-white hover:bg-rose-800"
              >
                Yes, cancel order
              </button>
            </div>
          </>
        )}

        {step === 'working' && (
          <Working
            title="Cancelling your order"
            lines={['Withdrawing the courier booking…', 'Putting the pieces back in stock…', 'Sending your confirmation…']}
          />
        )}

        {step === 'cancelled' && (
          <Done tone="rose" title="Order cancelled" onClose={onClose}>
            <p>Order #{order.orderNumber} is cancelled. {refundLine}</p>
            <p className="mt-1">A confirmation is on its way to your email.</p>
          </Done>
        )}

        {step === 'sizeSent' && (
          <Done tone="amber" title="Size change requested" onClose={onClose}>
            <p>Our team has your request and will confirm the new size with you before order #{order.orderNumber} ships.</p>
          </Done>
        )}
      </div>
    </div>,
    document.body,
  );
};
