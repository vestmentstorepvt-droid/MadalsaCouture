import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Info, RefreshCw, ShoppingBag, Truck, X } from 'lucide-react';
import type { Order } from '../../../services/ordersApi';
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

/**
 * The "Cancel order" sheet: what's being cancelled, a required reason, and what happens to the money.
 * A bottom sheet on phones, a centred dialog from tablet up.
 */
export const CancelOrderSheet: React.FC<{
  order: Order | null;
  isSubmitting: boolean;
  onConfirm: (reason: string, note: string) => void;
  onClose: () => void;
}> = ({ order, isSubmitting, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const titleId = useId();
  const firstOption = useRef<HTMLInputElement>(null);

  // Fresh form for each order; focus the first reason; Escape closes; page doesn't scroll behind.
  useEffect(() => {
    if (!order) return;
    setReason('');
    setNote('');
    setTried(false);
    firstOption.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?._id]);

  if (!order) return null;

  const needsNote = reason === 'other';
  const missingReason = !reason;
  const missingNote = needsNote && !note.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (missingReason || missingNote || isSubmitting) return;
    onConfirm(reason, note.trim());
  };

  // Rendered into <body>: the account pages sit in their own stacking context, which would
  // otherwise leave the site header above the backdrop.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => !isSubmitting && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Cancel order #{order.orderNumber}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {order.items.length} {order.items.length === 1 ? 'item' : 'items'} · {formatINR(order.total)} ·{' '}
              {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="-mr-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* What's being cancelled */}
          <ul className="space-y-2">
            {order.items.map((item, i) => {
              const img = item.productImage || item.image || '';
              return (
                <li key={i} className="flex items-center gap-3">
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
                      {[item.size, item.color].filter(Boolean).join(' · ')}
                      {item.size || item.color ? ' · ' : ''}Qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm text-slate-700">{formatINR((item.unitPrice ?? 0) * item.quantity)}</p>
                </li>
              );
            })}
          </ul>

          {/* Why */}
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900">Why are you cancelling?</legend>
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
            {needsNote && (
              <div className="mt-3">
                <label htmlFor="cancel-note" className="text-xs font-medium text-slate-700">
                  Tell us a little more
                </label>
                <textarea
                  id="cancel-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, CANCEL_NOTE_MAX))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
                  placeholder="What made you change your mind?"
                />
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-rose-700">{tried && missingNote ? 'Please add a short reason.' : ''}</span>
                  <span className="text-slate-400">
                    {note.length}/{CANCEL_NOTE_MAX}
                  </span>
                </div>
              </div>
            )}
          </fieldset>

          {/* What happens to the money */}
          <div className="flex gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            <p>
              {order.paymentMethod === 'cod'
                ? 'This is a Cash on Delivery order: nothing has been charged, so there is nothing to refund.'
                : `Your refund of ${formatINR(order.total)} goes back to your original payment method within 5–7 working days.`}{' '}
              We'll email you a confirmation.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-11 flex-1 rounded-full border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Keep order
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-rose-700 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-60"
          >
            {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Cancelling…' : 'Cancel order'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};
