import React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, Home, Package, MapPin, Tag } from 'lucide-react';
import { useGetMyOrderByIdQuery } from '../../services/ordersApi';

interface LocationState {
  orderNumber?: string;
}

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const OrderSuccess: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const { data: order, isLoading } = useGetMyOrderByIdQuery(orderId ?? '', {
    skip: !orderId,
  });

  const displayOrderNumber = state?.orderNumber || order?.orderNumber || orderId;

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-6 text-center px-4 py-16">
      {/* Success Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <p className="eyebrow">
          Order Confirmed
        </p>
        <h1 className="text-[32px] leading-10 tracking-[-1.28px] text-slate-900 font-semibold">
          Thank You For Your Order!
        </h1>
        <div className="mx-auto h-0.5 w-12 bg-ink" />
      </div>

      {/* Main Order Details Card */}
      <div className="rounded-2xl border border-hairline bg-white p-6 max-w-md w-full shadow-sm space-y-4 text-left">
        <div className="border-b border-hairline pb-3 flex justify-between items-center">
          <div>
            <p className="eyebrow">Order Reference</p>
            <p className="text-sm font-semibold text-slate-900 font-mono">
              #{displayOrderNumber}
            </p>
          </div>
          {order?.paymentMethod && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 uppercase">
              {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 py-4 animate-pulse">
            <div className="h-4 w-3/4 bg-slate-100 rounded" />
            <div className="h-4 w-1/2 bg-slate-100 rounded" />
          </div>
        ) : (
          <>
            {/* Order Items */}
            {order?.items && order.items.length > 0 && (
              <div className="space-y-2 border-b border-hairline pb-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-accent" /> Purchased Items ({order.items.length})
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{item.name || item.productTitle}</p>
                        <p className="text-slate-400">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-semibold text-slate-900 shrink-0">
                        {formatINR(item.lineTotal || (item.unitPrice || item.price) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shipping Address */}
            {order?.shippingAddress && (
              <div className="space-y-1 text-xs text-slate-600 border-b border-hairline pb-3">
                <p className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-accent" /> Shipping To
                </p>
                <p className="font-semibold text-slate-900">{order.shippingAddress.name || order.shippingAddress.fullName}</p>
                <p>{[order.shippingAddress.addressLine || order.shippingAddress.line1, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pincode].filter(Boolean).join(', ')}</p>
                <p className="text-slate-500">Phone: {order.shippingAddress.phone}</p>
              </div>
            )}

            {/* Order Total */}
            <div className="flex justify-between items-center text-sm font-semibold text-slate-900 pt-1">
              <span className="flex items-center gap-1.5 font-semibold">
                <Tag className="w-4 h-4 text-accent" /> Total Paid
              </span>
              <span className="font-serif text-lg text-ink">
                {formatINR(order?.total || 0)}
              </span>
            </div>
          </>
        )}

        <p className="text-xs text-slate-500 text-center pt-2">
          An email confirmation has been sent to your registered email address.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/my-orders"
          className="inline-flex items-center gap-2 bg-ink px-8 text-white h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover"
        >
          <ShoppingBag className="h-4 w-4" /> View My Orders
        </Link>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 border px-8 text-ink h-11 rounded-full border-hairline-strong bg-surface text-sm font-medium transition-colors hover:bg-hairline-soft"
        >
          <Home className="h-4 w-4" /> Continue Shopping
        </Link>
      </div>
    </div>
  );
};

export default OrderSuccess;
