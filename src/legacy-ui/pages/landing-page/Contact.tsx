import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, ChevronRight, Send, CheckCircle2, Sparkles } from 'lucide-react';
import { useGetContactQuery, useSubmitContactInquiryMutation } from '../../services/cmsApi';

const MAP_EMBED_PREFIX = 'https://www.google.com/maps/embed';

const Contact: React.FC = () => {
  const { data: contactData, isLoading, isError, refetch } = useGetContactQuery();
  const rawMapUrl = contactData?.mapEmbedUrl?.trim();
  const mapSrc = rawMapUrl && rawMapUrl.startsWith(MAP_EMBED_PREFIX) ? rawMapUrl : null;
  const [submitInquiry, { isLoading: isSubmitting }] = useSubmitContactInquiryMutation();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      await submitInquiry(formData).unwrap();
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: 'General Inquiry', message: '' });
    } catch {
      setSubmitError('Failed to send message. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D2C24] font-sans antialiased selection:bg-[#B38756]/20">
      {/* Header Banner */}
      <section className="bg-[#271C16] text-[#FAF7F2] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto space-y-7">
          <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
            <Link to="/" className="hover:text-[#FFF8ED] transition-colors duration-200">Home</Link>
            <ChevronRight className="h-3 w-3 text-[#D4AF37]/50" />
            <span className="text-stone-400">Contact Us</span>
          </nav>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-[0.1em] uppercase text-[#FFF8ED]">
            Connect With Our Atelier
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 font-light max-w-xl mx-auto tracking-wide leading-relaxed">
            Whether you need custom sizing, virtual styling consultations, or order assistance, our couture specialists are at your service.
          </p>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 space-y-20">
        <div className="grid gap-16 lg:gap-20 lg:grid-cols-2 items-start">
          {/* Contact Details & Info Card */}
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#A87443]">
                ATELIER CONCIERGE
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl tracking-[0.1em] uppercase text-[#3D2C24]">
                We Would Love to Hear From You
              </h2>
              <div className="h-1 w-12 bg-gradient-to-r from-[#D4AF37] to-[#A87443] rounded-full" />
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-light">
                For bespoke bridal edits, custom size fitting, press inquiries, or order support, reach out to our team via phone, email, or social media.
              </p>
            </div>

            {/* Direct Contact Cards */}
            <div className="space-y-5">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-start gap-4 rounded-2xl border border-[#E2D9CC]/70 bg-white p-5 shadow-sm animate-pulse">
                      <div className="h-11 w-11 rounded-xl bg-stone-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-stone-200 rounded w-1/3" />
                        <div className="h-3 bg-stone-200 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isError || !contactData ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
                  <p className="text-rose-700 text-sm font-semibold">Failed to load contact info.</p>
                  <button type="button" onClick={() => refetch()} className="text-xs font-semibold text-white bg-rose-500 px-4 py-2 rounded-xl hover:bg-rose-600 transition">Retry</button>
                </div>
              ) : (
                <>
                  {contactData.address && (
                    <div className="group flex items-start gap-4 rounded-2xl border border-[#E2D9CC]/50 bg-white p-6 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:border-[#D4AF37]/40 hover:shadow-lg transition-all duration-300">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFF8ED] to-[#F5EFE4] text-[#A87443] border border-[#E2CBA6]/40 group-hover:scale-110 transition-transform duration-300">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-[#3D2C24]">
                          Flagship Address
                        </h3>
                        <p className="text-xs text-stone-600 font-light mt-1">
                          {contactData.address}
                        </p>
                      </div>
                    </div>
                  )}

                  {contactData.phone && (
                    <div className="group flex items-start gap-4 rounded-2xl border border-[#E2D9CC]/50 bg-white p-6 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:border-[#D4AF37]/40 hover:shadow-lg transition-all duration-300">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFF8ED] to-[#F5EFE4] text-[#A87443] border border-[#E2CBA6]/40 group-hover:scale-110 transition-transform duration-300">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-[#3D2C24]">
                          Call / WhatsApp Concierge
                        </h3>
                        <a
                          href={`tel:${contactData.phone}`}
                          className="text-xs text-[#3D2C24] font-semibold hover:text-[#A87443] transition-colors mt-1 block"
                        >
                          {contactData.phone}
                        </a>
                        {contactData.businessHours && (
                          <p className="text-[11px] text-stone-500 font-light mt-0.5">
                            {contactData.businessHours}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {contactData.email && (
                    <div className="group flex items-start gap-4 rounded-2xl border border-[#E2D9CC]/50 bg-white p-6 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:border-[#D4AF37]/40 hover:shadow-lg transition-all duration-300">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFF8ED] to-[#F5EFE4] text-[#A87443] border border-[#E2CBA6]/40 group-hover:scale-110 transition-transform duration-300">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-[#3D2C24]">
                          Email Inquiries
                        </h3>
                        <a
                          href={`mailto:${contactData.email}`}
                          className="text-xs text-[#3D2C24] font-semibold hover:text-[#A87443] transition-colors mt-1 block"
                        >
                          {contactData.email}
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {mapSrc && (
              <div className="overflow-hidden rounded-2xl border border-[#E2D9CC]/60 shadow-[0_10px_25px_rgba(0,0,0,0.05)]">
                <iframe
                  src={mapSrc}
                  title="Our location"
                  className="h-64 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>

          {/* Contact Form Section */}
          <div className="rounded-3xl border border-[#E2D9CC]/60 bg-gradient-to-br from-white to-[#FEFBF7] p-8 sm:p-12 shadow-[0_15px_40px_rgba(0,0,0,0.08)] space-y-7">
            <div className="space-y-3">
              <h2 className="font-serif text-lg font-semibold uppercase tracking-wide text-[#3D2C24]">
                Send an Atelier Message
              </h2>
              <p className="text-xs text-stone-600 font-light leading-relaxed">
                Fill out the details below and our stylist team will respond within 24 hours.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center space-y-3 animate-in fade-in duration-300">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h3 className="font-serif text-lg font-semibold text-emerald-900 uppercase tracking-wide">
                  Message Sent Successfully
                </h3>
                <p className="text-xs text-emerald-700 font-light leading-relaxed max-w-sm mx-auto">
                  Thank you for reaching out to Madalsa Couture. Our atelier team will get back to you shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-900 underline"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full rounded-xl border border-stone-300 bg-[#FAF7F2]/50 p-3 text-stone-900 placeholder:text-stone-400 focus:border-[#3D2C24] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. ananya@example.com"
                      className="w-full rounded-xl border border-stone-300 bg-[#FAF7F2]/50 p-3 text-stone-900 placeholder:text-stone-400 focus:border-[#3D2C24] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Phone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 9876543210"
                      className="w-full rounded-xl border border-stone-300 bg-[#FAF7F2]/50 p-3 text-stone-900 placeholder:text-stone-400 focus:border-[#3D2C24] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 bg-[#FAF7F2]/50 p-3 text-stone-900 focus:border-[#3D2C24] focus:bg-white focus:outline-none"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Custom Sizing / Fit Assistance">Custom Sizing / Fit Assistance</option>
                    <option value="Order Status / Shipping">Order Status / Shipping</option>
                    <option value="Press / Bespoke Bridal">Press / Bespoke Bridal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Your Message *
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your requirements or question..."
                    className="w-full rounded-xl border border-stone-300 bg-[#FAF7F2]/50 p-3 text-stone-900 placeholder:text-stone-400 focus:border-[#3D2C24] focus:bg-white focus:outline-none"
                  />
                </div>

                {submitError && (
                  <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#3D2C24] bg-[#3D2C24] py-3.5 px-6 text-xs font-semibold tracking-widest uppercase text-[#FFF8ED] hover:bg-[#271C16] hover:shadow-lg transition-all shadow-md disabled:opacity-50 duration-300"
                >
                  {isSubmitting ? (
                    <Sparkles className="h-4 w-4 animate-spin text-[#D4AF37]" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 text-[#D4AF37]" /> Submit Inquiry
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Contact;
