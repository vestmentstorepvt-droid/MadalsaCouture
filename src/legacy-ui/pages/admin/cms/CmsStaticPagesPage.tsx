import React, { useState, useCallback } from 'react';
import { Sparkles, RefreshCw, Trash2, X, Plus, FileText } from 'lucide-react';
import { AppButton } from '../../../components/ui/button/AppButton';
import RichTextEditor from '../../../components/ui/editor/RichTextEditor';
import {
  useGetStaticPagesQuery,
  useCreateStaticPageMutation,
  useUpdateStaticPageMutation,
  useDeleteStaticPageMutation,
} from '../../../services/cmsAdminApi';
import type { CmsStaticPage } from '../../../services/cmsAdminApi';

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

// ─── Slug auto-generator ──────────────────────────────────────────────────────
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

// ─── Types ────────────────────────────────────────────────────────────────────
type PageFormData = {
  slug: string;
  title: string;
  body: string;
  status: 'published' | 'draft';
};

const EMPTY_FORM: PageFormData = { slug: '', title: '', body: '', status: 'draft' };

function pageToForm(p: CmsStaticPage): PageFormData {
  return { slug: p.slug, title: p.title, body: p.body ?? '', status: p.status ?? 'draft' };
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse p-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="h-14 bg-slate-200 rounded-xl" />
    ))}
  </div>
);

// ─── Error State ──────────────────────────────────────────────────────────────
const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex flex-col items-center gap-3 m-4">
    <p className="text-rose-700 font-medium">Failed to load static pages.</p>
    <button
      onClick={onRetry}
      className="text-sm text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg transition-colors"
    >
      Retry
    </button>
  </div>
);

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
const ConfirmDialog: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
          <Trash2 className="w-5 h-5 text-rose-600" />
        </div>
        <p className="text-slate-800 font-bold text-sm">{message}</p>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
        >
          Yes, Delete
        </button>
      </div>
    </div>
  </div>
);

// ─── Static Page Modal ────────────────────────────────────────────────────────
const PageModal: React.FC<{
  initial: PageFormData;
  title: string;
  onClose: () => void;
  onSubmit: (data: PageFormData) => Promise<void>;
  isSubmitting: boolean;
  isNew: boolean;
}> = ({ initial, title, onClose, onSubmit, isSubmitting, isNew }) => {
  const [form, setForm] = useState<PageFormData>(initial);

  const set = (field: keyof PageFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleTitleChange = (value: string) => {
    const autoSlug =
      form.slug === '' || (isNew && form.slug === toSlug(form.title))
        ? toSlug(value)
        : form.slug;
    setForm((prev) => ({ ...prev, title: value, slug: autoSlug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-slate-100 bg-white rounded-t-3xl">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Page Title <span className="text-rose-500">*</span>
            </label>
            <input
              className={INPUT}
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Privacy Policy"
              required
            />
            <FieldHint>The title shown in the browser tab and at the top of the page.</FieldHint>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              URL Slug <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#E85D88]/20 focus-within:border-[#E85D88] bg-white">
              <span className="px-2.5 py-2 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 shrink-0 select-none">
                /pages/
              </span>
              <input
                className="flex-1 px-3 py-2 text-sm focus:outline-none bg-transparent"
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="privacy-policy"
                required
              />
            </div>
            <FieldHint>
              Auto-filled from the title. This is the URL for this page (e.g.{' '}
              <span className="font-mono text-slate-500">/pages/privacy-policy</span>). Use
              lowercase letters and hyphens only.
            </FieldHint>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Page Content</label>
            <RichTextEditor
              value={form.body}
              onChange={(content) => set('body', content)}
              placeholder="Write your page content here..."
            />
            <FieldHint>
              Write the full page content using the visual editor above.
            </FieldHint>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              className={INPUT}
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <FieldHint>
              Draft pages are only visible in the admin CMS. Published pages are accessible via the public website.
            </FieldHint>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <AppButton type="submit" variant="primary" isLoading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Page'}
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── CmsStaticPagesPage ───────────────────────────────────────────────────────
export const CmsStaticPagesPage: React.FC = () => {
  const { data: pages = [], isLoading, isError, refetch } = useGetStaticPagesQuery();
  const [createStaticPage, { isLoading: isCreating }] = useCreateStaticPageMutation();
  const [updateStaticPage, { isLoading: isUpdating }] = useUpdateStaticPageMutation();
  const [deleteStaticPage] = useDeleteStaticPageMutation();
  const { toasts, show: showToast } = useToast();

  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; page: CmsStaticPage }>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleCreate = async (data: PageFormData) => {
    try {
      await createStaticPage({ slug: data.slug, title: data.title, body: data.body, status: data.status }).unwrap();
      showToast('Page created successfully!');
      setModal(null);
    } catch {
      showToast('Failed to create page.', 'error');
    }
  };

  const handleUpdate = async (data: PageFormData) => {
    if (modal?.mode !== 'edit') return;
    try {
      await updateStaticPage({
        id: modal.page._id,
        body: { slug: data.slug, title: data.title, body: data.body, status: data.status }
      }).unwrap();
      showToast('Page updated successfully!');
      setModal(null);
    } catch {
      showToast('Failed to update page.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStaticPage(deleteTarget).unwrap();
      showToast('Page deleted.');
    } catch {
      showToast('Failed to delete page.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleToggleStatus = async (page: CmsStaticPage) => {
    try {
      const nextStatus = page.status === 'published' ? 'draft' : 'published';
      await updateStaticPage({
        id: page._id,
        body: { status: nextStatus }
      }).unwrap();
      showToast(`Page ${nextStatus === 'published' ? 'published' : 'saved to draft'} successfully!`);
    } catch {
      showToast('Failed to update page status.', 'error');
    }
  };

  const publishedCount = pages.filter((p) => p.status === 'published').length;

  return (
    <div className="min-h-screen p-6 bg-[#FAFAFC]">
      {/* Toasts */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 pl-3 pr-4 py-3 rounded-2xl shadow-lg text-sm font-medium text-white pointer-events-auto backdrop-blur-sm ${
              t.type === 'success' ? 'bg-emerald-500/95' : 'bg-rose-500/95'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
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

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          message="Are you sure you want to delete this page? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Create/Edit modal */}
      {modal?.mode === 'create' && (
        <PageModal
          title="Create Static Page"
          initial={EMPTY_FORM}
          onClose={() => setModal(null)}
          onSubmit={handleCreate}
          isSubmitting={isCreating}
          isNew={true}
        />
      )}
      {modal?.mode === 'edit' && (
        <PageModal
          title="Edit Static Page"
          initial={pageToForm(modal.page)}
          onClose={() => setModal(null)}
          onSubmit={handleUpdate}
          isSubmitting={isUpdating}
          isNew={false}
        />
      )}

      <div className="max-w-full mx-auto space-y-6">
        {/* Premium page header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[11px] font-bold text-[#E85D88]">
                <Sparkles className="h-3 w-3" /> Static Pages
              </span>
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${publishedCount > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="text-xs font-semibold text-slate-600">
                  {publishedCount > 0 ? `${publishedCount} published` : 'None published'}
                </span>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Static Pages</h1>
            <p className="max-w-xl text-sm text-slate-500">
              Manage content pages like Privacy Policy, Terms &amp; Conditions, FAQs and more.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => refetch()}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <AppButton variant="primary" onClick={() => setModal({ mode: 'create' })}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Page
            </AppButton>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {isLoading && <LoadingSkeleton />}
          {isError && <ErrorState onRetry={refetch} />}
          {!isLoading && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide font-semibold">
                    <th className="py-3.5 px-5">Title</th>
                    <th className="py-3.5 px-5">Slug</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5">Last Updated</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {pages.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-slate-300" />
                          </div>
                          <p className="text-sm">No pages yet. Click <strong className="text-slate-600">Add Page</strong> to create one.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {pages.map((p) => (
                    <tr key={p._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">{p.title}</td>
                      <td className="py-3.5 px-5 text-slate-500 font-mono text-xs">/pages/{p.slug}</td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          p.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {p.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 text-xs">
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`p-2 rounded-xl transition-colors ${
                              p.status === 'published'
                                ? 'hover:bg-amber-50 text-amber-600 hover:text-amber-700'
                                : 'hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700'
                            }`}
                            title={p.status === 'published' ? 'Revert to Draft' : 'Publish Page'}
                            aria-label={p.status === 'published' ? 'Revert to Draft' : 'Publish Page'}
                          >
                            {p.status === 'published' ? (
                              // Eye Off icon (to unpublish)
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              // Eye icon (to publish)
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => setModal({ mode: 'edit', page: p })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors"
                            aria-label="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p._id)}
                            className="p-2 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors border border-rose-100"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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
    </div>
  );
};

export default CmsStaticPagesPage;
