import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Package,
  XCircle,
  RefreshCw,
  ShoppingBag,
  ClipboardCheck,
} from 'lucide-react';
import {
  useGetExchangeByIdQuery,
  useApproveExchangeMutation,
  useRejectExchangeMutation,
  useQcExchangeMutation,
} from '../../services/adminExchangesApi';
import { AppButton } from '../../components/ui/button/AppButton';

export const ExchangeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useGetExchangeByIdQuery(id!);
  const [approveExchange, { isLoading: isApproving }] = useApproveExchangeMutation();
  const [rejectExchange, { isLoading: isRejecting }] = useRejectExchangeMutation();
  const [qcExchange, { isLoading: isQcing }] = useQcExchangeMutation();

  const [note, setNote] = useState('');
  const [qcPassed, setQcPassed] = useState<boolean | null>(null);

  const exchange = data?.exchange;

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!exchange) {
    return (
      <div className="min-h-screen p-6 bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
          <p className="text-slate-600 font-semibold">Exchange request not found.</p>
          <button onClick={() => navigate('/admin/exchanges')} className="mt-4 text-accent hover:underline text-sm font-semibold">
            Back to Exchanges
          </button>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    try {
      await approveExchange({ id: exchange._id, note }).unwrap();
      setNote('');
      refetch();
    } catch (e) {
      alert('Failed to approve exchange');
    }
  };

  const handleReject = async () => {
    if (!note.trim()) {
      alert('A note is required to reject the exchange.');
      return;
    }
    try {
      await rejectExchange({ id: exchange._id, note }).unwrap();
      setNote('');
      refetch();
    } catch (e) {
      alert('Failed to reject exchange');
    }
  };

  const handleQC = async () => {
    if (qcPassed === null) {
      alert('Please select Passed or Failed for QC.');
      return;
    }
    try {
      await qcExchange({ id: exchange._id, passed: qcPassed, note }).unwrap();
      setNote('');
      setQcPassed(null);
      refetch();
    } catch (e) {
      alert('Failed to record QC');
    }
  };

  const statusColors: Record<string, string> = {
    ExchangeRequested: 'bg-amber-100 text-amber-800',
    ExchangeApproved: 'bg-blue-100 text-blue-800',
    ExchangePickupScheduled: 'bg-indigo-100 text-indigo-800',
    ExchangeInTransit: 'bg-purple-100 text-purple-800',
    QCPassed: 'bg-teal-100 text-teal-800',
    QCFailed: 'bg-rose-100 text-rose-800',
    ReplacementShipped: 'bg-emerald-100 text-emerald-800',
    ExchangeRejected: 'bg-rose-100 text-rose-800',
    ExchangeCompleted: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/exchanges')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Exchanges
        </button>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[exchange.status] || 'bg-slate-200'}`}>
          {exchange.status.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Exchange #{exchange._id.slice(-8).toUpperCase()}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Requested on {new Date(exchange.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Order ID</p>
            <p className="font-mono font-bold text-slate-900">#{exchange.orderId?.orderNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 border-b border-slate-100 pb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Customer Details</h3>
            <p className="font-medium text-slate-800">{exchange.requestedBy?.name || 'Unknown'}</p>
            <p className="text-sm text-slate-500">{exchange.requestedBy?.email}</p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Reason for Exchange</h3>
            <p className="text-sm bg-rose-50 border border-rose-100 p-3 rounded-xl text-rose-900">
              {exchange.reason}
            </p>
            {exchange.customerNote && (
              <p className="text-xs text-slate-500 mt-2 italic">"{exchange.customerNote}"</p>
            )}
          </div>
        </div>

        <div className="mb-6 border-b border-slate-100 pb-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package className="w-4 h-4" /> Item to Exchange
          </h3>
          <div className="space-y-3">
            {exchange.orderItemId && (
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-6 h-6 text-slate-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{exchange.orderItemId.productId?.title || 'Unknown Product'}</p>
                  <p className="text-xs text-slate-500">Qty: {exchange.orderItemId.quantity} • Price: ₹{exchange.orderItemId.price}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Panel based on Status */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Admin Actions</h3>

          {exchange.status === 'ExchangeRequested' && (
            <div className="space-y-4">
              <textarea
                placeholder="Optional admin note (required for rejection)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-hairline"
                rows={2}
              />
              <div className="flex gap-3">
                <AppButton variant="primary" onClick={handleApprove} isLoading={isApproving}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Exchange
                </AppButton>
                <AppButton variant="danger" onClick={handleReject} isLoading={isRejecting}>
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </AppButton>
              </div>
            </div>
          )}

          {exchange.status === 'ExchangeInTransit' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 mb-2">Item is currently in transit. Once received, record the Quality Check (QC) result to proceed.</p>
              
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="radio" checked={qcPassed === true} onChange={() => setQcPassed(true)} className="accent-emerald-500" />
                  <span className="text-emerald-700">QC Passed (Approve for Replacement)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="radio" checked={qcPassed === false} onChange={() => setQcPassed(false)} className="accent-rose-500" />
                  <span className="text-rose-700">QC Failed (Reject & Return to Customer)</span>
                </label>
              </div>

              <textarea
                placeholder="QC Notes (Optional)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-hairline"
                rows={2}
              />
              
              <AppButton variant="primary" onClick={handleQC} isLoading={isQcing} disabled={qcPassed === null}>
                <ClipboardCheck className="w-4 h-4 mr-2" /> Record QC Result
              </AppButton>
            </div>
          )}

          {['ExchangeApproved', 'ExchangePickupScheduled', 'QCPassed', 'ReplacementShipped', 'ExchangeCompleted', 'ExchangeRejected', 'QCFailed'].includes(exchange.status) && (
            <div>
              <p className="text-sm text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {
                  exchange.status === 'ExchangeCompleted' || exchange.status === 'ExchangeRejected' || exchange.status === 'QCFailed' 
                  ? 'Exchange process concluded.' 
                  : 'Pending external action (Shipping / Pickup).'
                }
              </p>
              {(exchange.adminDecision?.note || exchange.qcResult?.note) && (
                <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Admin / QC Notes</h4>
                  {exchange.adminDecision?.note && <p className="text-sm text-slate-800 mb-2"><span className="font-semibold text-slate-600">Decision:</span> {exchange.adminDecision.note}</p>}
                  {exchange.qcResult?.note && <p className="text-sm text-slate-800"><span className="font-semibold text-slate-600">QC Note:</span> {exchange.qcResult.note}</p>}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ExchangeDetail;
