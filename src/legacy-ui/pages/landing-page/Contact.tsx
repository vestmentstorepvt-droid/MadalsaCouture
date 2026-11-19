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
    <div className="min-h-screen bg-canvas text-ink">
      {/* Header Banner */}
      <section className="relative overflow-hidden border-b border-hairline bg-canvas text-ink py-16 sm:py-24 px-4 sm:px-6 lg:px-8 text-center">
        <div aria-hidden="true" className="mesh-gradient pointer-events-none absolute inset-x-0 top-0 mx-auto h-full max-w-5xl" />
        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-2 text-sm text-mute">
            <Link to="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
            <span className="text-ink">Contact Us</span>
          </nav>
          <h1 className="text-[32px] leading-10 tracking-[-1.28px] sm:text-5xl sm:leading-[48px] sm:tracking-[-2.4px] text-ink font-semibold">
            Connect With Our Atelier
          </h1>
          <p className="text-base text-body max-w-xl mx-auto">
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
              <span className="eyebrow">
                ATELIER CONCIERGE
              </span>
              <h2 className="text-xl tracking-[-0.4px] sm:text-3xl text-ink font-semibold">
                We Would Love to Hear From You
              </h2>
              <div className="h-1 w-12 bg-ink rounded-full" />
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                For bespoke bridal edits, custom size fitting, press inquiries, or order support, reach out to our team via phone, email, or social media.
              </p>
            </div>

            {/* Direct Contact Cards */}
            <div className="space-y-5">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-start gap-4 rounded-2xl border border-hairline bg-white p-5 shadow-sm animate-pulse">
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
                  <button type="button" onClick={() => refetch()} className="btn-sm bg-ink text-white hover:bg-ink-hover">Retry</button>
                </div>
              ) : (
                <>
                  {contactData.address && (
                    <div className="group flex items-start gap-4 rounded-2xl border border-hairline bg-white p-6 shadow-md hover:border-hairline hover:shadow-lg transition-all duration-300">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent border border-hairline group-hover:scale-110 transition-transform duration-300">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink">
                          Flagship Address
                        </h3>
                        <p className="text-xs text-stone-600 font-normal mt-1">
                          {contactData.address}
                        </p>
                      </div>
                    </div>
                  )}

                  {contactData.phone && (
                    <div className="group flex items-start gap-4 rounded-2xl border border-hairline bg-white p-6 shadow-md hover:border-hairline hover:shadow-lg transition-all duration-300">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent border border-hairline group-hover:scale-110 transition-transform duration-300">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink">
                          Call / WhatsApp Concierge
                        </h3>
                        <a
                          href={`tel:${contactData.phone}`}
                          className="text-xs text-ink font-semibold hover:text-accent transition-colors mt-1 block"
                        >
                          {contactData.phone}
                        </a>
                        {contactData.businessHours && (
                          <p className="text-xs text-stone-500 font-normal mt-0.5">
                            {contactData.businessHours}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {contactData.email && (
                    <div className="group flex items-start gap-4 rounded-2xl border border-hairline bg-white p-6 shadow-md hover:border-hairline hover:shadow-lg transition-all duration-300">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent border border-hairline group-hover:scale-110 transition-transform duration-300">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink">
                          Email Inquiries
                        </h3>
                        <a
                          href={`mailto:${contactData.email}`}
                          className="text-xs text-ink font-semibold hover:text-accent transition-colors mt-1 block"
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
              <div className="overflow-hidden rounded-2xl border border-hairline shadow-md">
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
          <div className="rounded-3xl border border-hairline bg-surface p-8 sm:p-12 shadow-md space-y-7">
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-ink">
                Send an Atelier Message
              </h2>
              <p className="text-xs text-stone-600 font-normal leading-relaxed">
                Fill out the details below and our stylist team will respond within 24 hours.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center space-y-3 animate-in fade-in duration-300">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h3 className="text-base font-semibold text-emerald-900">
                  Message Sent Successfully
                </h3>
                <p className="text-xs text-emerald-700 font-normal leading-relaxed max-w-sm mx-auto">
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full rounded-xl border border-stone-300 bg-canvas/50 p-3 text-stone-900 placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. ananya@example.com"
                      className="w-full rounded-xl border border-stone-300 bg-canvas/50 p-3 text-stone-900 placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Phone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 9876543210"
                      className="w-full rounded-xl border border-stone-300 bg-canvas/50 p-3 text-stone-900 placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 bg-canvas/50 p-3 text-stone-900 focus:border-ink focus:bg-white focus:outline-none"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Custom Sizing / Fit Assistance">Custom Sizing / Fit Assistance</option>
                    <option value="Order Status / Shipping">Order Status / Shipping</option>
                    <option value="Press / Bespoke Bridal">Press / Bespoke Bridal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Your Message *
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your requirements or question..."
                    className="w-full rounded-xl border border-stone-300 bg-canvas/50 p-3 text-stone-900 placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none"
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
                  className="w-full inline-flex items-center justify-center gap-2 bg-ink px-6 text-white disabled:opacity-50 duration-300 h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover"
                >
                  {isSubmitting ? (
                    <Sparkles className="h-4 w-4 animate-spin text-accent" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 text-accent" /> Submit Inquiry
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
