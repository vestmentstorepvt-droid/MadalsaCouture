import React, { useState, useCallback, useEffect } from 'react';
import { X, Image as ImageIcon, Sparkles, RefreshCw, ExternalLink } from 'lucide-react';
import { AppButton } from '../../../components/ui/button/AppButton';
import {
  useGetCollectionsShowcaseQuery,
  useUpdateCollectionsShowcaseMutation,
} from '../../../services/cmsAdminApi';
import { useGetAdminCollectionsQuery } from '../../../services/collectionsApi';
import ImageUploader from '../../../components/ui/upload/ImageUploader';
import type { CmsCollectionItem } from '../../../services/cmsAdminApi';

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

const INPUT =
  'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] bg-white transition-colors';

const FieldHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{children}</p>
);

// ─── Toggle Switch ────────────────────────────────────────────────────────────
const ToggleSwitch: React.FC<{
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ id, checked, onChange, label }) => (
  <div className="flex items-center gap-2">
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#E85D88]/40 ${
        checked ? 'bg-[#E85D88]' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
    <label
      htmlFor={id}
      className="text-xs font-medium text-slate-600 cursor-pointer select-none"
    >
      {label}
    </label>
  </div>
);



// ─── Skeletons / Error ────────────────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    {[...Array(2)].map((_, i) => (
      <div key={i} className="h-64 bg-slate-200 rounded-xl" />
    ))}
  </div>
);

const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex flex-col items-center gap-3">
    <p className="text-rose-700 font-medium">Failed to load Collections data.</p>
    <button
      onClick={onRetry}
      className="text-sm text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg transition-colors"
    >
      Try Again
    </button>
  </div>
);

const EMPTY_ITEM = (): CmsCollectionItem => ({
  name: '',
  slug: '',
  imageUrl: '',
  isActive: true,
  displayOrder: 0,
});

// ─── Main Page ────────────────────────────────────────────────────────────────
export const CmsCollectionsPage: React.FC = () => {
  const { data, isLoading: isCmsLoading, isError: isCmsError, refetch } = useGetCollectionsShowcaseQuery();
  const [updateCollections, { isLoading: isSaving }] = useUpdateCollectionsShowcaseMutation();
  const { data: adminCollectionsData, isLoading: isAdminCollectionsLoading } = useGetAdminCollectionsQuery({ limit: 100 });
  const adminCollections = adminCollectionsData?.data || [];
  
  const { toasts, show: showToast } = useToast();

  const [items, setItems] = useState<CmsCollectionItem[]>([]);

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const handleItemChange = (
    index: number,
    field: keyof CmsCollectionItem,
    value: string | boolean | number
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleCollectionSelect = (index: number, collectionId: string) => {
    const selectedCollection = adminCollections.find((c) => c._id === collectionId);
    if (!selectedCollection) return;

    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          name: selectedCollection.name,
          slug: selectedCollection.slug,
          // We can optionally default the image if they haven't uploaded one
          imageUrl: item.imageUrl || selectedCollection.image || '',
        };
      })
    );
  };

  const handleImageUploaded = (index: number, url: string) => {
    handleItemChange(index, 'imageUrl', url);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, EMPTY_ITEM()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setItems((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  const handleSave = async () => {
    // Basic validation
    const invalid = items.find((it) => !it.name.trim() || !it.slug.trim());
    if (invalid) {
      showToast('Each collection must have a Name and a URL Slug.', 'error');
      return;
    }
    try {
      // Assign displayOrder from array position
      const ordered = items.map((it, i) => ({ ...it, displayOrder: i }));
      await updateCollections(ordered).unwrap();
      showToast('Collections showcase saved successfully!', 'success');
    } catch {
      showToast('Failed to save. Please try again.', 'error');
    }
  };

  const activeCount = items.filter((i) => i.isActive !== false).length;

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

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Premium page header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[11px] font-bold text-[#E85D88]">
                <Sparkles className="h-3 w-3" /> Homepage Collections
              </span>
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="text-xs font-semibold text-slate-600">
                  {items.length > 0 ? `${activeCount} of ${items.length} visible` : 'None added'}
                </span>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Collections Showcase</h1>
            <p className="max-w-xl text-sm text-slate-500">
              These collection tiles appear on your homepage. Each one links customers to the matching collection page.
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
            <AppButton variant="outline" onClick={handleAddItem} type="button">
              + Add Collection
            </AppButton>
            <AppButton
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
              type="button"
            >
              {isSaving ? 'Saving…' : 'Save All'}
            </AppButton>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
          {(isCmsLoading || isAdminCollectionsLoading) && <LoadingSkeleton />}
          {isCmsError && <ErrorState onRetry={refetch} />}
          {!isCmsLoading && !isAdminCollectionsLoading && !isCmsError && (
            <div className="space-y-5">
              {items.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                    <ImageIcon className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-sm text-center">
                    No collections added yet.{' '}
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-[#E85D88] hover:underline font-medium"
                    >
                      + Add your first collection
                    </button>
                  </p>
                </div>
              )}

              {items.map((item, index) => (
                <div
                  key={item._id ?? index}
                  className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rose-50 text-[#E85D88] text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">
                        {item.name || 'New Collection'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveItem(index, 'up')}
                        className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-medium px-1.5 py-1 hover:bg-slate-100 rounded transition-colors"
                        title="Move Up"
                      >
                        ▲ Move Up
                      </button>
                      <button
                        type="button"
                        disabled={index === items.length - 1}
                        onClick={() => handleMoveItem(index, 'down')}
                        className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-medium px-1.5 py-1 hover:bg-slate-100 rounded transition-colors"
                        title="Move Down"
                      >
                        ▼ Move Down
                      </button>
                      <span className="w-px h-4 bg-slate-200" />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left column: name + slug + toggle */}
                    <div className="space-y-4">
                      {/* Name Selector */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Select Collection <span className="text-rose-500">*</span>
                        </label>
                        <select
                          className={`${INPUT} appearance-none bg-no-repeat bg-right pr-10`}
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                            backgroundSize: '1rem',
                            backgroundPosition: 'right 0.75rem center'
                          }}
                          value={adminCollections.find(c => c.slug === item.slug)?._id || ''}
                          onChange={(e) => handleCollectionSelect(index, e.target.value)}
                        >
                          <option value="" disabled>Select a collection to link...</option>
                          {adminCollections.map(ac => (
                            <option key={ac._id} value={ac._id}>
                              {ac.name}
                            </option>
                          ))}
                        </select>
                        <FieldHint>
                          Choose from your existing store collections.
                        </FieldHint>
                      </div>

                      {/* Slug (Read Only) */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          URL Slug (Auto-linked)
                        </label>
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <span className="px-2.5 py-2 text-xs text-slate-400 border-r border-slate-200 shrink-0 select-none">
                            /collections/
                          </span>
                          <input
                            readOnly
                            className="flex-1 px-3 py-2 text-sm focus:outline-none bg-transparent text-slate-500 cursor-not-allowed font-mono"
                            value={item.slug ?? ''}
                            placeholder="Select a collection..."
                          />
                        </div>
                        <FieldHint>
                          This is securely linked to the selected collection.
                        </FieldHint>
                      </div>

                      {/* Active toggle */}
                      <ToggleSwitch
                        id={`col-active-${index}`}
                        checked={item.isActive !== false}
                        onChange={(v) => handleItemChange(index, 'isActive', v)}
                        label="Show on homepage"
                      />
                    </div>

                    {/* Right column: image upload */}
                    <div>
                      <ImageUploader
                        imageUrl={item.imageUrl ?? ''}
                        onUploaded={(url) => handleImageUploaded(index, url)}
                        onClear={() => handleItemChange(index, 'imageUrl', '')}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CmsCollectionsPage;

