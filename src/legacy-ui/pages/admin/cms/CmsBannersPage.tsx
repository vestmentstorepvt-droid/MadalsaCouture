import React, { useState, useCallback } from 'react';
import { Sparkles, RefreshCw, ExternalLink, Trash2, X, Image as ImageIcon, Plus } from 'lucide-react';
import { AppButton } from '../../../components/ui/button/AppButton';
import ImageUploader from '../../../components/ui/upload/ImageUploader';
import {
  useGetBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,
} from '../../../services/cmsAdminApi';
import type { CmsBanner } from '../../../services/cmsAdminApi';

// ─── Toast ────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' }[]>([]);
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, show };
};

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] bg-white transition-colors';

const FieldHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{children}</p>
);

// ─── Placement options ────────────────────────────────────────────────────────
const PLACEMENT_OPTIONS = [
  { label: 'Select a location…', value: '' },
  { label: 'Festive Sale Offer Banner', value: 'festive' },
  { label: 'Homepage – Top', value: 'homepage-hero' },
];

// ─── Form state ───────────────────────────────────────────────────────────────
type BannerFormData = {
  title: string;
  imageUrl: string;
  linkUrl: string;
  promoCouponCode: string;
  altText: string;
  placement: string;
  priority: string;
  status: 'active' | 'inactive';
  showCtaButton: boolean;
  ctaLabel: string;
  ctaUrl: string;
};

const EMPTY_FORM: BannerFormData = {
  title: '',
  imageUrl: '',
  linkUrl: '',
  promoCouponCode: '',
  altText: '',
  placement: '',
  priority: '0',
  status: 'inactive',
  showCtaButton: false,
  ctaLabel: '',
  ctaUrl: '',
};

function bannerToForm(b: CmsBanner): BannerFormData {
  return {
    title: b.title ?? '',
    imageUrl: b.imageUrl ?? '',
    linkUrl: b.linkUrl ?? '',
    promoCouponCode: b.promoCouponCode ?? '',
    altText: b.altText ?? '',
    placement: b.placement ?? '',
    priority: String(b.priority ?? 0),
    status: b.status ?? 'inactive',
    showCtaButton: b.showCtaButton ?? false,
    ctaLabel: b.ctaLabel ?? '',
    ctaUrl: b.ctaUrl ?? '',
  };
}

function formToPayload(data: BannerFormData): Omit<CmsBanner, '_id'> {
  const isHomepage = data.placement === 'homepage-hero';
  return {
    title: data.title,
    imageUrl: data.imageUrl,
    linkUrl: data.linkUrl || undefined,
    promoCouponCode: data.promoCouponCode || undefined,
    altText: data.altText || undefined,
    placement: data.placement,
    priority: Number(data.priority),
    status: data.status,
    showCtaButton: isHomepage ? data.showCtaButton : false,
    ctaLabel: isHomepage && data.showCtaButton ? (data.ctaLabel || undefined) : undefined,
    ctaUrl: isHomepage && data.showCtaButton ? (data.ctaUrl || undefined) : undefined,
  };
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
const ToggleSwitch: React.FC<{
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}> = ({ id, checked, onChange, label, hint }) => (
  <div className="flex items-start gap-3">
    <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#E85D88]/40 mt-0.5 ${checked ? 'bg-[#E85D88]' : 'bg-slate-200'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700 cursor-pointer select-none">{label}</label>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  </div>
);

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="aspect-video bg-slate-100" />
        <div className="p-4 space-y-2">
          <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
          <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 flex flex-col items-center gap-3">
    <p className="text-rose-700 font-medium">Failed to load banners.</p>
    <button onClick={onRetry} className="text-sm text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-xl transition-colors">Try Again</button>
  </div>
);

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
const ConfirmDialog: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
          <Trash2 className="w-5 h-5 text-rose-600" />
        </div>
        <p className="text-slate-800 font-bold text-sm">Delete this banner? This cannot be undone.</p>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors">Yes, Delete</button>
      </div>
    </div>
  </div>
);

// ─── Banner Form Modal ────────────────────────────────────────────────────────
const BannerModal: React.FC<{
  initial: BannerFormData;
  title: string;
  onClose: () => void;
  onSubmit: (data: BannerFormData) => Promise<void>;
  isSubmitting: boolean;
}> = ({ initial, title, onClose, onSubmit, isSubmitting }) => {
  const [form, setForm] = useState<BannerFormData>(initial);
  const [formError, setFormError] = useState('');
  const set = (field: keyof BannerFormData, value: string | boolean) => {
    setFormError('');
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-slate-100 bg-white rounded-t-3xl">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) { setFormError('Banner title is required.'); return; }
          if (!form.imageUrl) { setFormError('Please upload a banner image.'); return; }
          void onSubmit(form);
        }} className="p-5 space-y-5">
          {formError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{formError}</p>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Banner Title</label>
            <input className={INPUT} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Summer Sale Banner" />
            <FieldHint>Used as the banner name in this list and as fallback alt text.</FieldHint>
          </div>

          <div>
            <ImageUploader
              imageUrl={form.imageUrl}
              onUploaded={(url) => set('imageUrl', url)}
              onClear={() => set('imageUrl', '')}
              label="Banner Image"
              aspectRatio="video"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Image Alt Text</label>
            <input className={INPUT} value={form.altText} onChange={(e) => set('altText', e.target.value)} placeholder="Describe the image for accessibility" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Click Destination (optional)</label>
            <input className={INPUT} value={form.linkUrl} onChange={(e) => set('linkUrl', e.target.value)} placeholder="/collections/summer-sale" />
            <FieldHint>Where customers go when they click the banner. Leave blank for a non-clickable banner.</FieldHint>
          </div>

          {form.placement === 'festive' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Promo Coupon Code (optional)</label>
              <input className={INPUT} value={form.promoCouponCode} onChange={(e) => set('promoCouponCode', e.target.value)} placeholder="e.g. WELCOME10, FESTIVE50" />
              <FieldHint>The active coupon code to email to customers when they submit the offer popup form.</FieldHint>
            </div>
          )}

          {form.placement === 'homepage-hero' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <ToggleSwitch
                id="banner-show-cta"
                checked={form.showCtaButton}
                onChange={(v) => set('showCtaButton', v)}
                label="Show CTA Button"
                hint="Turn on to display a button on this banner."
              />
              {form.showCtaButton && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Button Label</label>
                    <input className={INPUT} value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="e.g. Shop Now, Explore Collection" />
                    <FieldHint>Text shown on the button.</FieldHint>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Button URL</label>
                    <input className={INPUT} value={form.ctaUrl} onChange={(e) => set('ctaUrl', e.target.value)} placeholder="/collections/all" />
                    <FieldHint>Where the button navigates to when clicked.</FieldHint>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Where to Show <span className="text-rose-500">*</span></label>
              <select className={INPUT} value={form.placement} onChange={(e) => set('placement', e.target.value)} required>
                {PLACEMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.value === ''}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Display Priority</label>
              <input type="number" className={INPUT} value={form.priority} onChange={(e) => set('priority', e.target.value)} min="0" />
              <FieldHint>Lower = shown first (0, 1, 2…)</FieldHint>
            </div>
          </div>

          <ToggleSwitch id="banner-status" checked={form.status === 'active'} onChange={(v) => set('status', v ? 'active' : 'inactive')}
            label="Show this banner" hint="Turn off to hide without deleting." />

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors">Cancel</button>
            <AppButton type="submit" variant="primary" isLoading={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save Banner'}</AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

function placementLabel(val: string): string {
  return PLACEMENT_OPTIONS.find((o) => o.value === val)?.label ?? val ?? '—';
}

// ─── CmsBannersPage ───────────────────────────────────────────────────────────
export const CmsBannersPage: React.FC = () => {
  const { data: banners = [], isLoading, isError, refetch } = useGetBannersQuery();
  const [createBanner, { isLoading: isCreating }] = useCreateBannerMutation();
  const [updateBanner, { isLoading: isUpdating }] = useUpdateBannerMutation();
  const [deleteBanner] = useDeleteBannerMutation();
  const { toasts, show: showToast } = useToast();

  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; banner: CmsBanner }>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const activeCount = banners.filter((b) => b.status === 'active').length;

  const handleCreate = async (data: BannerFormData) => {
    try {
      await createBanner(formToPayload(data)).unwrap();
      showToast('Banner created successfully!');
      setModal(null);
    } catch {
      showToast('Failed to create banner.', 'error');
    }
  };

  const handleUpdate = async (data: BannerFormData) => {
    if (modal?.mode !== 'edit') return;
    try {
      await updateBanner({ id: modal.banner._id, body: formToPayload(data) }).unwrap();
      showToast('Banner updated successfully!');
      setModal(null);
    } catch {
      showToast('Failed to update banner.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBanner(deleteTarget).unwrap();
      showToast('Banner deleted.');
    } catch {
      showToast('Failed to delete banner.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-[#FAFAFC]">
      {/* Toasts */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 pl-3 pr-4 py-3 rounded-2xl shadow-lg text-sm font-medium text-white pointer-events-auto backdrop-blur-sm ${t.type === 'success' ? 'bg-emerald-500/95' : 'bg-rose-500/95'}`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${t.type === 'success' ? 'bg-white/20' : 'bg-white/20'}`}>
              {t.type === 'success' ? (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <X className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            {t.message}
          </div>
        ))}
      </div>

      {deleteTarget && <ConfirmDialog onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}

      {modal?.mode === 'create' && (
        <BannerModal title="Add Banner" initial={EMPTY_FORM} onClose={() => setModal(null)} onSubmit={handleCreate} isSubmitting={isCreating} />
      )}
      {modal?.mode === 'edit' && (
        <BannerModal title="Edit Banner" initial={bannerToForm(modal.banner)} onClose={() => setModal(null)} onSubmit={handleUpdate} isSubmitting={isUpdating} />
      )}

      <div className="max-w-full mx-auto space-y-6">
        {/* Premium page header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[11px] font-bold text-[#E85D88]">
                <Sparkles className="h-3 w-3" /> Promotional Banners
              </span>
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="text-xs font-semibold text-slate-600">
                  {activeCount > 0 ? `${activeCount} active` : 'None active'}
                </span>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Banners</h1>
            <p className="max-w-xl text-sm text-slate-500">
              Manage promotional images displayed across your site. Active banners are live immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Store
            </a>
            <button
              type="button"
              onClick={() => refetch()}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <AppButton variant="primary" onClick={() => setModal({ mode: 'create' })}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Banner
            </AppButton>
          </div>
        </div>

        {/* Content */}
        {isLoading && <LoadingSkeleton />}
        {isError && <ErrorState onRetry={refetch} />}

        {!isLoading && !isError && (
          <>
            {banners.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-16 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-[#E85D88]" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">No banners yet</p>
                  <p className="text-sm text-slate-500 mt-1">Create your first promotional banner to get started.</p>
                </div>
                <AppButton variant="primary" onClick={() => setModal({ mode: 'create' })}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Banner
                </AppButton>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {banners.map((b) => (
                  <div
                    key={b._id}
                    className="group relative bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200"
                  >
                    {/* Image preview */}
                    <div className="aspect-video bg-slate-100 overflow-hidden relative">
                      {b.imageUrl ? (
                        <img
                          src={b.imageUrl}
                          alt={b.altText ?? b.title ?? 'Banner'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                          <ImageIcon className="w-8 h-8" />
                          <span className="text-xs">No image</span>
                        </div>
                      )}
                      {/* Hover action overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => setModal({ mode: 'edit', banner: b })}
                          className="px-4 py-2 rounded-xl bg-white text-slate-800 text-xs font-bold shadow-lg hover:bg-slate-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(b._id)}
                          className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-lg hover:bg-rose-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Card info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{b.title ?? '—'}</h3>
                        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${b.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${b.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {b.status === 'active' ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">{placementLabel(b.placement ?? '')}</p>
                        <span className="text-[10px] text-slate-400 font-mono">Priority {b.priority ?? 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CmsBannersPage;
