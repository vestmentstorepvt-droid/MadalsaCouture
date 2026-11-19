import React, { useState, useCallback, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Eye,
  Calendar,
  Clock,
  Film,
  Image as ImageIcon,
  AlertCircle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ExternalLink,
  Laptop,
  Smartphone,
  Tablet,
  Check,
  Wand2,
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { AppButton } from '../../../components/ui/button/AppButton';
import ImageUploader from '../../../components/ui/upload/ImageUploader';
import {
  useGetHeroQuery,
  useUpdateHeroMutation,
} from '../../../services/cmsAdminApi';
import type { CmsHeroMedia, CmsHeroStyles } from '../../../services/cmsApi';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { toDatetimeLocal } from '../../../utils/dateTime';

// ─── Backend-aligned Hero form type ─────────────────────────────────────────
interface HeroForm {
  media: CmsHeroMedia[];
  headline: string;
  subHeadline: string;
  cta: { label: string; url: string };
  styles: CmsHeroStyles;
  status: 'active' | 'inactive';
  startsAt?: string | null;
  endsAt?: string | null;
}

const EMPTY_FORM: HeroForm = {
  media: [],
  headline: '',
  subHeadline: '',
  cta: { label: '', url: '' },
  styles: {
    headlineSize: 'large',
    subHeadlineSize: 'medium',
    buttonSize: 'medium',
    buttonStyle: 'outline',
    alignment: 'bottom-left',
  },
  status: 'active',
  startsAt: null,
  endsAt: null,
};

type HeroSection = 'banner' | 'text' | 'design' | 'publish';

const HERO_SECTIONS: Array<{ id: HeroSection; label: string; description: string }> = [
  { id: 'banner', label: 'Banner', description: 'Images and video' },
  { id: 'text', label: 'Text & Button', description: 'Words and links' },
  { id: 'design', label: 'Design', description: 'Style and placement' },
  { id: 'publish', label: 'Publish', description: 'Visibility and timing' },
];

// ─── Quick Presets for 1-Click Luxury Styling ───────────────────────────────
const LUXURY_PRESETS = [
  {
    name: 'Royal Editorial',
    desc: 'Bottom-left classic luxury with gold outline',
    styles: {
      headlineSize: 'large' as const,
      subHeadlineSize: 'medium' as const,
      buttonSize: 'medium' as const,
      buttonStyle: 'outline' as const,
      alignment: 'bottom-left' as const,
    },
  },
  {
    name: 'Festive Glamour',
    desc: 'Center stage with radiant glow CTA',
    styles: {
      headlineSize: 'xlarge' as const,
      subHeadlineSize: 'large' as const,
      buttonSize: 'large' as const,
      buttonStyle: 'gold_glow' as const,
      alignment: 'center' as const,
    },
  },
  {
    name: 'Modern Minimal',
    desc: 'Clean left layout with solid gold accents',
    styles: {
      headlineSize: 'medium' as const,
      subHeadlineSize: 'small' as const,
      buttonSize: 'small' as const,
      buttonStyle: 'solid' as const,
      alignment: 'bottom-left' as const,
    },
  },
  {
    name: 'Grand Runway',
    desc: 'Bottom-center alignment for high drama',
    styles: {
      headlineSize: 'xlarge' as const,
      subHeadlineSize: 'medium' as const,
      buttonSize: 'large' as const,
      buttonStyle: 'outline' as const,
      alignment: 'bottom-center' as const,
    },
  },
];

const HEADLINE_SIZES = [
  { id: 'small', title: 'Small', desc: '20px compact' },
  { id: 'medium', title: 'Medium', desc: '28px balanced' },
  { id: 'large', title: 'Large', desc: '38px editorial' },
  { id: 'xlarge', title: 'Extra large', desc: '52px display' },
] as const satisfies ReadonlyArray<{
  id: NonNullable<CmsHeroStyles['headlineSize']>;
  title: string;
  desc: string;
}>;

const SUB_HEADLINE_SIZES = [
  { id: 'small', title: 'Small', desc: '12px delicate' },
  { id: 'medium', title: 'Medium', desc: '15px standard' },
  { id: 'large', title: 'Large', desc: '18px prominent' },
] as const satisfies ReadonlyArray<{
  id: NonNullable<CmsHeroStyles['subHeadlineSize']>;
  title: string;
  desc: string;
}>;

const BUTTON_SIZES = [
  { id: 'small', title: 'Small', desc: 'Subtle' },
  { id: 'medium', title: 'Medium', desc: 'Balanced' },
  { id: 'large', title: 'Large', desc: 'Easy to notice' },
] as const satisfies ReadonlyArray<{
  id: NonNullable<CmsHeroStyles['buttonSize']>;
  title: string;
  desc: string;
}>;

const BUTTON_STYLES = [
  { id: 'outline', title: 'Gold outline', desc: 'Light and elegant' },
  { id: 'solid', title: 'Solid gold', desc: 'Bold and clear' },
  { id: 'gold_glow', title: 'Soft glow', desc: 'A little extra shine' },
] as const satisfies ReadonlyArray<{
  id: NonNullable<CmsHeroStyles['buttonStyle']>;
  title: string;
  desc: string;
}>;

const TEXT_ALIGNMENTS = [
  { id: 'bottom-left', label: 'Bottom left', icon: AlignLeft, hint: 'Classic' },
  { id: 'bottom-center', label: 'Bottom center', icon: AlignCenter, hint: 'Centered' },
  { id: 'center', label: 'Middle', icon: AlignCenter, hint: 'Main focus' },
  { id: 'bottom-right', label: 'Bottom right', icon: AlignRight, hint: 'Right aligned' },
] as const satisfies ReadonlyArray<{
  id: NonNullable<CmsHeroStyles['alignment']>;
  label: string;
  icon: typeof AlignLeft;
  hint: string;
}>;

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as FetchBaseQueryError;
  return e.status === 404;
}

export const CmsHeroPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useGetHeroQuery();
  const [updateHero, { isLoading: isSaving }] = useUpdateHeroMutation();

  const [form, setForm] = useState<HeroForm>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<HeroForm>(EMPTY_FORM);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<HeroSection>('banner');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('video');
  const [mediaUrlInput, setMediaUrlInput] = useState('');

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const isNotConfigured = isError && isNotFound(error);
  const showError = isError && !isNotConfigured;

  useEffect(() => {
    if (data) {
      const d = data as unknown as Record<string, unknown>;
      const cta = (d.cta as { label?: string; url?: string } | undefined) ?? {};
      const styles = (d.styles as CmsHeroStyles | undefined) ?? {};
      const media = Array.isArray(d.media)
        ? d.media as CmsHeroMedia[]
        : d.mediaUrl
          ? [{ mediaType: (d.mediaType as 'image' | 'video') ?? 'image', mediaUrl: d.mediaUrl as string }]
          : [];
      const loadedForm: HeroForm = {
        media,
        headline: (d.headline as string) ?? '',
        subHeadline: (d.subHeadline as string) ?? '',
        cta: { label: cta.label ?? '', url: cta.url ?? '' },
        styles: {
          headlineSize: styles.headlineSize || 'large',
          subHeadlineSize: styles.subHeadlineSize || 'medium',
          buttonSize: styles.buttonSize || 'medium',
          buttonStyle: styles.buttonStyle || 'outline',
          alignment: styles.alignment || 'bottom-left',
        },
        status: (d.status as 'active' | 'inactive') ?? 'active',
        startsAt: (d.startsAt as string) || null,
        endsAt: (d.endsAt as string) || null,
      };
      // The query response initializes the editable draft; this effect intentionally syncs external server state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(loadedForm);
      setSavedForm(loadedForm);
      setSelectedMediaIndex(0);
    }
  }, [data]);

  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(savedForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.media.length || form.media.some((item) => !item.mediaUrl.trim())) {
      showToast('Add at least one valid hero image or video.', 'error');
      return;
    }

    try {
      await updateHero({
        ...form,
        mediaType: form.media[0].mediaType,
        mediaUrl: form.media[0].mediaUrl,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      } as never).unwrap();
      setSavedForm(form);
      showToast('Hero section & styling saved successfully!', 'success');
      refetch();
    } catch {
      showToast('Failed to save Hero section. Please try again.', 'error');
    }
  };

  const applyPreset = (presetStyles: CmsHeroStyles) => {
    setForm((f) => ({
      ...f,
      styles: { ...f.styles, ...presetStyles },
    }));
    showToast('Preset styling applied to preview!', 'success');
  };

  const addMediaUrl = () => {
    const url = mediaUrlInput.trim();
    if (!url) return;
    setSelectedMediaIndex(form.media.length);
    setForm((current) => ({
      ...current,
      media: [...current.media, { mediaType: newMediaType, mediaUrl: url }],
    }));
    setMediaUrlInput('');
  };

  const removeMedia = (index: number) => {
    const remainingCount = form.media.length - 1;
    setForm((current) => ({
      ...current,
      media: current.media.filter((_, mediaIndex) => mediaIndex !== index),
    }));
    setSelectedMediaIndex((selectedIndex) => {
      if (remainingCount <= 0) return 0;
      if (selectedIndex === index) return Math.min(index, remainingCount - 1);
      return selectedIndex > index ? selectedIndex - 1 : selectedIndex;
    });
  };

  const moveMedia = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= form.media.length) return;
    setSelectedMediaIndex((selectedIndex) => (
      selectedIndex === index
        ? targetIndex
        : selectedIndex === targetIndex
          ? index
          : selectedIndex
    ));
    setForm((current) => {
      const media = [...current.media];
      [media[index], media[targetIndex]] = [media[targetIndex], media[index]];
      return { ...current, media };
    });
  };

  // Preview sizing helpers
  const currentAlignment = form.styles?.alignment || 'bottom-left';
  const currentHeadlineSize = form.styles?.headlineSize || 'large';
  const currentSubHeadlineSize = form.styles?.subHeadlineSize || 'medium';
  const currentButtonSize = form.styles?.buttonSize || 'medium';
  const currentButtonStyle = form.styles?.buttonStyle || 'outline';

  const previewAlignClass =
    currentAlignment === 'bottom-center'
      ? 'bottom-8 left-1/2 -translate-x-1/2 text-center items-center'
      : currentAlignment === 'center'
        ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center items-center'
        : currentAlignment === 'bottom-right'
          ? 'bottom-8 right-8 text-right items-end'
          : 'bottom-8 left-8 text-left items-start';

  const previewHeadlineClass =
    currentHeadlineSize === 'small'
      ? 'text-base sm:text-lg md:text-xl'
      : currentHeadlineSize === 'medium'
        ? 'text-lg sm:text-xl md:text-2xl'
        : currentHeadlineSize === 'xlarge'
          ? 'text-2xl sm:text-3xl md:text-5xl'
          : 'text-xl sm:text-2xl md:text-3xl'; // large (default)

  const previewSubHeadlineClass =
    currentSubHeadlineSize === 'small'
      ? 'text-[11px] sm:text-xs'
      : currentSubHeadlineSize === 'large'
        ? 'text-xs sm:text-base'
        : 'text-xs sm:text-sm'; // medium (default)

  const previewButtonSizeClass =
    currentButtonSize === 'small'
      ? 'px-4 py-2 text-[10px]'
      : currentButtonSize === 'large'
        ? 'px-7 py-3.5 text-xs sm:text-sm'
        : 'px-5 py-2.5 text-xs'; // medium (default)

  const previewButtonStyleClass =
    currentButtonStyle === 'solid'
      ? 'bg-[#D4AF37] text-black hover:bg-[#c49f2e] border border-[#D4AF37]'
      : currentButtonStyle === 'gold_glow'
        ? 'bg-linear-to-r from-[#D4AF37] to-[#F3E5AB] text-black shadow-lg shadow-[#D4AF37]/30 hover:scale-105 border-none'
        : 'border border-[#D4AF37] bg-black/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black'; // outline
  const previewMedia = form.media[selectedMediaIndex];
  const previewImageUrl = previewDevice === 'mobile'
    ? previewMedia?.mobileMediaUrl || previewMedia?.mediaUrl
    : previewMedia?.mediaUrl;
  const previewUsesDesktopFallback =
    previewDevice === 'mobile' &&
    previewMedia?.mediaType === 'image' &&
    !previewMedia.mobileMediaUrl;

  return (
    <div className="min-h-screen bg-[#FAFAFC] px-4 py-5 text-slate-800 sm:px-6 sm:py-8">
      {/* Toast Alert */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${toast.type === 'success'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-500/10'
              : 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-500/10'
            }`}
        >
          {toast.type === 'success' ? (
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Check className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Top Header & Action Bar ────────────────────────────────────────── */}
      <div className="mx-auto mb-6 flex max-w-[1600px] flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6 lg:flex-row lg:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[11px] font-bold text-[#E85D88]">
              <Sparkles className="h-3 w-3" /> Homepage banner
            </span>
            <div className="flex items-center gap-1.5" aria-live="polite">
              <div
                className={`h-2 w-2 rounded-full ${form.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
              />
              <span className="text-xs font-semibold text-slate-600">
                {form.status === 'active' ? 'Set to show on your store' : 'Hidden from your store'}
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Homepage banner</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Choose the images, message and style shoppers see at the top of your homepage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`mr-auto text-xs font-medium lg:mr-1 ${hasUnsavedChanges ? 'text-amber-700' : 'text-emerald-700'}`} aria-live="polite">
            {hasUnsavedChanges ? 'You have unsaved changes' : 'All changes saved'}
          </span>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88]"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" /> View store <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={hasUnsavedChanges}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] disabled:cursor-not-allowed disabled:opacity-40"
            title={hasUnsavedChanges ? 'Save changes before reloading' : 'Reload saved settings'}
            aria-label={hasUnsavedChanges ? 'Reload disabled while you have unsaved changes' : 'Reload saved settings'}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <AppButton
            type="button"
            variant="primary"
            size="md"
            onClick={handleSubmit}
            isLoading={isSaving}
            disabled={!hasUnsavedChanges || isSaving}
            className="min-h-10"
          >
            <Check className="mr-1.5 h-4 w-4" /> Save changes
          </AppButton>
        </div>
      </div>

      {isLoading ? (
        <div className="mx-auto max-w-[1600px] rounded-3xl border border-slate-200 bg-white py-28 text-center text-slate-500">
          <RefreshCw className="mx-auto mb-3 h-9 w-9 animate-spin text-[#E85D88]" />
          <p className="text-sm font-bold text-slate-800">Loading your homepage banner…</p>
          <p className="mt-1 text-xs text-slate-400">Your saved images and settings will appear here.</p>
        </div>
      ) : showError ? (
        <div role="alert" className="mx-auto flex max-w-[1600px] flex-col items-center gap-3 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600" />
          <p className="text-sm font-bold text-rose-900">We couldn’t load your homepage banner.</p>
          <p className="text-xs text-rose-800">Check your connection and try again. Your saved content hasn’t been changed.</p>
          <AppButton variant="primary" size="sm" onClick={() => refetch()}>
            Try again
          </AppButton>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-start gap-5 xl:grid-cols-12 xl:gap-6">
          {/* ── Left Column: Form Controls (7 cols) ─────────────────────────── */}
          <div className="order-last space-y-5 xl:order-first xl:col-span-7">
            {/* 1-Click Luxury Presets Bar */}
            {activeTab === 'design' && (
            <div className="space-y-3 rounded-3xl border border-white/10 bg-linear-to-r from-[#1E1727] to-[#120E16] p-4 text-white shadow-lg sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" /> Quick style ideas
                </span>
                <span className="text-[10px] text-white/50">Choose one to try it</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {LUXURY_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p.styles)}
                    className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#D4AF37]/50 text-left transition group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-[#D4AF37] transition block truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-white/60 line-clamp-1 block mt-0.5">
                      {p.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            )}

            <nav aria-label="Homepage banner setup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HERO_SECTIONS.map((section, index) => {
                const isActive = activeTab === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveTab(section.id)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex min-h-[76px] items-start gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] sm:p-4 ${isActive
                        ? 'border-[#E85D88] bg-white shadow-sm ring-2 ring-[#E85D88]/10'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'
                      }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isActive ? 'bg-[#E85D88] text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-bold sm:text-sm ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{section.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-slate-500 sm:text-xs">{section.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Form Accordion Cards */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* ── CARD 1: Background Media ──────────────────────────────────── */}
              {activeTab === 'banner' && (
                <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-pink-50 text-[#E85D88] flex items-center justify-center font-bold text-xs">
                        01
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Add your banner</h2>
                        <p className="text-[11px] text-slate-500">One item shows as a single banner. Add more items to rotate between them.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setNewMediaType('video')}
                      aria-pressed={newMediaType === 'video'}
                      className={`flex min-h-12 items-center justify-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] ${newMediaType === 'video'
                          ? 'border-[#E85D88] bg-pink-50/50 text-[#E85D88] ring-2 ring-[#E85D88]/20 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      <Film className="h-4 w-4" /> Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMediaType('image')}
                      aria-pressed={newMediaType === 'image'}
                      className={`flex min-h-12 items-center justify-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] ${newMediaType === 'image'
                          ? 'border-[#E85D88] bg-pink-50/50 text-[#E85D88] ring-2 ring-[#E85D88]/20 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      <ImageIcon className="h-4 w-4" /> Image
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      {newMediaType === 'video' ? 'Upload a video' : 'Upload an image'}
                    </label>
                    <ImageUploader
                      imageUrl=""
                      onUploaded={(url) => {
                        setSelectedMediaIndex(form.media.length);
                        setForm((f) => ({
                          ...f,
                          media: [...f.media, { mediaType: newMediaType, mediaUrl: url }],
                        }));
                      }}
                      onClear={() => undefined}
                      label={newMediaType === 'video' ? 'Video File' : 'Photo File'}
                      hint={
                        newMediaType === 'video'
                          ? 'Choose a video to add it as a new homepage slide.'
                          : 'For best results, use a wide image around 1920 × 1080 px.'
                      }
                      folder="Madalsa/banners"
                      tags="hero, banner, homepage"
                      acceptType={newMediaType}
                    />
                    <div className="pt-1">
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                        Or paste a media link
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={mediaUrlInput}
                          onChange={(e) => setMediaUrlInput(e.target.value)}
                          placeholder="Paste an image or video URL"
                          aria-label="Image or video URL"
                          className="min-w-0 flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                        />
                        <button
                          type="button"
                          onClick={addMediaUrl}
                          disabled={!mediaUrlInput.trim()}
                          className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#E85D88] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#d64f78] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] focus-visible:ring-offset-2"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-800">
                      {form.media.length > 1 ? 'Your slides' : 'Your banner'} <span className="font-normal text-slate-500">({form.media.length})</span>
                    </p>
                    {form.media.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                        Your banner will appear here. Upload an image or video to get started.
                      </p>
                    ) : (
                      <ol className="space-y-2">
                        {form.media.map((item, index) => (
                          <li
                            key={`${item.mediaUrl}-${index}`}
                            className={`space-y-3 rounded-2xl border p-3 transition ${selectedMediaIndex === index ? 'border-[#E85D88] bg-rose-50/30 ring-2 ring-[#E85D88]/10' : 'border-slate-200 bg-white'}`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setSelectedMediaIndex(index)}
                                aria-pressed={selectedMediaIndex === index}
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88]"
                              >
                                {item.mediaType === 'video' ? (
                                  <video src={item.mediaUrl} muted playsInline className="h-14 w-20 shrink-0 rounded-lg bg-slate-100 object-cover" />
                                ) : (
                                  <img src={item.mediaUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg bg-slate-100 object-cover" />
                                )}
                                <span className="min-w-0">
                                  <span className="block text-xs font-bold text-slate-800">
                                    {form.media.length > 1 ? `Slide ${index + 1}` : 'Homepage banner'}
                                    <span className="font-medium text-slate-500"> · {item.mediaType === 'video' ? 'Video' : 'Image'}</span>
                                  </span>
                                  <span className="mt-1 block truncate text-[11px] text-slate-500">
                                    {selectedMediaIndex === index ? 'Showing in preview' : 'Select to preview'}
                                  </span>
                                </span>
                              </button>
                              <button type="button" onClick={() => moveMedia(index, -1)} disabled={index === 0} aria-label={`Move slide ${index + 1} up`} className="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88]">
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => moveMedia(index, 1)} disabled={index === form.media.length - 1} aria-label={`Move slide ${index + 1} down`} className="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88]">
                                <ArrowDown className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => removeMedia(index)} aria-label={`Remove slide ${index + 1}`} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            {item.mediaType === 'image' && (
                              <div className="border-t border-slate-100 pt-3">
                                <p className="mb-1 text-xs font-bold text-slate-700">Mobile image <span className="font-normal text-slate-500">(optional)</span></p>
                                <p className="mb-2 text-[11px] leading-5 text-slate-500">
                                  Phones use this image. If you leave it empty, the desktop image is used instead.
                                </p>
                                <ImageUploader
                                  imageUrl={item.mobileMediaUrl || ''}
                                  onUploaded={(url) => setForm((f) => ({
                                    ...f,
                                    media: f.media.map((media, mediaIndex) =>
                                      mediaIndex === index ? { ...media, mobileMediaUrl: url } : media
                                    ),
                                  }))}
                                  onClear={() => setForm((f) => ({
                                    ...f,
                                    media: f.media.map((media, mediaIndex) => {
                                      if (mediaIndex !== index) return media;
                                      const desktopMedia = { ...media };
                                      delete desktopMedia.mobileMediaUrl;
                                      return desktopMedia;
                                    }),
                                  }))}
                                  label={item.mobileMediaUrl ? 'Replace mobile image' : 'Add mobile image'}
                                  hint="Recommended size: 1200 × 1000 px"
                                  folder="Madalsa/banners"
                                  tags="hero, banner, homepage, mobile"
                                  aspectRatio="video"
                                  acceptType="image"
                                />
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              )}

              {/* ── CARD 2: Headline & Typography ─────────────────────────────── */}
              {activeTab === 'text' && (
                <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                        02
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Add your message</h2>
                        <p className="text-[11px] text-slate-500">Write the words shoppers will see on the banner.</p>
                      </div>
                    </div>
                  </div>

                  {/* Main Headline */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="hero-headline" className="text-xs font-bold text-slate-700">Headline <span className="font-normal text-slate-500">(optional)</span></label>
                      <span className="text-[11px] text-slate-400">{form.headline.length}/80</span>
                    </div>
                    <input
                      id="hero-headline"
                      type="text"
                      value={form.headline}
                      onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                      placeholder="e.g. Madalsa Couture"
                      maxLength={80}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-serif tracking-wider bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                    />
                  </div>

                  {/* Headline Size Pills */}
                  <div>
                    <span className="mb-2 block text-xs font-semibold text-slate-700">
                      Headline size
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {HEADLINE_SIZES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={currentHeadlineSize === s.id}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              styles: { ...f.styles, headlineSize: s.id },
                            }))
                          }
                          className={`rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] ${currentHeadlineSize === s.id
                              ? 'border-[#E85D88] bg-pink-50/60 text-[#E85D88] ring-2 ring-[#E85D88]/20 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          <span className="text-xs font-bold block">{s.title}</span>
                          <span className="text-[10px] text-slate-400 block">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sub-headline Text */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label htmlFor="hero-subheadline" className="block text-xs font-bold text-slate-700">
                      Supporting line <span className="font-normal text-slate-500">(optional)</span>
                    </label>
                    <input
                      id="hero-subheadline"
                      type="text"
                      value={form.subHeadline}
                      onChange={(e) => setForm((f) => ({ ...f, subHeadline: e.target.value }))}
                      placeholder="e.g. Wear your story. Own the moment."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                    />
                  </div>

                  {/* Sub-headline Size Pills */}
                  <div>
                    <span className="mb-2 block text-xs font-semibold text-slate-700">
                      Supporting line size
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {SUB_HEADLINE_SIZES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={currentSubHeadlineSize === s.id}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              styles: { ...f.styles, subHeadlineSize: s.id },
                            }))
                          }
                          className={`rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] ${currentSubHeadlineSize === s.id
                              ? 'border-[#E85D88] bg-pink-50/60 text-[#E85D88] ring-2 ring-[#E85D88]/20 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          <span className="text-xs font-bold block">{s.title}</span>
                          <span className="text-[10px] text-slate-400 block">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── CARD 3: CTA Button Sizing & Appearance ────────────────────── */}
              {activeTab === 'text' && (
                <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                        03
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Add a button</h2>
                        <p className="text-[11px] text-slate-500">Leave either field empty if you don’t want a button.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="hero-cta-label" className="mb-1 block text-xs font-bold text-slate-700">
                        Button text
                      </label>
                      <input
                        id="hero-cta-label"
                        type="text"
                        value={form.cta.label}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, cta: { ...f.cta, label: e.target.value } }))
                        }
                        placeholder="e.g. Explore Collection"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="hero-cta-url" className="mb-1 block text-xs font-bold text-slate-700">
                        Where the button goes
                      </label>
                      <input
                        id="hero-cta-url"
                        type="text"
                        value={form.cta.url}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, cta: { ...f.cta, url: e.target.value } }))
                        }
                        placeholder="/collections"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20"
                      />
                    </div>
                  </div>

                  {/* Button Size Selector */}
                  <div>
                    <span className="mb-2 block text-xs font-semibold text-slate-700">
                      Button size
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {BUTTON_SIZES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={currentButtonSize === s.id}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              styles: { ...f.styles, buttonSize: s.id },
                            }))
                          }
                          className={`rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] ${currentButtonSize === s.id
                              ? 'border-[#E85D88] bg-pink-50/60 text-[#E85D88] ring-2 ring-[#E85D88]/20 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          <span className="text-xs font-bold block">{s.title}</span>
                          <span className="text-[10px] text-slate-400 block">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Button Style Variant Selector */}
                  <div>
                    <span className="mb-2 block text-xs font-semibold text-slate-700">
                      Button appearance
                    </span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {BUTTON_STYLES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={currentButtonStyle === s.id}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              styles: { ...f.styles, buttonStyle: s.id },
                            }))
                          }
                          className={`rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] ${currentButtonStyle === s.id
                              ? 'border-amber-500 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          <span className="block text-xs font-bold">{s.title}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'design' && (
                <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-blue-600">
                        03
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Choose where the text appears</h2>
                        <p className="text-[11px] text-slate-500">Pick a position that stays clear of important details in your image.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="mb-2 block text-xs font-semibold text-slate-700">Text position</span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {TEXT_ALIGNMENTS.map((a) => {
                        const Icon = a.icon;
                        const isSel = currentAlignment === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                styles: { ...f.styles, alignment: a.id },
                              }))
                            }
                            aria-pressed={isSel}
                            className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] ${isSel
                                ? 'border-[#E85D88] bg-pink-50/60 text-[#E85D88] ring-2 ring-[#E85D88]/20 shadow-xs'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-bold">{a.label}</span>
                            <span className="text-[9px] text-slate-400">{a.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'publish' && (
                <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700">04</div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Choose when your banner appears</h2>
                      <p className="text-[11px] text-slate-500">You can show it now or set a start and end time.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="hero-starts-at" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" /> Start showing (optional)
                      </label>
                      {/* Browsers give datetime fields no clear button, so the optional date gets its own. */}
                      <div className="flex gap-2">
                        <input
                          id="hero-starts-at"
                          type="datetime-local"
                          value={toDatetimeLocal(form.startsAt)}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, startsAt: e.target.value || null }))
                          }
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20"
                        />
                        {form.startsAt && (
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, startsAt: null }))}
                            aria-label="Clear start date"
                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{form.startsAt ? '' : 'No start date: shows as soon as it is turned on.'}</p>
                    </div>
                    <div>
                      <label htmlFor="hero-ends-at" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-slate-400" /> Stop showing (optional)
                      </label>
                      {/* Browsers give datetime fields no clear button, so the optional date gets its own. */}
                      <div className="flex gap-2">
                        <input
                          id="hero-ends-at"
                          type="datetime-local"
                          value={toDatetimeLocal(form.endsAt)}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, endsAt: e.target.value || null }))
                          }
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20"
                        />
                        {form.endsAt && (
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, endsAt: null }))}
                            aria-label="Clear end date"
                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{form.endsAt ? '' : 'No end date: keeps showing until you turn it off.'}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="block text-sm font-bold text-slate-900">Show banner on homepage</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {form.status === 'active' ? 'Your banner is set to appear on the store.' : 'Your banner is hidden until you turn this on.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.status === 'active'}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          status: f.status === 'active' ? 'inactive' : 'active',
                        }))
                      }
                      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88] focus-visible:ring-offset-2 ${form.status === 'active'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                        }`}
                    >
                      {form.status === 'active' ? <><Check className="h-4 w-4" /> On</> : 'Off'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
                <span className={`text-xs ${hasUnsavedChanges ? 'text-amber-700' : 'text-slate-500'}`} aria-live="polite">
                  {hasUnsavedChanges ? 'Remember to save your changes.' : 'Your latest changes are saved.'}
                </span>
                <AppButton type="submit" variant="primary" size="lg" isLoading={isSaving} disabled={!hasUnsavedChanges || isSaving}>
                  <Check className="mr-1.5 h-4 w-4" /> Save changes
                </AppButton>
              </div>
            </form>
          </div>

          {/* ── Right Column: Interactive Studio Workbench (5 cols) ─────────── */}
          <div className="order-first space-y-4 xl:sticky xl:top-6 xl:order-last xl:col-span-5">
            <div className="bg-[#120E16] text-white p-5 rounded-3xl border border-white/10 shadow-2xl space-y-4">
              {/* Workbench Top Bar */}
              <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
                  <span className="text-sm font-bold text-white">
                    Live preview
                  </span>
                  <span className="text-[11px] text-white/55">
                    {previewMedia ? `Slide ${selectedMediaIndex + 1} of ${form.media.length}` : 'Add a banner to preview it'}
                  </span>
                </div>

                {/* Device Selector */}
                <div className="flex w-full items-center gap-1 rounded-xl bg-white/10 p-1 text-xs sm:w-auto" role="group" aria-label="Preview device">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    aria-pressed={previewDevice === 'desktop'}
                    className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] sm:flex-none ${previewDevice === 'desktop' ? 'bg-[#D4AF37] text-black font-bold' : 'text-white/70 hover:text-white'
                      }`}
                    aria-label="Preview on desktop"
                  >
                    <Laptop className="h-3.5 w-3.5" /><span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('tablet')}
                    aria-pressed={previewDevice === 'tablet'}
                    className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] sm:flex-none ${previewDevice === 'tablet' ? 'bg-[#D4AF37] text-black font-bold' : 'text-white/70 hover:text-white'
                      }`}
                    aria-label="Preview on tablet"
                  >
                    <Tablet className="h-3.5 w-3.5" /><span>Tablet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    aria-pressed={previewDevice === 'mobile'}
                    className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] sm:flex-none ${previewDevice === 'mobile' ? 'bg-[#D4AF37] text-black font-bold' : 'text-white/70 hover:text-white'
                      }`}
                    aria-label="Preview on mobile"
                  >
                    <Smartphone className="h-3.5 w-3.5" /><span>Mobile</span>
                  </button>
                </div>
              </div>

              {/* Realistic Browser Frame */}
              <div
                className={`mx-auto rounded-2xl border border-white/15 bg-black/60 overflow-hidden shadow-2xl transition-all duration-300 ${previewDevice === 'mobile'
                    ? 'max-w-[260px]'
                    : previewDevice === 'tablet'
                      ? 'max-w-[420px]'
                      : 'w-full'
                  }`}
              >
                {/* Browser Address Header */}
                <div className="bg-[#1A1423] px-3.5 py-2 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-rose-500/80" />
                    <div className="w-2 h-2 rounded-full bg-amber-500/80" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[10px] text-white/50 font-mono truncate max-w-[160px]">
                    madalsacouture.com
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-[#D4AF37] font-mono">
                    HTTPS
                  </span>
                </div>

                {/* Hero Banner Canvas */}
                <div
                  aria-label={`Homepage banner preview for ${previewDevice}`}
                  className={`relative overflow-hidden bg-slate-950 flex transition-all duration-300 ${previewDevice === 'mobile'
                      ? 'aspect-[6/5]'
                      : previewDevice === 'tablet'
                        ? 'aspect-[4/3]'
                        : 'aspect-video'
                    }`}
                >
                  {/* Background Media */}
                  {previewMedia?.mediaType === 'image' ? (
                    <img
                      src={previewImageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  ) : previewMedia?.mediaType === 'video' ? (
                    <video
                      src={previewMedia.mediaUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-linear-to-b from-[#1E1727] via-[#2D1F38] to-[#120E16] flex items-center justify-center text-center p-4">
                      <span className="text-center text-sm text-white/70">Your banner preview will appear here after you add an image or video.</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

                  {/* Dynamic Content Overlay (Sizes & Positions in Real-Time) */}
                  <div className={`absolute z-10 p-6 max-w-sm flex flex-col pointer-events-auto ${previewAlignClass}`}>
                    <h3
                      className={`font-serif font-normal tracking-[0.3em] uppercase text-white drop-shadow-md transition-all ${previewHeadlineClass}`}
                    >
                      {form.headline}
                    </h3>
                    {!form.headline && !form.subHeadline && !form.cta.label && (
                      <span className="text-xs text-white/50">Text and button are optional</span>
                    )}
                    {form.subHeadline && (
                      <p
                        className={`mt-1 font-light tracking-[0.15em] text-slate-200 opacity-90 drop-shadow-sm transition-all ${previewSubHeadlineClass}`}
                      >
                        {form.subHeadline}
                      </p>
                    )}

                    {form.cta.label && form.cta.url && (
                      <div className="mt-3.5">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 font-medium uppercase tracking-[0.3em] backdrop-blur-sm transition-all duration-300 shadow-md ${previewButtonSizeClass} ${previewButtonStyleClass}`}
                        >
                          {form.cta.label}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {previewUsesDesktopFallback && (
                <p className="text-center text-[11px] text-white/60" aria-live="polite">
                  No mobile image added for this slide. The desktop image is shown on mobile.
                </p>
              )}

              {/* Status Info Chips */}
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[11px] text-white/70">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40">Text position:</span>
                  <span className="font-bold text-white capitalize">{currentAlignment.replace('-', ' ')}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-white/40">Headline:</span>
                  <span className="font-bold text-[#D4AF37] capitalize">{currentHeadlineSize}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CmsHeroPage;
