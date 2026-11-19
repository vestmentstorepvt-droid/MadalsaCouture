

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react';

const logoSrc = '/assets/madalsa-logo.webp';
import { useRegisterMutation } from '../../services/authApi';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import type { RegisterRequest } from '../../types/auth';
import { PASSWORD_POLICY_HINT, validatePasswordPolicy } from '../../utils/passwordPolicy';

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

      if (serverErrors.name?.[0]) {
        nextErrors.name = serverErrors.name[0];
      }

      if (serverErrors.email?.[0]) {
        nextErrors.email = serverErrors.email[0];
      }

      if (serverErrors.phone?.[0]) {
        nextErrors.phone = serverErrors.phone[0];
      }

      if (serverErrors.password?.[0]) {
        nextErrors.password = serverErrors.password[0];
      }

      if (serverErrors.confirmPassword?.[0]) {
        nextErrors.confirmPassword = serverErrors.confirmPassword[0];
      }

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

  return (
    <div className="min-h-screen w-full bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src={logoSrc}
              alt="Madalsa Couture"
              className="h-14 w-auto object-contain"
            />
          </div>
          <h1 className="text-[32px] leading-10 font-semibold tracking-[-1.28px] text-ink mb-2">Create Account</h1>
          <p className="text-slate-600 text-sm">Join us and start your fashion journey</p>
        </div>

        {/* Main Card */}
        <div className="bg-surface rounded-2xl border border-hairline p-8">

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error/Success Messages */}
          {typeof errors.general === 'string' && errors.general ? (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-3">
              <div className="text-red-500 mt-0.5">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm font-medium text-red-900">{errors.general}</p>
            </div>
          ) : null}
          {typeof googleError === 'string' && googleError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm font-medium text-red-900">{googleError}</div>
          ) : null}
          {typeof googleSuccess === 'string' && googleSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-medium text-green-900">{googleSuccess}</div>
          ) : null}
          {typeof successMessage === 'string' && successMessage ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-medium text-green-900">{successMessage}</div>
          ) : null}

          {/* Full Name & Phone - Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Full Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <User size={20} />
                </span>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((current) => ({ ...current, name: '' }));
                  }}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 rounded-md border border-hairline-strong bg-surface text-ink text-base md:text-sm placeholder:text-faint text-sm outline-none transition-all duration-200 focus:border-ink focus:bg-white focus:ring-2 focus:ring-ink/20 hover:border-slate-300"
                />
              </div>
              {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-ink mb-1.5">
                Phone
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Phone size={20} />
                </span>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (errors.phone) setErrors((current) => ({ ...current, phone: '' }));
                  }}
                  placeholder="+91 98765"
                  className="w-full pl-10 pr-4 py-2.5 rounded-md border border-hairline-strong bg-surface text-ink text-base md:text-sm placeholder:text-faint text-sm outline-none transition-all duration-200 focus:border-ink focus:bg-white focus:ring-2 focus:ring-ink/20 hover:border-slate-300"
                />
              </div>
              {errors.phone ? <p className="mt-1 text-xs text-red-600">{errors.phone}</p> : null}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Mail size={20} />
              </span>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((current) => ({ ...current, email: '' }));
                }}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-md border border-hairline-strong bg-surface text-ink text-base md:text-sm placeholder:text-faint text-sm outline-none transition-all duration-200 focus:border-ink focus:bg-white focus:ring-2 focus:ring-ink/20 hover:border-slate-300"
              />
            </div>
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>

          {/* Password & Confirm - Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Lock size={20} />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((current) => ({ ...current, password: '' }));
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-md border border-hairline-strong bg-surface text-ink text-base md:text-sm placeholder:text-faint text-sm outline-none transition-all duration-200 focus:border-ink focus:bg-white focus:ring-2 focus:ring-ink/20 hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">{PASSWORD_POLICY_HINT}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1.5">
                Confirm
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Lock size={20} />
                </span>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: '' }));
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-md border border-hairline-strong bg-surface text-ink text-base md:text-sm placeholder:text-faint text-sm outline-none transition-all duration-200 focus:border-ink focus:bg-white focus:ring-2 focus:ring-ink/20 hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p> : null}
            </div>
          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-ink hover:bg-ink-hover text-white font-medium h-11 rounded-full transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-md"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-medium text-slate-500 uppercase">Or continue with</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google Sign Up */}
          <button
            type="button"
            onClick={triggerGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full border border-hairline-strong bg-surface hover:bg-hairline-soft text-ink font-medium h-11 rounded-full transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed hover:border-slate-300 hover:shadow-md"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          {/* Sign In Link */}
          <div className="text-center pt-4 border-t border-slate-100">
            <p className="text-slate-600 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-accent hover:text-accent-deep transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;