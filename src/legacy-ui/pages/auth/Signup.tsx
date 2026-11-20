import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRegisterMutation } from '../../services/authApi';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import type { RegisterRequest } from '../../types/auth';
import { PASSWORD_POLICY_HINT, validatePasswordPolicy } from '../../utils/passwordPolicy';
import { AuthSplitLayout } from '../../components/features/auth/AuthSplitLayout';

const inputClass =
  'h-11 w-full rounded-md border bg-surface px-3.5 text-base text-ink placeholder:text-faint outline-none transition-colors hover:border-mute focus:border-ink focus:ring-2 focus:ring-ink/15 sm:text-sm';

/** Label, input slot, and either the error or a hint underneath (linked for screen readers). */
const Field: React.FC<{
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (describedBy: string | undefined, invalid: boolean) => React.ReactNode;
}> = ({ id, label, error, hint, children }) => {
  const noteId = error || hint ? `${id}-note` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children(noteId, Boolean(error))}
      {error ? (
        <p id={noteId} className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p id={noteId} className="mt-1.5 text-xs text-mute">{hint}</p>
      ) : null}
    </div>
  );
};

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [register, { isLoading }] = useRegisterMutation();
  const { triggerGoogleSignIn, isGoogleLoading, googleError, googleSuccess } = useGoogleSignIn('signup');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = 'Name is required.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address.';
    }

    if (!phoneNumber.trim()) {
      nextErrors.phone = 'Phone number is required.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    } else {
      const policyError = validatePasswordPolicy(password);
      if (policyError) nextErrors.password = policyError;
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || isLoading) {
      return;
    }

    setSuccessMessage('');

    const payload: RegisterRequest = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phoneNumber.trim(),
      password,
      confirmPassword,
    };

    try {
      const response = await register(payload).unwrap();
      setSuccessMessage(response.message || 'Registration successful. Please sign in.');
      setErrors({});

      // ── Meta Pixel: CompleteRegistration ─────────────────────────────
      try {
        const fbq = (window as any).fbq;
        if (typeof fbq === 'function') {
          fbq('track', 'CompleteRegistration', {
            status: 'success',
          }, { eventID: `reg_${Date.now()}` });
        }
      } catch { /* silent */ }
      // ────────────────────────────────────────────────────────────────

      setName('');
      setEmail('');
      setPhoneNumber('');
      setPassword('');
      setConfirmPassword('');
      navigate('/login', { state: { registered: true } });
    } catch (error: unknown) {
      const apiError = error as { data?: any; status?: number };
      const data = apiError?.data;
      const serverErrors = data?.errors ?? {};
      const details = data?.error?.details ?? data?.details;
      const nextErrors: Record<string, string> = {};

      if (serverErrors.name?.[0]) nextErrors.name = serverErrors.name[0];
      if (serverErrors.email?.[0]) nextErrors.email = serverErrors.email[0];
      if (serverErrors.phone?.[0]) nextErrors.phone = serverErrors.phone[0];
      if (serverErrors.password?.[0]) nextErrors.password = serverErrors.password[0];
      if (serverErrors.confirmPassword?.[0]) nextErrors.confirmPassword = serverErrors.confirmPassword[0];

      if (Array.isArray(details)) {
        details.forEach((detail: any) => {
          if (detail?.field && detail?.message) {
            nextErrors[detail.field] = detail.message;
          }
        });

        if (!Object.keys(nextErrors).length && details[0]?.message) {
          nextErrors.general = details[0].message;
        }
      }

      if (!Object.keys(nextErrors).length) {
        const rawErr = data?.error;
        const errMsg = typeof rawErr === 'string' ? rawErr : (rawErr?.message || data?.message || 'Registration failed. Please try again.');
        nextErrors.general = typeof errMsg === 'string' ? errMsg : 'Registration failed. Please try again.';
      }

      setErrors(nextErrors);
    }
  };

  const clearError = (key: string) => {
    if (errors[key]) setErrors((current) => ({ ...current, [key]: '' }));
  };
  const border = (invalid: boolean) => (invalid ? 'border-red-400' : 'border-hairline-strong');

  const shownError = (typeof errors.general === 'string' && errors.general) || (typeof googleError === 'string' && googleError) || '';
  const shownSuccess = (typeof googleSuccess === 'string' && googleSuccess) || (typeof successMessage === 'string' && successMessage) || '';

  return (
    <AuthSplitLayout
      title="Create your account"
      description="Save your sizes and addresses, follow your orders, and check out faster."
      photoCollection="best-seller"
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent underline-offset-4 hover:text-accent-deep hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      {shownError && (
        <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p>{shownError}</p>
        </div>
      )}
      {shownSuccess && (
        <div role="status" className="mb-6 flex gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{shownSuccess}</p>
        </div>
      )}

      <button
        type="button"
        onClick={triggerGoogleSignIn}
        disabled={isGoogleLoading}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-hairline-strong bg-surface text-sm font-medium text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isGoogleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        )}
        {isGoogleLoading ? 'Connecting to Google…' : 'Sign up with Google'}
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-mute">
        <span className="h-px flex-1 bg-hairline" />
        or sign up with email
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field id="name" label="Full name" error={errors.name}>
          {(describedBy, invalid) => (
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError('name');
              }}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={`${inputClass} ${border(invalid)}`}
            />
          )}
        </Field>

        <Field id="email" label="Email" error={errors.email}>
          {(describedBy, invalid) => (
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError('email');
              }}
              placeholder="you@example.com"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={`${inputClass} ${border(invalid)}`}
            />
          )}
        </Field>

        <Field id="phone" label="Phone" error={errors.phone} hint="For delivery updates on your orders.">
          {(describedBy, invalid) => (
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                clearError('phone');
              }}
              placeholder="+91 98765 43210"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={`${inputClass} ${border(invalid)}`}
            />
          )}
        </Field>

        <Field id="password" label="Password" error={errors.password} hint={PASSWORD_POLICY_HINT}>
          {(describedBy, invalid) => (
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError('password');
                }}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                className={`${inputClass} ${border(invalid)} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
        </Field>

        <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
          {(describedBy, invalid) => (
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearError('confirmPassword');
                }}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                className={`${inputClass} ${border(invalid)} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showConfirmPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
        </Field>

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#5e0d1d] text-sm font-medium text-[#f6ead2] ring-1 ring-inset ring-[#e2c27a]/50 transition-colors hover:bg-[#741427] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e0d1d] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isLoading ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </AuthSplitLayout>
  );
};

export default Signup;
