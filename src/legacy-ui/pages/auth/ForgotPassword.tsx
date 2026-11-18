import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
const logoSrc = '/assets/madalsa-logo.webp';
import { useForgotPasswordMutation } from '../../services/authApi';

type Step = 'form' | 'success';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    setErrorMsg('');
    try {
      await forgotPassword({ email: email.trim().toLowerCase() }).unwrap();
      setStep('success');
      setResendCooldown(60);
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string; error?: { message?: string } } };
      const msg =
        apiErr?.data?.error?.message ||
        apiErr?.data?.message ||
        'Something went wrong. Please try again.';
      setErrorMsg(msg);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMsg('');
    try {
      await forgotPassword({ email: email.trim().toLowerCase() }).unwrap();
      setResendCooldown(60);
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string; error?: { message?: string } } };
      const msg =
        apiErr?.data?.error?.message ||
        apiErr?.data?.message ||
        'Failed to resend. Please try again.';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FDF4F7] px-4 py-6 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[2rem] border border-[#F7D7E0] bg-white/95 p-8 shadow-[0_40px_120px_rgba(232,93,136,0.12)] backdrop-blur-sm">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center mb-8">
          <img src={logoSrc} alt="Madalsa Couture" className="h-14 w-auto object-contain" />
        </div>

        {step === 'form' ? (
          <>
            {/* Heading */}
            <div className="text-center mb-7">
              <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-[#E85D88]" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Forgot your password?</h1>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                No worries — enter the email address associated with your account and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label htmlFor="fp-email" className="mb-2 block text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <Mail size={18} />
                  </span>
                  <input
                    id="fp-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="h-12 w-full rounded-xl border border-[#F4D3DC] bg-[#FFF8FA] pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-300 focus:border-[#E85D88] focus:bg-white focus:ring-2 focus:ring-[#F7B9CC]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E85D88] px-5 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-[#d44f72] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Sending reset link…
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 font-medium transition hover:text-[#E85D88]"
              >
                <ArrowLeft size={15} />
                Back to Sign In
              </Link>
            </div>
          </>
        ) : (
          /* ── Success State ── */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Check your inbox!</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              We've sent a password reset link to{' '}
              <strong className="text-slate-700">{email}</strong>.{' '}
              It may take a minute to arrive. Don't forget to check your spam folder.
            </p>

            {errorMsg && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 text-left">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Resend section */}
            <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-500 mb-3">Didn't receive it?</p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isLoading}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#E85D88] hover:text-[#d44f72] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
              </button>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Or try a different email —{' '}
                <button
                  type="button"
                  onClick={() => { setStep('form'); setErrorMsg(''); }}
                  className="text-[#E85D88] hover:underline font-medium"
                >
                  go back
                </button>
              </p>
            </div>

            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-slate-500 font-medium transition hover:text-[#E85D88]"
            >
              <ArrowLeft size={15} />
              Return to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
