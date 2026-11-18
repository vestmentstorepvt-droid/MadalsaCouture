import React, { useState, useCallback, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Eye,
  Calendar,
  Clock,
  ExternalLink,
  Check,
  AlertCircle,
  Laptop,
  Smartphone,
  Tablet,
  Wand2,
  Palette,
  Link as LinkIcon,
  Timer,
  Sliders,
  Type,
  Layers,
} from 'lucide-react';
import { AppButton } from '../../../components/ui/button/AppButton';
import {
  useGetAnnouncementBarQuery,
  useUpdateAnnouncementBarMutation,
} from '../../../services/cmsAdminApi';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { formatLocalInput, toDatetimeLocal } from '../../../utils/dateTime';

// ─── Backend-aligned Announcement Bar form type ─────────────────────────────
interface AnnouncementForm {
  message: string;
  link: string;
  backgroundColor: string;
  textColor: string;
  countdownTarget: string | null;
  status: 'active' | 'inactive';
  startsAt: string | null;
  endsAt: string | null;
}

const EMPTY_FORM: AnnouncementForm = {
  message: '✨ Free Shipping on Orders Above ₹4,999 | Festive Sale is LIVE!',
  link: '/collections',
  backgroundColor: '#D4AF37',
  textColor: '#000000',
  countdownTarget: null,
  status: 'active',
  startsAt: null,
  endsAt: null,
};

// ─── 1-Click Luxury Theme & Message Presets ─────────────────────────────────
const LUXURY_PRESETS = [
  {
    name: 'Royal Gold Festive',
    message: '✨ Festive Sale is LIVE! Enjoy up to 40% Off Handcrafted Couture',
    link: '/collections/festive-wear',
    bg: '#D4AF37',
    text: '#000000',
    desc: 'Classic gold with bold dark contrast',
  },
  {
    name: 'Midnight Black Luxury',
    message: '✨ Free Express Worldwide Shipping on Orders Above ₹4,999',
    link: '/collections',
    bg: '#120E16',
    text: '#D4AF37',
    desc: 'Deep obsidian with gold typography',
  },
  {
    name: 'Crimson Flash Sale',
    message: '⏳ Limited Flash Drop: Exclusive 20% Off at Checkout | Code: MADALSA20',
    link: '/sale',
    bg: '#8B0000',
    text: '#FFFFFF',
    desc: 'High-urgency rich velvet crimson',
  },
  {
    name: 'Madalsa Rose Edit',
    message: '🌸 Just Launched: The Spring/Summer 2026 Silk Bridal Edit',
    link: '/collections/bridal',
    bg: '#E85D88',
    text: '#FFFFFF',
    desc: 'Signature Madalsa pink vibrancy',
  },
];

// Curated Palette Colors
const PALETTE_BG = [
  { label: 'Royal Gold', hex: '#D4AF37' },
  { label: 'Midnight Black', hex: '#120E16' },
  { label: 'Madalsa Rose', hex: '#E85D88' },
  { label: 'Crimson Velvet', hex: '#8B0000' },
  { label: 'Deep Emerald', hex: '#0B3B24' },
  { label: 'Slate Navy', hex: '#1E293B' },
];

const PALETTE_TEXT = [
  { label: 'Pitch Black', hex: '#000000' },
  { label: 'Pure White', hex: '#FFFFFF' },
  { label: 'Royal Gold', hex: '#D4AF37' },
  { label: 'Rose Gold', hex: '#F3E5AB' },
];

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as FetchBaseQueryError;
  return e.status === 404;
}

export const CmsAnnouncementPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useGetAnnouncementBarQuery();
  const [updateAnnouncementBar, { isLoading: isSaving }] = useUpdateAnnouncementBarMutation();

  const [form, setForm] = useState<AnnouncementForm>(EMPTY_FORM);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'all' | 'message' | 'styling' | 'countdown' | 'schedule'>('all');

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const isNotConfigured = isError && isNotFound(error);
  const showError = isError && !isNotConfigured;

  useEffect(() => {
    if (data) {
      const d = data as unknown as Record<string, unknown>;
      setForm({
        message: (d.message as string) || (d.text as string) || '',
        link: (d.link as string) || '',
        backgroundColor: (d.backgroundColor as string) || '#D4AF37',
        textColor: (d.textColor as string) || '#000000',
        countdownTarget: (d.countdownTarget as string) || null,
        status: (d.status as 'active' | 'inactive') || (d.isActive ? 'active' : 'inactive'),
        startsAt: (d.startsAt as string) || null,
        endsAt: (d.endsAt as string) || null,
      });
    }
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) {
      showToast('Announcement message is required.', 'error');
      return;
    }

    try {
      await updateAnnouncementBar({
        ...form,
        countdownTarget: form.countdownTarget ? new Date(form.countdownTarget).toISOString() : null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      } as never).unwrap();
      showToast('Announcement bar saved successfully!', 'success');
      refetch();
    } catch {
      showToast('Failed to save announcement bar. Please try again.', 'error');
    }
  };

  const applyPreset = (preset: typeof LUXURY_PRESETS[0]) => {
    setForm((f) => ({
      ...f,
      message: preset.message,
      link: preset.link,
      backgroundColor: preset.bg,
      textColor: preset.text,
    }));
    showToast(`Applied preset "${preset.name}"!`, 'success');
  };

  const setTimerOffsetHours = (hours: number) => {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    setForm((f) => ({ ...f, countdownTarget: formatLocalInput(target) }));
    showToast(`Countdown set to +${hours} hours from now!`, 'success');
  };

  const messageLength = form.message.length;

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-[#FAFAFC] text-slate-800 space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
            toast.type === 'success'
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" /> Global Store Header
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  form.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span className="text-xs font-semibold text-slate-600">
                {form.status === 'active' ? 'Live on Store' : 'Draft / Inactive'}
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Announcement Bar Studio</h1>
          <p className="text-xs text-slate-500 max-w-xl">
            Configure the top ticker banner across every storefront page with custom color palettes, destination links, countdown clocks, and automated campaign windows.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" /> View Storefront <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-xs"
            title="Refresh from server"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <AppButton
            type="button"
            variant="primary"
            size="md"
            onClick={handleSubmit}
            isLoading={isSaving}
          >
            <Check className="w-4 h-4 mr-1.5" /> Save Announcement Bar
          </AppButton>
        </div>
      </div>

      {isLoading ? (
        <div className="py-28 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-9 h-9 animate-spin text-[#E85D88] mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Synchronizing Announcement Bar...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to MongoDB singleton...</p>
        </div>
      ) : showError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600" />
          <p className="text-rose-900 font-bold text-sm">Failed to connect to Announcement Bar singleton.</p>
          <AppButton variant="primary" size="sm" onClick={() => refetch()}>
            Retry Connection
          </AppButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* ── Left Column: Form Controls (7 cols) ─────────────────────────── */}
          <div className="xl:col-span-7 space-y-5">
            {/* 1-Click Luxury Presets Bar */}
            <div className="bg-linear-to-r from-[#1E1727] to-[#120E16] text-white p-4 sm:p-5 rounded-3xl border border-white/10 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" /> 1-Click Campaign Themes
                </span>
                <span className="text-[10px] text-white/50 font-mono">Quick Load</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {LUXURY_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#D4AF37]/50 text-left transition group"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: p.bg }} />
                      <span className="text-xs font-bold text-white group-hover:text-[#D4AF37] transition block truncate">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/60 line-clamp-1 block">
                      {p.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
              {[
                { id: 'all', label: 'All Settings', icon: Sliders },
                { id: 'message', label: '1. Message & Link', icon: Type },
                { id: 'styling', label: '2. Colors & Styling', icon: Palette },
                { id: 'countdown', label: '3. Countdown Clock', icon: Timer },
                { id: 'schedule', label: '4. Campaign Schedule', icon: Layers },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Form Accordion Cards */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* ── CARD 1: Announcement Message & Destination Link ───────────── */}
              {(activeTab === 'all' || activeTab === 'message') && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-pink-50 text-[#E85D88] flex items-center justify-center font-bold text-xs">
                        01
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Announcement Message & Link</h2>
                        <p className="text-[11px] text-slate-400">The primary announcement copy and optional click-through URL</p>
                      </div>
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Announcement Message *</label>
                      <span className={`text-[11px] font-mono ${messageLength > 120 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {messageLength}/140
                      </span>
                    </div>
                    <input
                      type="text"
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="✨ Free Shipping on Orders Above ₹4,999 | Festive Sale is LIVE!"
                      maxLength={140}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                      required
                    />
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      💡 Tip: Keep under 90 characters for optimal visibility on mobile screens.
                    </p>
                  </div>

                  {/* Destination Link */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-400" /> Click-Through Destination Link (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.link}
                      onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                      placeholder="/collections/festive-wear or https://..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                    />
                  </div>
                </div>
              )}

              {/* ── CARD 2: Visual Colors & Theme ─────────────────────────────── */}
              {(activeTab === 'all' || activeTab === 'styling') && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                        02
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Color Palette & Contrast</h2>
                        <p className="text-[11px] text-slate-400">Choose luxury color combinations for maximum elegance</p>
                      </div>
                    </div>
                  </div>

                  {/* Background Color */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Banner Background Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.backgroundColor}
                          onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
                          className="w-7 h-7 rounded-lg cursor-pointer border border-slate-200 p-0"
                        />
                        <span className="text-xs font-mono font-bold text-slate-600 uppercase">{form.backgroundColor}</span>
                      </div>
                    </div>

                    {/* Quick BG Swatches */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {PALETTE_BG.map((p) => {
                        const isSel = form.backgroundColor.toLowerCase() === p.hex.toLowerCase();
                        return (
                          <button
                            key={p.hex}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, backgroundColor: p.hex }))}
                            className={`p-2 rounded-xl border flex items-center gap-1.5 transition ${
                              isSel
                                ? 'border-slate-900 ring-2 ring-slate-900/20 bg-slate-50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span className="w-4 h-4 rounded-full border border-slate-300 shadow-xs shrink-0" style={{ backgroundColor: p.hex }} />
                            <span className="text-[10px] font-semibold truncate text-slate-700">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Text Color */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Text & Icon Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.textColor}
                          onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
                          className="w-7 h-7 rounded-lg cursor-pointer border border-slate-200 p-0"
                        />
                        <span className="text-xs font-mono font-bold text-slate-600 uppercase">{form.textColor}</span>
                      </div>
                    </div>

                    {/* Quick Text Swatches */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PALETTE_TEXT.map((p) => {
                        const isSel = form.textColor.toLowerCase() === p.hex.toLowerCase();
                        return (
                          <button
                            key={p.hex}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, textColor: p.hex }))}
                            className={`p-2 rounded-xl border flex items-center gap-1.5 transition ${
                              isSel
                                ? 'border-slate-900 ring-2 ring-slate-900/20 bg-slate-50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span className="w-4 h-4 rounded-full border border-slate-300 shadow-xs shrink-0" style={{ backgroundColor: p.hex }} />
                            <span className="text-[10px] font-semibold truncate text-slate-700">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── CARD 3: Countdown Clock Target ────────────────────────────── */}
              {(activeTab === 'all' || activeTab === 'countdown') && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                        03
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Urgency Countdown Clock</h2>
                        <p className="text-[11px] text-slate-400">Display a real-time ticking countdown badge (e.g. Sale Ends in 05h : 22m)</p>
                      </div>
                    </div>
                    {form.countdownTarget && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, countdownTarget: null }))}
                        className="text-xs font-bold text-rose-500 hover:underline"
                      >
                        Clear Timer
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Countdown Target Date & Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={toDatetimeLocal(form.countdownTarget)}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, countdownTarget: e.target.value || null }))
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20"
                      />
                    </div>

                    {/* Quick Timer Helpers */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Quick Duration Shortcuts
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { hours: 12, label: '+12 Hours' },
                          { hours: 24, label: '+24 Hours (1 Day)' },
                          { hours: 72, label: '+3 Days' },
                          { hours: 168, label: '+7 Days (1 Wk)' },
                        ].map((q) => (
                          <button
                            key={q.hours}
                            type="button"
                            onClick={() => setTimerOffsetHours(q.hours)}
                            className="py-2 px-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition text-center"
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CARD 4: Campaign Schedule & Storefront Visibility ─────────── */}
              {(activeTab === 'all' || activeTab === 'schedule') && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                        04
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Campaign Schedule & Visibility</h2>
                        <p className="text-[11px] text-slate-400">Automate start and end times or toggle visibility instantly</p>
                      </div>
                    </div>
                  </div>

                  {/* Scheduling Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Start Schedule (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={toDatetimeLocal(form.startsAt)}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, startsAt: e.target.value || null }))
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> End Schedule (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={toDatetimeLocal(form.endsAt)}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, endsAt: e.target.value || null }))
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20"
                      />
                    </div>
                  </div>

                  {/* Visibility Switch */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Site-Wide Announcement Visibility
                      </span>
                      <span className="text-[11px] text-slate-500">
                        When published, the announcement bar is pinned to the very top of every storefront page.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          status: f.status === 'active' ? 'inactive' : 'active',
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        form.status === 'active'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {form.status === 'active' ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Published
                        </>
                      ) : (
                        'Inactive / Hidden'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Submit Action */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <AppButton type="submit" variant="primary" size="lg" isLoading={isSaving}>
                  <Check className="w-4 h-4 mr-1.5" /> Save Announcement Bar
                </AppButton>
              </div>
            </form>
          </div>

          {/* ── Right Column: Live Storefront Workbench (5 cols) ─────────────── */}
          <div className="xl:col-span-5 sticky top-6 space-y-4">
            <div className="bg-[#120E16] text-white p-5 rounded-3xl border border-white/10 shadow-2xl space-y-4">
              {/* Workbench Top Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Live Header Simulation
                  </span>
                </div>

                {/* Device Selector */}
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded-lg transition ${
                      previewDevice === 'desktop' ? 'bg-[#D4AF37] text-black font-bold' : 'text-white/70 hover:text-white'
                    }`}
                    title="Desktop View"
                  >
                    <Laptop className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('tablet')}
                    className={`p-1.5 rounded-lg transition ${
                      previewDevice === 'tablet' ? 'bg-[#D4AF37] text-black font-bold' : 'text-white/70 hover:text-white'
                    }`}
                    title="Tablet View"
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded-lg transition ${
                      previewDevice === 'mobile' ? 'bg-[#D4AF37] text-black font-bold' : 'text-white/70 hover:text-white'
                    }`}
                    title="Mobile View"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Realistic Browser Frame */}
              <div
                className={`mx-auto rounded-2xl border border-white/15 bg-black/60 overflow-hidden shadow-2xl transition-all duration-300 ${
                  previewDevice === 'mobile'
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
                    LIVE
                  </span>
                </div>

                {/* Simulated Announcement Bar Container */}
                <div
                  className="w-full py-2.5 px-4 text-center text-xs font-semibold tracking-wider uppercase transition-colors duration-300 flex items-center justify-center gap-2.5 flex-wrap shadow-xs"
                  style={{
                    backgroundColor: form.backgroundColor,
                    color: form.textColor,
                  }}
                >
                  <span className="line-clamp-2">{form.message || '✨ Your Announcement Message Goes Here'}</span>
                  {form.countdownTarget && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/20 text-[10px] font-mono font-bold tracking-normal backdrop-blur-xs">
                      <Clock className="w-2.5 h-2.5 opacity-70" /> 05h : 22m : 18s
                    </span>
                  )}
                </div>

                {/* Mock Navbar & Hero header underneath */}
                <div className="p-4 bg-[#140F1B] border-t border-white/5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <span className="font-serif text-xs uppercase tracking-[0.2em] text-[#D4AF37]">
                      Madalsa Couture
                    </span>
                    <div className="flex items-center gap-3 text-[10px] text-white/70">
                      <span>Home</span>
                      <span>Shop</span>
                      <span>About Us</span>
                    </div>
                  </div>
                  <div className="h-20 rounded-xl bg-linear-to-b from-white/5 to-transparent flex items-center justify-center text-center p-3">
                    <span className="text-[11px] text-white/40 font-mono">Homepage Hero Section Body</span>
                  </div>
                </div>
              </div>

              {/* Status Info Chips */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-white/70 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 font-mono">Background:</span>
                  <span className="font-bold text-white font-mono uppercase">{form.backgroundColor}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-white/40 font-mono">Status:</span>
                  <span className="font-bold text-[#D4AF37] capitalize">{form.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CmsAnnouncementPage;
