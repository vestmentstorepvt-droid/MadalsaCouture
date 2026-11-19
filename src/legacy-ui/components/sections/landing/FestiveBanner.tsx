import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useGetBannersQuery, useClaimPromoCouponMutation } from '../../../services/cmsApi';

interface FestiveFormState {
  firstName: string;
  email: string;
}

const FestiveBanner: React.FC = () => {
  const { data: banners, isLoading } = useGetBannersQuery({ placement: 'festive' });
  const activeBanner = banners?.find((b) => b.status === 'active') || banners?.[0];

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<FestiveFormState>({
    firstName: '',
    email: '',
  });
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [claimPromoCoupon, { isLoading: isSubmitting }] = useClaimPromoCouponMutation();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (submitError) setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!formData.email.trim()) return;
    try {
      await claimPromoCoupon({
        email: formData.email.trim(),
        firstName: formData.firstName.trim(),
      }).unwrap();

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setIsModalOpen(false);
        setFormData({ firstName: '', email: '' });
      }, 3000);
    } catch (err: any) {
      setSubmitError(err?.data?.error?.message || err?.message || 'Failed to claim coupon. Please try again.');
    }
  };

  if (isLoading) return null;
  // If no festive banner is configured or active, hide silently
  if (!activeBanner || activeBanner.status === 'inactive') return null;

  const headline = activeBanner.title || 'FESTIVE SALE IS LIVE';
  const subtext = activeBanner.altText || 'Celebrate the season of light, love, and new beginnings. Traditional charm, modern flair, and savings sweeter than mithai — only for a limited time.';
  const link = activeBanner.linkUrl || '#claim';

  return (
    <section aria-labelledby="festive-title" className="relative overflow-hidden border-b border-hairline bg-canvas px-4 py-16 sm:py-24">
      {/* DESIGN.md: the soft mesh gradient is the page's one decorative element. */}
      <div aria-hidden="true" className="mesh-gradient pointer-events-none absolute inset-x-0 top-0 mx-auto h-full max-w-5xl" />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="eyebrow inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Festive offer
        </p>
        <h2
          id="festive-title"
          className="mt-4 text-[32px] font-semibold leading-10 tracking-[-1.28px] text-ink sm:text-5xl sm:leading-[48px] sm:tracking-[-2.4px]"
        >
          {headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-body">{subtext}</p>
        <div className="mt-8">
          {link.startsWith('/') ? (
            <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
              Claim offer
            </button>
          ) : (
            <a href={link} className="btn-primary">
              Claim offer
            </a>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="festive-dialog-title"
          onKeyDown={(e) => e.key === 'Escape' && setIsModalOpen(false)}
        >
          <div className="relative w-full max-w-md rounded-3xl border border-hairline bg-surface p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-mute hover:bg-hairline-soft hover:text-ink"
              aria-label="Close"
              autoFocus
            >
              <X className="h-5 w-5" />
            </button>

            {isSubmitted ? (
              <div className="py-6 text-center" role="status">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
                <h3 id="festive-dialog-title" className="mt-3 text-xl font-semibold tracking-[-0.4px] text-ink">
                  Check your inbox
                </h3>
                <p className="mt-1 text-sm text-body">Your festive discount code is on its way.</p>
              </div>
            ) : (
              <>
                <h3 id="festive-dialog-title" className="pr-8 text-xl font-semibold tracking-[-0.4px] text-ink">
                  Get your festive code
                </h3>
                <p className="mt-1 text-sm text-body">We'll email you a discount code for your next order.</p>
                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="field-label" htmlFor="firstName">First name</label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="email">Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="field"
                    />
                  </div>
                  {submitError && (
                    <p className="text-sm text-red-600" role="alert">{submitError}</p>
                  )}
                  <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                    {isSubmitting ? 'Sending…' : 'Send my code'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default FestiveBanner;