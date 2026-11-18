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
    <div className="bg-[#F6F5F3] py-16 px-4 relative overflow-hidden border-y border-[#E2D9CC]/50">
      <div className="mx-auto max-w-6xl text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B8860B]">
          <Sparkles className="w-3 h-3" /> Special Festive Offer
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif text-[#6B4D3E] tracking-widest uppercase text-center font-normal">
          {headline}
        </h2>
        <p className="text-xs sm:text-sm text-slate-700 max-w-3xl mx-auto text-center font-light leading-relaxed">
          {subtext}
        </p>
        <div className="pt-2">
          {link.startsWith('/') ? (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center border border-[#6B4D3E] bg-[#6B4D3E] px-8 py-3 text-xs tracking-widest text-white font-medium uppercase transition-all duration-300 hover:bg-transparent hover:text-[#6B4D3E]"
            >
              CLAIM OFFER NOW
            </button>
          ) : (
            <a
              href={link}
              className="inline-flex items-center justify-center border border-[#6B4D3E] bg-[#6B4D3E] px-8 py-3 text-xs tracking-widest text-white font-medium uppercase transition-all duration-300 hover:bg-transparent hover:text-[#6B4D3E]"
            >
              CLAIM OFFER NOW
            </a>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-8 sm:p-12 shadow-2xl text-center border border-[#E8D9C7]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 transition-colors hover:text-black p-1 rounded-full hover:bg-slate-100"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {isSubmitted ? (
              <div className="py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h3 className="text-xl font-serif text-slate-900 uppercase tracking-wider">Coupon Code Claimed!</h3>
                <p className="text-xs text-slate-600">Check your email for your exclusive festive discount code.</p>
              </div>
            ) : (
              <>
                <h3 className="text-2xl sm:text-3xl font-serif text-[#6B4D3E] tracking-widest uppercase mb-4">
                  CLAIM EXCLUSIVE OFFER
                </h3>
                <p className="mx-auto max-w-md text-xs sm:text-sm leading-relaxed text-slate-700 mb-8">
                  Enter your email to receive a special promotional coupon code for your next couture purchase.
                </p>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="sr-only" htmlFor="firstName">First Name</label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="First Name*"
                      required
                      className="w-full bg-[#FAF7F2] border border-slate-300 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#6B4D3E] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="email">Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Email Address*"
                      required
                      className="w-full bg-[#FAF7F2] border border-slate-300 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#6B4D3E] focus:outline-none transition-colors"
                    />
                  </div>
                  {submitError && (
                    <p className="text-xs text-red-600 text-center -mt-1">{submitError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-[#6B4D3E] bg-[#6B4D3E] py-3.5 text-xs uppercase tracking-widest font-semibold text-white transition-all duration-300 hover:bg-[#52392c] disabled:opacity-50"
                  >
                    {isSubmitting ? 'SENDING...' : 'SEND COUPON CODE'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FestiveBanner;