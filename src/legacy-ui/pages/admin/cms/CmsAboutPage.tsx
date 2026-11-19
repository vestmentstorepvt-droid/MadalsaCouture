import React, { useState, useCallback, useEffect } from 'react';
import {
  BookOpen, Check, AlertCircle, RefreshCw, ExternalLink,
  Eye, ImagePlus, Trash2, User
} from 'lucide-react';
import { AppButton } from '../../../components/ui/button/AppButton';
import ImageUploader from '../../../components/ui/upload/ImageUploader';
import {
  useGetAboutUsQuery,
  useUpdateAboutUsMutation,
} from '../../../services/cmsAdminApi';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

interface ImageBlock {
  _id?: string;
  imageUrl: string;
  caption: string;
  displayOrder: number;
}

interface Virtue {
  label: string;
  desc: string;
}

interface CraftBadge {
  title: string;
  description: string;
  icon?: string;
}

interface AboutUsForm {
  heroLabel: string;
  heading: string;
  subheading: string;
  designerName: string;
  designerRole: string;
  designerImageUrl: string;
  establishedYear: string;
  founderQuote: string;
  storyParagraphsText: string;
  virtues: Virtue[];
  craftBadges: CraftBadge[];
  imageBlocks: ImageBlock[];
  status: 'active' | 'inactive';
}

const DEFAULT_VIRTUES: Virtue[] = [
  { label: 'Bespoke Tailoring', desc: 'Custom fits crafted to perfection' },
  { label: 'Ethical Luxury', desc: 'Sourced & made by master artisans' },
  { label: 'Handcrafted Detail', desc: 'Intricate zari & pearl embellishments' },
  { label: 'Global Delivery', desc: 'Insured white-glove express dispatch' },
];

const DEFAULT_CRAFT_BADGES: CraftBadge[] = [
  { title: 'Heirloom Fabrics', description: 'Hand-selected silks, satins, and organzas', icon: 'award' },
  { title: 'Master Artisans', description: 'Hand embroidered zari and beadwork', icon: 'crown' },
  { title: 'Personalized Care', description: 'Dedicated stylist & sizing consultation', icon: 'heart' },
];

const EMPTY_FORM: AboutUsForm = {
  heroLabel: 'ABOUT MADALSA ATELIER',
  heading: 'Timeless Elegance & Contemporary Grace',
  subheading: 'Discover the artistry, heritage, and vision behind Madalsa Couture.',
  designerName: 'Madalsa Rai',
  designerRole: 'Founder & Creative Director',
  designerImageUrl: '',
  establishedYear: 'Est. 2024',
  founderQuote: 'Couture is not merely fabric and thread—it is an intimate dialogue between emotion, art, and confidence.',
  storyParagraphsText: '',
  virtues: DEFAULT_VIRTUES,
  craftBadges: DEFAULT_CRAFT_BADGES,
  imageBlocks: [],
  status: 'active',
};

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as FetchBaseQueryError;
  return e.status === 404;
}

export const CmsAboutPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useGetAboutUsQuery();
  const [updateAboutUs, { isLoading: isSaving }] = useUpdateAboutUsMutation();
  const [form, setForm] = useState<AboutUsForm>(EMPTY_FORM);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const isNotConfigured = isError && isNotFound(error);
  const showError = isError && !isNotConfigured;

  useEffect(() => {
    if (data) {
      const d = data as unknown as Record<string, unknown>;
      const storyParagraphs = Array.isArray(d.storyParagraphs) ? (d.storyParagraphs as string[]) : [];
      setForm({
        heroLabel: (d.heroLabel as string) ?? 'ABOUT MADALSA ATELIER',
        heading: (d.heading as string) ?? 'Timeless Elegance & Contemporary Grace',
        subheading: (d.subheading as string) ?? 'Discover the artistry, heritage, and vision behind Madalsa Couture.',
        designerName: (d.designerName as string) ?? 'Madalsa Rai',
        designerRole: (d.designerRole as string) ?? 'Founder & Creative Director',
        designerImageUrl: (d.designerImageUrl as string) ?? '',
        establishedYear: (d.establishedYear as string) ?? 'Est. 2024',
        founderQuote: (d.founderQuote as string) ?? 'Couture is not merely fabric and thread—it is an intimate dialogue between emotion, art, and confidence.',
        storyParagraphsText: storyParagraphs.join('\n\n'),
        virtues: Array.isArray(d.virtues) && d.virtues.length > 0 ? (d.virtues as Virtue[]) : DEFAULT_VIRTUES,
        craftBadges: Array.isArray(d.craftBadges) && d.craftBadges.length > 0 ? (d.craftBadges as CraftBadge[]) : DEFAULT_CRAFT_BADGES,
        imageBlocks: Array.isArray(d.imageBlocks) ? (d.imageBlocks as ImageBlock[]) : [],
        status: (d.status as 'active' | 'inactive') ?? 'active',
      });
    }
  }, [data]);

  const handleAddImage = () => {
    setForm(f => ({
      ...f,
      imageBlocks: [...f.imageBlocks, { imageUrl: '', caption: '', displayOrder: f.imageBlocks.length }],
    }));
  };

  const handleImageBlockChange = (index: number, field: keyof ImageBlock, value: string) => {
    setForm(f => ({ ...f, imageBlocks: f.imageBlocks.map((b, i) => i === index ? { ...b, [field]: value } : b) }));
  };

  const handleRemoveImage = (index: number) => {
    setForm(f => ({ ...f, imageBlocks: f.imageBlocks.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const storyParagraphs = form.storyParagraphsText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        heroLabel: form.heroLabel,
        heading: form.heading,
        subheading: form.subheading,
        designerName: form.designerName,
        designerRole: form.designerRole,
        designerImageUrl: form.designerImageUrl,
        establishedYear: form.establishedYear,
        founderQuote: form.founderQuote,
        storyParagraphs,
        virtues: form.virtues,
        craftBadges: form.craftBadges,
        imageBlocks: form.imageBlocks.map((b, i) => ({
          ...(b._id ? { _id: b._id } : {}),
          imageUrl: b.imageUrl,
          caption: b.caption || null,
          displayOrder: i,
        })),
        status: form.status,
      };

      await updateAboutUs(payload as never).unwrap();
      showToast('About Us CMS settings saved!', 'success');
      refetch();
    } catch {
      showToast('Failed to save settings. Please try again.', 'error');
    }
  };

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-canvas space-y-6">
      {toast && (
        <div role="alert" className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900' : 'bg-rose-50/95 border-rose-200 text-rose-900'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {toast.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          </div>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit">
            <BookOpen className="w-3 h-3" /> Brand Story & Founder CMS
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">About Us Studio</h1>
          <p className="text-xs text-slate-500 max-w-lg">Full control over founder bio, story paragraphs, quotes, brand virtues & quality guarantee badges.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/about" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs">
            <Eye className="w-3.5 h-3.5 text-slate-500" /> Preview <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <button type="button" onClick={() => refetch()} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-xs" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <AppButton variant="primary" onClick={handleSubmit} isLoading={isSaving}>
            <Check className="w-4 h-4 mr-1.5" /> Save Changes
          </AppButton>
        </div>
      </div>

      {isLoading ? (
        <div className="py-28 text-center bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-9 h-9 animate-spin text-accent mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Loading About Us content...</p>
        </div>
      ) : showError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600" />
          <p className="text-rose-900 font-bold text-sm">Failed to load About Us data.</p>
          <AppButton variant="primary" size="sm" onClick={() => refetch()}>Retry</AppButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Hero & Subheadings */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">01</div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Banner & Header Content</h2>
                <p className="text-xs text-slate-400">Headlines and banner text shown on the top of the About page</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Top Eyebrow Label</label>
                <input
                  type="text"
                  value={form.heroLabel}
                  onChange={(e) => setForm(f => ({ ...f, heroLabel: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Main Heading</label>
                <input
                  type="text"
                  value={form.heading}
                  onChange={(e) => setForm(f => ({ ...f, heading: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Sub-headline Description</label>
                <textarea
                  rows={2}
                  value={form.subheading}
                  onChange={(e) => setForm(f => ({ ...f, subheading: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Founder Details */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Founder & Creative Director Settings</h2>
                <p className="text-xs text-slate-400">Founder portrait image, name, role, establishment badge & quote</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploader
                imageUrl={form.designerImageUrl}
                onUploaded={(url) => setForm(f => ({ ...f, designerImageUrl: url }))}
                onClear={() => setForm(f => ({ ...f, designerImageUrl: '' }))}
                label="Founder Portrait Image"
                aspectRatio="auto"
              />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designer Name</label>
                  <input
                    type="text"
                    value={form.designerName}
                    onChange={(e) => setForm(f => ({ ...f, designerName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designer Role / Title</label>
                  <input
                    type="text"
                    value={form.designerRole}
                    onChange={(e) => setForm(f => ({ ...f, designerRole: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Established Badge Text</label>
                  <input
                    type="text"
                    value={form.establishedYear}
                    onChange={(e) => setForm(f => ({ ...f, establishedYear: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Founder's Quote</label>
              <textarea
                rows={3}
                value={form.founderQuote}
                onChange={(e) => setForm(f => ({ ...f, founderQuote: e.target.value }))}
                placeholder="Write the founder quote shown on the About page..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              />
            </div>
          </div>

          {/* Card 3: Story Paragraphs */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">03</div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Brand Story Paragraphs</h2>
                <p className="text-xs text-slate-400">Separate paragraphs with a new blank line. Rendered in both "Our Story" section & About page.</p>
              </div>
            </div>
            <textarea
              rows={6}
              value={form.storyParagraphsText}
              onChange={(e) => setForm(f => ({ ...f, storyParagraphsText: e.target.value }))}
              placeholder="Paragraph 1...&#10;&#10;Paragraph 2...&#10;&#10;Paragraph 3..."
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/20 leading-relaxed"
            />
          </div>

          {/* Card 4: Brand Virtues */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">04</div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Virtues Bar (4 Pillars)</h2>
                  <p className="text-xs text-slate-400">Displayed in the horizontal bar below the hero</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {form.virtues.map((v, i) => (
                <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Pillar {i + 1}</span>
                  <input
                    type="text"
                    value={v.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm(f => ({ ...f, virtues: f.virtues.map((item, idx) => idx === i ? { ...item, label: val } : item) }));
                    }}
                    placeholder="Label (e.g. Bespoke Tailoring)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  />
                  <input
                    type="text"
                    value={v.desc}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm(f => ({ ...f, virtues: f.virtues.map((item, idx) => idx === i ? { ...item, desc: val } : item) }));
                    }}
                    placeholder="Description"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Card 5: Gallery */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">05</div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Visual Gallery</h2>
                  <p className="text-xs text-slate-400">Additional image blocks for workshop or store gallery</p>
                </div>
              </div>
              <button type="button" onClick={handleAddImage} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-sm">
                <ImagePlus className="w-3.5 h-3.5" /> Add Image
              </button>
            </div>

            {form.imageBlocks.length === 0 ? (
              <div className="py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <ImagePlus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No additional gallery images added.</p>
                <button type="button" onClick={handleAddImage} className="mt-1 text-indigo-600 text-xs font-bold hover:underline">+ Add image</button>
              </div>
            ) : (
              <div className="space-y-4">
                {form.imageBlocks.map((block, i) => (
                  <div key={i} className="border border-slate-200 rounded-2xl bg-slate-50 p-4 flex gap-4 items-center">
                    <div className="w-24 h-24 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                      {block.imageUrl ? <img src={block.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 space-y-2">
                      <ImageUploader imageUrl={block.imageUrl} onUploaded={(url) => handleImageBlockChange(i, 'imageUrl', url)} onClear={() => handleImageBlockChange(i, 'imageUrl', '')} label={`Image ${i + 1}`} />
                    </div>
                    <button type="button" onClick={() => handleRemoveImage(i)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <AppButton type="submit" variant="primary" size="lg" isLoading={isSaving}>
              <Check className="w-4 h-4 mr-1.5" /> Save About Us CMS
            </AppButton>
          </div>
        </form>
      )}
    </div>
  );
};

export default CmsAboutPage;
