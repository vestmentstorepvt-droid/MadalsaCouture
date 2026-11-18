import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
const logoSrc = '/assets/madalsa-logo.webp';
import { useResetPasswordMutation } from '../../services/authApi';
import { PASSWORD_POLICY_HINT, validatePasswordPolicy } from '../../utils/passwordPolicy';

// Password strength calculator
function getPasswordStrength(password: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels: Array<{ label: string; color: string }> = [
    { label: '', color: '' },
    { label: 'Weak', color: '#EF4444' },
    { label: 'Fair', color: '#F59E0B' },
    { label: 'Good', color: '#3B82F6' },
    { label: 'Strong', color: '#10B981' },
  ];
  return { level: score as 0 | 1 | 2 | 3 | 4, ...levels[score] };
}

type Step = 'reset' | 'success';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState<Step>('reset');

  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const strength = getPasswordStrength(newPassword);

  // Auto-redirect to login after success
  useEffect(() => {
    if (step !== 'success') return;
    const t = setTimeout(() => navigate('/login', { replace: true }), 4000);
    return () => clearTimeout(t);
  }, [step, navigate]);

  const validate = (): string | null => {
    if (!token) return 'Reset token is missing. Please use the link from your email.';
    if (!newPassword) return 'Please enter a new password.';
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) return policyError;
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    setErrorMsg('');
    try {
      await resetPassword({ token, newPassword, confirmPassword }).unwrap();
      setStep('success');
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string; error?: { message?: string }; errors?: { message: string }[] } };
      const msg =
        apiErr?.data?.errors?.[0]?.message ||
        apiErr?.data?.error?.message ||
        apiErr?.data?.message ||
        'Failed to reset password. The link may have expired. Please request a new one.';
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

        {step === 'reset' ? (
          <>
            {/* Heading */}
            <div className="text-center mb-7">
              <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-[#E85D88]" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Set a new password</h1>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                {PASSWORD_POLICY_HINT}
              </p>
            </div>

            {/* Missing token warning */}
            {!token && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Invalid or missing reset link. Please{' '}
                  <Link to="/forgot-password" className="underline font-medium text-amber-900">
                    request a new one
                  </Link>.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label htmlFor="rp-new" className="mb-2 block text-sm font-semibold text-slate-700">
                  New Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <Lock size={18} />
                  </span>
                  <input
                    id="rp-new"
                    type={showNew ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(''); }}
                    placeholder="Enter new password"
                    className="h-12 w-full rounded-xl border border-[#F4D3DC] bg-[#FFF8FA] pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-300 focus:border-[#E85D88] focus:bg-white focus:ring-2 focus:ring-[#F7B9CC]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute inset-y-0 right-4 flex items-center text-slate-400 transition hover:text-[#E85D88]"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Strength meter */}
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-1.5 flex-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: strength.level >= i ? strength.color : '#E2E8F0',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] font-medium" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="rp-confirm" className="mb-2 block text-sm font-semibold text-slate-700">
                  Confirm New Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <Lock size={18} />
                  </span>
                  <input
                    id="rp-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                    placeholder="Re-enter new password"
                    className={`h-12 w-full rounded-xl border bg-[#FFF8FA] pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-300 focus:ring-2 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                        : confirmPassword && confirmPassword === newPassword
                        ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
                        : 'border-[#F4D3DC] focus:border-[#E85D88] focus:ring-[#F7B9CC]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-4 flex items-center text-slate-400 transition hover:text-[#E85D88]"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                    <AlertCircle size={12} /> Passwords do not match
                  </p>
                )}
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Passwords match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !token}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E85D88] px-5 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-[#d44f72] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Resetting…
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/forgot-password"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 font-medium transition hover:text-[#E85D88]"
              >
                <ArrowLeft size={15} />
                Request a new link
              </Link>
            </div>
          </>
        ) : (
          /* ── Success State ── */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Password updated!</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Your password has been successfully changed. You can now sign in with your new password.
            </p>
            <p className="mt-3 text-xs text-slate-400">Redirecting you to login in a few seconds…</p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center justify-center w-full gap-2 rounded-xl bg-[#E85D88] px-5 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-[#d44f72]"
            >
              Go to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
