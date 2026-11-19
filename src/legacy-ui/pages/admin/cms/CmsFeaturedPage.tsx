import React, { useState, useCallback } from 'react';
import { Sparkles, Plus, Pencil, Trash2, Check, AlertCircle, RefreshCw, X, Calendar } from 'lucide-react';
import { AppButton } from '../../../components/ui/button/AppButton';
import {
  useGetFeaturedSectionsQuery,
  useCreateFeaturedSectionMutation,
  useUpdateFeaturedSectionMutation,
  useDeleteFeaturedSectionMutation,
} from '../../../services/cmsAdminApi';
import type { CmsFeaturedSection } from '../../../services/cmsAdminApi';
import { toDatetimeLocal } from '../../../utils/dateTime';

const INPUT = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink';


// ── Backend-aligned form ────────────────────────────────────────────────────────
interface SectionForm {
  title: string;
  subtitle: string;
  productIds: string;     // newline-separated ObjectId strings
  displayOrder: string;
  status: 'active' | 'inactive';
  startsAt: string;
  endsAt: string;
}

const EMPTY_FORM: SectionForm = {
  title: '',
  subtitle: '',
  productIds: '',
  displayOrder: '0',
  status: 'inactive',
  startsAt: '',
  endsAt: '',
};

function sectionToForm(s: CmsFeaturedSection): SectionForm {
  return {
    title: s.title,
    subtitle: s.subtitle ?? '',
    productIds: (s.productIds ?? []).join('\n'),
    displayOrder: String(s.displayOrder ?? 0),
    status: s.status ?? 'inactive',
    startsAt: toDatetimeLocal(s.startsAt),
    endsAt: toDatetimeLocal(s.endsAt),
  };
}

function formToPayload(data: SectionForm): Omit<CmsFeaturedSection, '_id'> {
  return {
    title: data.title,
    subtitle: data.subtitle || null,
    productIds: data.productIds
      ? data.productIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
      : [],
    displayOrder: Number(data.displayOrder),
    status: data.status,
    startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : null,
    endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : null,
  };
}

// ── Section Modal ───────────────────────────────────────────────────────────────
const SectionModal: React.FC<{
  initial: SectionForm;
  title: string;
  onClose: () => void;
  onSubmit: (data: SectionForm) => Promise<void>;
  isSubmitting: boolean;
}> = ({ initial, title, onClose, onSubmit, isSubmitting }) => {
  const [form, setForm] = useState<SectionForm>(initial);
  const set = (field: keyof SectionForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Section Title *</label>
            <input className={INPUT} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. New Arrivals" required />
            <p className="text-xs text-slate-400 mt-1">The heading shown to customers above this section on the homepage.</p>
          </div>

          {/* Subtitle */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Subtitle (optional)</label>
            <input className={INPUT} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="e.g. Fresh styles just dropped" />
          </div>

          {/* Product IDs */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Product IDs (one per line)</label>
            <textarea className={`${INPUT} resize-none font-mono text-xs`} rows={5} value={form.productIds} onChange={(e) => set('productIds', e.target.value)} placeholder={'Paste one MongoDB ObjectId per line:\n6789abc123def456\n6789abc123def789'} />
            <p className="text-xs text-slate-400 mt-1">
              These are MongoDB ObjectIds. Copy them from the{' '}
              <a href="/admin/products" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Products page</a>.
            </p>
          </div>

          {/* Display Order + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Display Order</label>
              <input type="number" className={INPUT} value={form.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} min="0" />
              <p className="text-xs text-slate-400 mt-1">Lower = appears first (0, 1, 2…)</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Visibility Status</label>
              <select className={INPUT} value={form.status} onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}>
                <option value="active">Active (Visible)</option>
                <option value="inactive">Inactive (Hidden)</option>
              </select>
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Starts At (Optional)
              </label>
              <input type="datetime-local" className={INPUT} value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Ends At (Optional)
              </label>
              <input type="datetime-local" className={INPUT} value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition">
              Cancel
            </button>
            <AppButton type="submit" variant="primary" isLoading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Section'}
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Confirm Dialog ──────────────────────────────────────────────────────────────
const ConfirmDialog: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
          <Trash2 className="w-5 h-5 text-rose-600" />
        </div>
        <p className="text-slate-800 font-bold text-sm">Delete this featured section? This cannot be undone.</p>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition">Yes, Delete</button>
      </div>
    </div>
  </div>
);

// ── Main Page ───────────────────────────────────────────────────────────────────
export const CmsFeaturedPage: React.FC = () => {
  const { data: sections = [], isLoading, isError, refetch } = useGetFeaturedSectionsQuery();
  const [createFeaturedSection, { isLoading: isCreating }] = useCreateFeaturedSectionMutation();
  const [updateFeaturedSection, { isLoading: isUpdating }] = useUpdateFeaturedSectionMutation();
  const [deleteFeaturedSection] = useDeleteFeaturedSectionMutation();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; section: CmsFeaturedSection }>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleCreate = async (data: SectionForm) => {
    try {
      await createFeaturedSection(formToPayload(data)).unwrap();
      showToast('Featured section created!');
      setModal(null);
      refetch();
    } catch {
      showToast('Failed to create section.', 'error');
    }
  };

  const handleUpdate = async (data: SectionForm) => {
    if (modal?.mode !== 'edit') return;
    try {
      await updateFeaturedSection({ id: modal.section._id, body: formToPayload(data) }).unwrap();
      showToast('Featured section updated!');
      setModal(null);
      refetch();
    } catch {
      showToast('Failed to update section.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFeaturedSection(deleteTarget).unwrap();
      showToast('Section deleted.');
      refetch();
    } catch {
      showToast('Failed to delete section.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-canvas space-y-6">
      {/* Toast */}
      {toast && (
        <div role="alert" className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900' : 'bg-rose-50/95 border-rose-200 text-rose-900'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {toast.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          </div>
          {toast.message}
        </div>
      )}

      {deleteTarget && <ConfirmDialog onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
      {modal?.mode === 'create' && <SectionModal title="Add Featured Section" initial={EMPTY_FORM} onClose={() => setModal(null)} onSubmit={handleCreate} isSubmitting={isCreating} />}
      {modal?.mode === 'edit' && <SectionModal title="Edit Featured Section" initial={sectionToForm(modal.section)} onClose={() => setModal(null)} onSubmit={handleUpdate} isSubmitting={isUpdating} />}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-accent">
            <Sparkles className="w-3 h-3" /> Homepage Curated Sections
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Featured Sections Studio</h1>
          <p className="text-xs text-slate-500 max-w-lg">Create and manage curated product grid sections displayed on the homepage. Each section references specific product IDs from your catalog.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-xs">
            <RefreshCw className="w-4 h-4" />
          </button>
          <AppButton variant="primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Section
          </AppButton>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
            <p className="text-sm text-slate-500">Loading sections...</p>
          </div>
        ) : isError ? (
          <div className="py-12 text-center flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <p className="text-sm text-rose-700 font-bold">Failed to load sections.</p>
            <AppButton variant="primary" size="sm" onClick={() => refetch()}>Retry</AppButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide font-bold">
                  <th className="py-3.5 px-5">Section</th>
                  <th className="py-3.5 px-5">Products</th>
                  <th className="py-3.5 px-5">Order</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sections.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">No featured sections yet.</p>
                      <button onClick={() => setModal({ mode: 'create' })} className="mt-2 text-accent text-xs font-bold hover:underline">+ Add your first section</button>
                    </td>
                  </tr>
                )}
                {sections.map(s => (
                  <tr key={s._id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{s.title}</div>
                      {s.subtitle && <div className="text-xs text-slate-400 mt-0.5">{s.subtitle}</div>}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        {s.productIds?.length ?? 0} products
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 font-mono text-xs">{s.displayOrder ?? 0}</td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                        {s.status === 'active' ? <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active</> : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setModal({ mode: 'edit', section: s })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => setDeleteTarget(s._id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-100 text-rose-600 text-xs font-bold hover:bg-rose-50 transition">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CmsFeaturedPage;
