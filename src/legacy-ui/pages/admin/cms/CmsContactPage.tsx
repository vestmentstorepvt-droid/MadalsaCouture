import React, { useState, useCallback, useEffect } from 'react';
import {
  Phone, Mail, MapPin, Clock, Globe, Link, Check, AlertCircle,
  RefreshCw, ExternalLink, Eye, Save
} from 'lucide-react';
import { AppButton } from '../../../components/ui/button/AppButton';
import {
  useGetContactQuery,
  useUpdateContactMutation,
} from '../../../services/cmsAdminApi';
import type { CmsContact } from '../../../services/cmsAdminApi';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

const MAP_EMBED_PREFIX = 'https://www.google.com/maps/embed';

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as FetchBaseQueryError).status === 404;
}

const EMPTY_FORM: Partial<CmsContact> = {
  phone: '',
  email: '',
  address: '',
  businessHours: '',
  formRoutingEmail: '',
  mapEmbedUrl: '',
  status: 'active',
};

export const CmsContactPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useGetContactQuery();
  const [updateContact, { isLoading: isSaving }] = useUpdateContactMutation();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState<Partial<CmsContact>>(EMPTY_FORM);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const isNotConfigured = isError && isNotFound(error);
  const showError = isError && !isNotConfigured;

  useEffect(() => {
    if (data) {
      const d = data as unknown as Record<string, string>;
      setForm({
        phone: d.phone ?? '',
        email: d.email ?? '',
        address: d.address ?? '',
        businessHours: d.businessHours ?? '',
        formRoutingEmail: d.formRoutingEmail ?? '',
        mapEmbedUrl: d.mapEmbedUrl ?? '',
        status: (d.status as 'active' | 'inactive') ?? 'active',
      });
    }
  }, [data]);

  const set = (field: keyof CmsContact, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const mapUrl = (form.mapEmbedUrl ?? '').trim();
  const isMapUrlValid = mapUrl === '' || mapUrl.startsWith(MAP_EMBED_PREFIX);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMapUrlValid) {
      showToast(`Map URL must start with ${MAP_EMBED_PREFIX}`, 'error');
      return;
    }
    try {
      // Send exactly what backend expects: address, phone, email, businessHours, formRoutingEmail, mapEmbedUrl, status
      await updateContact({
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        businessHours: form.businessHours || null,
        formRoutingEmail: form.formRoutingEmail || null,
        mapEmbedUrl: mapUrl || null,
        status: form.status,
      } as Partial<CmsContact>).unwrap();
      showToast('Contact info saved successfully!', 'success');
      refetch();
    } catch {
      showToast('Failed to save. Please try again.', 'error');
    }
  };

  const INPUT = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink';

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

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit">
            <Phone className="w-3 h-3" /> Business Contact Info
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Contact Info Studio</h1>
          <p className="text-xs text-slate-500 max-w-lg">Manage store address, phone, email, business hours, Google Maps embed, and form routing for the Contact page.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/contact" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs">
            <Eye className="w-3.5 h-3.5 text-slate-500" /> Preview <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <button onClick={() => refetch()} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-xs">
            <RefreshCw className="w-4 h-4" />
          </button>
          <AppButton variant="primary" onClick={handleSubmit} isLoading={isSaving}>
            <Save className="w-4 h-4 mr-1.5" /> Save Contact Info
          </AppButton>
        </div>
      </div>

      {isLoading ? (
        <div className="py-28 text-center bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-9 h-9 animate-spin text-accent mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Loading contact info...</p>
        </div>
      ) : showError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600" />
          <p className="text-rose-900 font-bold text-sm">Failed to load contact data.</p>
          <AppButton variant="primary" size="sm" onClick={() => refetch()}>Retry</AppButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left column */}
            <div className="space-y-5">
              {/* Card 1: Basic Contact */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">01</div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Primary Contact Details</h2>
                    <p className="text-xs text-slate-400">Phone number and email address shown to customers</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone Number
                    </label>
                    <input type="tel" className={INPUT} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
                    <p className="text-xs text-slate-400 mt-1">Include country code. Customers can call or WhatsApp this number.</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Public Contact Email
                    </label>
                    <input type="email" className={INPUT} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="hello@madalsacouture.com" />
                    <p className="text-xs text-slate-400 mt-1">Customer support or inquiry email shown on the contact page.</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Location */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs">02</div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Store Address & Hours</h2>
                    <p className="text-xs text-slate-400">Physical location and operating hours</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Store Address
                    </label>
                    <textarea rows={2} className={`${INPUT} resize-none`} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder="123 Main Street, Mumbai, Maharashtra 400001" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Business Hours
                    </label>
                    <textarea rows={3} className={`${INPUT} resize-none`} value={form.businessHours ?? ''} onChange={(e) => set('businessHours', e.target.value)} placeholder={'Mon – Sat: 10am – 7pm\nSunday: Closed'} />
                    <p className="text-xs text-slate-400 mt-1">Use line breaks for different days.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              {/* Card 3: Form Routing & Map */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">03</div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Form Routing & Map</h2>
                    <p className="text-xs text-slate-400">Backend email routing and Google Maps embed</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-slate-400" /> Form Routing Email (Internal)
                    </label>
                    <input type="email" className={INPUT} value={form.formRoutingEmail ?? ''} onChange={(e) => set('formRoutingEmail', e.target.value)} placeholder="support@madalsacouture.com" />
                    <p className="text-xs text-slate-400 mt-1">Contact form submissions are sent to this address. Not visible to customers.</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400" /> Google Maps Embed URL
                    </label>
                    <textarea rows={3} className={`${INPUT} resize-none font-mono text-xs`} value={form.mapEmbedUrl ?? ''} onChange={(e) => set('mapEmbedUrl', e.target.value)} placeholder="https://www.google.com/maps/embed?pb=..." />
                    <p className="text-xs text-slate-400 mt-1">Copy the full embed URL from Google Maps → Share → Embed a map.</p>
                  </div>

                  {/* Map Preview */}
                  {mapUrl && !isMapUrlValid && (
                    <p className="text-xs font-semibold text-rose-600">Only Google Maps embed URLs ({MAP_EMBED_PREFIX}…) are supported.</p>
                  )}
                  {mapUrl && isMapUrlValid && (
                    <div className="rounded-xl overflow-hidden border border-slate-200">
                      <iframe src={mapUrl} className="w-full h-40 border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Map Preview" />
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Visibility */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">04</div>
                  <h2 className="text-sm font-bold text-slate-900">Contact Page Visibility</h2>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Page Status</span>
                    <span className="text-xs text-slate-500">Show or hide the contact page on the storefront.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: f.status === 'active' ? 'inactive' : 'active' }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${form.status === 'active' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-200 text-slate-700'}`}
                  >
                    {form.status === 'active' ? <><Check className="w-3.5 h-3.5" /> Published</> : 'Inactive / Hidden'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <AppButton type="submit" variant="primary" size="lg" isLoading={isSaving}>
              <Save className="w-4 h-4 mr-1.5" /> Save Contact Info
            </AppButton>
          </div>
        </form>
      )}
    </div>
  );
};

export default CmsContactPage;
