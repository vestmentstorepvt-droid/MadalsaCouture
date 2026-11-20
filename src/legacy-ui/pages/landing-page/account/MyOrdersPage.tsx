import React, { useMemo, useState, type FormEvent } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ChevronDown, Loader2, Package, RotateCcw, Search, ShoppingBag } from 'lucide-react';
import type { RootState } from '../../../store';
import {
  useGetMyOrdersQuery,
  useCancelOrderMutation,
  useRequestExchangeMutation,
  type Order,
  type OrderItem,
} from '../../../services/ordersApi';
import { optimizeImage } from '../../../utils/imageUtils';
import { CancelHint, CancelOrderSheet, CancellationNote, cancelState } from '../../../components/features/orders/CancelOrder';
import {
  AccountHeading,
  Dialog,
  Panel,
  btnPrimary,
  btnSecondary,
  btnSmall,
  fieldClass,
  labelClass,
  useAccountToast,
} from '../../../components/features/account/AccountUI';

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const formatDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const formatDateTime = (s: string) =>
  new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const itemImage = (i: OrderItem) => i.productImage || i.image || '';
const itemName = (i: OrderItem) => i.productTitle || i.name || 'Product';

/** Customer-facing wording and tone for each order status. */
const STATUS: Record<string, { label: string; tone: string }> = {
  Created: { label: 'Order placed', tone: 'bg-hairline-soft text-ink' },
  Pending: { label: 'Order placed', tone: 'bg-hairline-soft text-ink' },
  Paid: { label: 'Confirmed', tone: 'bg-hairline-soft text-ink' },
  Processing: { label: 'Being prepared', tone: 'bg-amber-50 text-amber-800' },
  Packed: { label: 'Packed', tone: 'bg-amber-50 text-amber-800' },
  ReadyToShip: { label: 'Ready to ship', tone: 'bg-amber-50 text-amber-800' },
  Shipped: { label: 'Shipped', tone: 'bg-sky-50 text-sky-800' },
  OutForDelivery: { label: 'Out for delivery', tone: 'bg-sky-50 text-sky-800' },
  Delivered: { label: 'Delivered', tone: 'bg-emerald-50 text-emerald-800' },
  Cancelled: { label: 'Cancelled', tone: 'bg-rose-50 text-rose-700' },
  Refunded: { label: 'Refunded', tone: 'bg-rose-50 text-rose-700' },
};
const statusOf = (s: string) => STATUS[s] ?? { label: s, tone: 'bg-hairline-soft text-ink' };

const FILTERS = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'open', label: 'In progress', match: (o: Order) => !['Delivered', 'Cancelled', 'Refunded'].includes(o.status) },
  { value: 'delivered', label: 'Delivered', match: (o: Order) => o.status === 'Delivered' },
  { value: 'cancelled', label: 'Cancelled', match: (o: Order) => o.status === 'Cancelled' || o.status === 'Refunded' },
] as const;
type FilterValue = (typeof FILTERS)[number]['value'];

// ── Exchange dialog ────────────────────────────────────────────────────────────
const EXCHANGE_REASONS = [
  'Size issue (Too large / Too small)',
  'Color preference',
  'Defective or damaged item',
  'Fabric / fit preference',
  'Wrong item received',
  'Changed mind / Other',
];

const ExchangeDialog: React.FC<{
  item: OrderItem;
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}> = ({ item, isSubmitting, onConfirm, onCancel }) => {
  const [category, setCategory] = useState(EXCHANGE_REASONS[0]!);
  const [requestedSize, setRequestedSize] = useState('');
  const [details, setDetails] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parts = [category];
    if (requestedSize.trim()) parts.push(`Requested replacement: ${requestedSize.trim()}`);
    if (details.trim()) parts.push(`Notes: ${details.trim()}`);
    onConfirm(parts.join(' - '));
  };

  return (
    <Dialog
      title="Exchange an item"
      description="Tell us what’s wrong and what you’d like instead. We’ll arrange a pickup."
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={isSubmitting} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form="exchange-form" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Sending request' : 'Request exchange'}
          </button>
        </>
      }
    >
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-canvas p-3">
        <span className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-hairline-soft">
          {itemImage(item) ? <img src={optimizeImage(itemImage(item), 160)} alt="" className="h-full w-full object-cover" /> : null}
        </span>
        <span className="min-w-0 text-sm">
          <span className="block truncate font-medium text-ink">{itemName(item)}</span>
          <span className="block text-mute">
            {[item.size && `Size ${item.size}`, item.color, `Qty ${item.quantity}`].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>
      <form id="exchange-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="exchange-reason" className={labelClass}>
            Reason
          </label>
          <select id="exchange-reason" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
            {EXCHANGE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="exchange-size" className={labelClass}>
            What would you like instead? <span className="font-normal text-mute">(optional)</span>
          </label>
          <input
            id="exchange-size"
            value={requestedSize}
            onChange={(e) => setRequestedSize(e.target.value)}
            placeholder="For example, size L instead of M"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="exchange-notes" className={labelClass}>
            Anything else <span className="font-normal text-mute">(optional)</span>
          </label>
          <textarea
            id="exchange-notes"
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Fit, defect location, or anything our team should know"
            className={`${fieldClass} h-auto py-2.5`}
          />
        </div>
      </form>
    </Dialog>
  );
};

// ── Order card ────────────────────────────────────────────────────────────────
const OrderCard: React.FC<{
  order: Order;
  onCancel: (id: string) => void;
  onExchange: (order: Order, item: OrderItem) => void;
  isCancelling: boolean;
}> = ({ order, onCancel, onExchange, isCancelling }) => {
  const [expanded, setExpanded] = useState(false);
  const status = statusOf(order.status);
  const canCancel = cancelState(order) === 'can_cancel';
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  const detailsId = `order-${order._id}-details`;
  const address = order.shippingAddress;

  return (
    <li className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      {/* Summary */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Order {order.orderNumber}</p>
          <p className="text-sm text-mute">
            Placed {formatDate(order.createdAt)} · {units} {units === 1 ? 'item' : 'items'} · {formatINR(order.total)}
          </p>
        </div>
        <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium ${status.tone}`}>{status.label}</span>
      </div>

      <ul className="scrollbar-hide flex gap-3 overflow-x-auto px-5 py-4 sm:px-6">
        {order.items.map((item, idx) => (
          <li key={idx} className="flex w-[min(100%,280px)] shrink-0 items-center gap-3">
            <span className="h-20 w-15 shrink-0 overflow-hidden rounded-lg bg-hairline-soft" style={{ width: 60 }}>
              {itemImage(item) ? (
                <img src={optimizeImage(itemImage(item), 160)} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="flex h-full items-center justify-center text-faint">
                  <ShoppingBag className="h-5 w-5" />
                </span>
              )}
            </span>
            <span className="min-w-0 text-sm">
              <span className="line-clamp-2 text-ink">{itemName(item)}</span>
              <span className="block text-mute">
                {[item.size && `Size ${item.size}`, item.quantity > 1 && `Qty ${item.quantity}`].filter(Boolean).join(' · ') || formatINR(item.unitPrice)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {order.status === 'Cancelled' ? (
        <div className="px-5 pb-4 sm:px-6">
          <CancellationNote order={order} />
        </div>
      ) : null}

      {/* Details */}
      {expanded ? (
        <div id={detailsId} className="grid gap-6 border-t border-hairline bg-canvas px-5 py-5 sm:px-6 md:grid-cols-2">
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-medium text-ink">Items</h3>
              <ul className="mt-2 divide-y divide-hairline">
                {order.items.map((item, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block text-ink">{itemName(item)}</span>
                      <span className="block text-mute">
                        {[item.size && `Size ${item.size}`, item.color, `Qty ${item.quantity}`].filter(Boolean).join(' · ')}
                      </span>
                      {order.status === 'Delivered' ? (
                        <button
                          type="button"
                          onClick={() => onExchange(order, item)}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline-offset-4 hover:underline"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Exchange
                        </button>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink">{formatINR(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-medium text-ink">Payment</h3>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between text-body">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatINR(order.subtotal)}</dd>
                </div>
                {order.discountAmount ? (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Discount</dt>
                    <dd className="tabular-nums">−{formatINR(order.discountAmount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between text-body">
                  <dt>Shipping</dt>
                  <dd className="tabular-nums">{order.shippingCharge ? formatINR(order.shippingCharge) : 'Free'}</dd>
                </div>
                <div className="flex justify-between border-t border-hairline pt-2 font-medium text-ink">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatINR(order.total)}</dd>
                </div>
                <p className="pt-1 text-mute">
                  {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'}
                  {order.paymentStatus ? ` · ${String(order.paymentStatus).toLowerCase()}` : ''}
                </p>
              </dl>
            </section>
          </div>

          <div className="space-y-6">
            {address ? (
              <section>
                <h3 className="text-sm font-medium text-ink">Delivering to</h3>
                <address className="mt-2 text-sm not-italic leading-6 text-body">
                  <span className="block text-ink">{address.name || address.fullName}</span>
                  {[address.line1 || address.addressLine, address.line2].filter(Boolean).join(', ')}
                  <br />
                  {[address.city, address.state, address.pincode].filter(Boolean).join(', ')}
                  <span className="block tabular-nums text-mute">{address.phone || address.deliveryPhone}</span>
                </address>
              </section>
            ) : null}

            {order.statusHistory?.length ? (
              <section>
                <h3 className="text-sm font-medium text-ink">Updates</h3>
                <ol className="relative mt-3 space-y-4 border-l border-hairline-strong pl-5">
                  {[...order.statusHistory].reverse().map((h, idx) => (
                    <li key={idx} className="relative text-sm">
                      <span
                        className={`absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ring-4 ring-canvas ${idx === 0 ? 'bg-ink' : 'bg-hairline-strong'}`}
                        aria-hidden="true"
                      />
                      <span className={`block ${idx === 0 ? 'font-medium text-ink' : 'text-body'}`}>{statusOf(h.status).label}</span>
                      <span className="block text-xs text-mute">{formatDateTime(h.timestamp)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-hairline px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="inline-flex h-9 items-center gap-1.5 text-sm font-medium text-ink"
        >
          {expanded ? 'Hide details' : 'View details'}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
          <CancelHint order={order} />
          {canCancel ? (
            <button
              type="button"
              onClick={() => onCancel(order._id)}
              disabled={isCancelling}
              className={`${btnSmall} text-rose-700 hover:bg-rose-50`}
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel order
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
};

const OrderSkeleton = () => (
  <ul className="space-y-4" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className="animate-pulse rounded-2xl border border-hairline bg-surface p-5">
        <div className="h-4 w-40 rounded-full bg-hairline-soft" />
        <div className="mt-2 h-4 w-60 rounded-full bg-hairline-soft" />
        <div className="mt-4 flex gap-3">
          <div className="h-20 w-15 rounded-lg bg-hairline-soft" style={{ width: 60 }} />
          <div className="h-20 w-15 rounded-lg bg-hairline-soft" style={{ width: 60 }} />
        </div>
      </li>
    ))}
  </ul>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 6;

const MyOrdersPage: React.FC = () => {
  const { show: toast, node: toastNode } = useAccountToast();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [exchangeTarget, setExchangeTarget] = useState<{ order: Order; item: OrderItem } | null>(null);

  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { data: allOrders = [], isLoading, isError, refetch } = useGetMyOrdersQuery({ limit: 100 }, { skip: !isAuthenticated });
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();
  const [requestExchange, { isLoading: isExchanging }] = useRequestExchangeMutation();

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.value, allOrders.filter(f.match).length])) as Record<FilterValue, number>,
    [allOrders],
  );

  const filtered = useMemo(() => {
    const match = FILTERS.find((f) => f.value === filter)!.match;
    const s = searchTerm.trim().toLowerCase();
    return allOrders
      .filter(match)
      .filter((o) => !s || o.orderNumber.toLowerCase().includes(s) || o.items.some((i) => itemName(i).toLowerCase().includes(s)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allOrders, filter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleCancel = async (reason: string, note: string) => {
    if (!cancelTarget) return;
    try {
      await cancelOrder({ id: cancelTarget, reason, note }).unwrap();
      toast('Your order is cancelled. We’ve emailed you a confirmation.');
      void refetch();
    } catch (err) {
      const e = err as { data?: { message?: string; error?: { message?: string } } };
      toast(e?.data?.error?.message ?? e?.data?.message ?? 'Could not cancel the order. Please try again.', 'error');
    } finally {
      setCancelTarget(null);
    }
  };

  const handleExchange = async (reason: string) => {
    if (!exchangeTarget) return;
    try {
      const itemId = exchangeTarget.item._id || exchangeTarget.item.variantId || exchangeTarget.item.productId;
      await requestExchange({
        orderId: exchangeTarget.order._id,
        itemId: typeof itemId === 'object' && itemId !== null ? String((itemId as { _id?: string })._id ?? '') : String(itemId),
        reason,
      }).unwrap();
      toast('Exchange requested. Our team will call you to arrange a pickup.');
      void refetch();
    } catch (err) {
      const e = err as { data?: { message?: string } };
      toast(e?.data?.message ?? 'Could not send the exchange request. Please try again.', 'error');
    } finally {
      setExchangeTarget(null);
    }
  };

  return (
    <>
      <AccountHeading title="My orders" description="Track deliveries, cancel before dispatch, or exchange a delivered piece." />

      {isLoading ? (
        <OrderSkeleton />
      ) : isError ? (
        <Panel>
          <div className="py-8 text-center">
            <p className="text-sm text-body">We couldn’t load your orders.</p>
            <button type="button" onClick={() => void refetch()} className={`${btnSecondary} mt-4`}>
              Try again
            </button>
          </div>
        </Panel>
      ) : allOrders.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hairline-soft text-ink">
              <Package className="h-6 w-6" />
            </span>
            <p className="mt-4 font-display text-2xl text-ink">No orders yet</p>
            <p className="mt-1 max-w-xs text-sm text-mute">When you place an order, you can track it here.</p>
            <Link to="/products" className={`${btnPrimary} mt-6`}>
              Start shopping
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div role="tablist" aria-label="Filter orders" className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              {FILTERS.map((f) => {
                const active = filter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setFilter(f.value);
                      setPage(1);
                    }}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                      active ? 'bg-ink text-white' : 'border border-hairline-strong bg-surface text-ink hover:bg-hairline-soft'
                    }`}
                  >
                    {f.label}
                    <span className={`tabular-nums ${active ? 'text-white/70' : 'text-mute'}`}>{counts[f.value]}</span>
                  </button>
                );
              })}
            </div>
            {allOrders.length > 3 ? (
              <label className="relative md:w-64">
                <span className="sr-only">Search orders</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" aria-hidden="true" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Order number or product"
                  className="h-10 w-full rounded-full border border-hairline-strong bg-surface pl-10 pr-4 text-base text-ink outline-none placeholder:text-faint focus:border-ink sm:text-sm"
                />
              </label>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-hairline bg-surface px-5 py-10 text-center text-sm text-mute">
              {searchTerm ? `No orders match “${searchTerm}”.` : 'No orders here.'}
            </p>
          ) : (
            <ul className="space-y-4">
              {paginated.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  onCancel={setCancelTarget}
                  onExchange={(o, item) => setExchangeTarget({ order: o, item })}
                  isCancelling={cancelTarget === order._id && isCancelling}
                />
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav aria-label="Order pages" className="mt-6 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className={btnSmall}>
                Previous
              </button>
              <span className="text-sm tabular-nums text-mute">
                {currentPage} of {totalPages}
              </span>
              <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} className={btnSmall}>
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}

      <CancelOrderSheet
        order={allOrders.find((o) => o._id === cancelTarget) ?? null}
        isSubmitting={isCancelling}
        onConfirm={(reason, note) => void handleCancel(reason, note)}
        onClose={() => setCancelTarget(null)}
      />

      {exchangeTarget ? (
        <ExchangeDialog
          item={exchangeTarget.item}
          isSubmitting={isExchanging}
          onConfirm={(reason) => void handleExchange(reason)}
          onCancel={() => setExchangeTarget(null)}
        />
      ) : null}
      {toastNode}
    </>
  );
};

export default MyOrdersPage;
