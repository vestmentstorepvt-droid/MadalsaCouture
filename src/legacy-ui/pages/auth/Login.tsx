

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { login } from '../../store/slices/authSlice';
import type { AppDispatch, RootState } from '../../store';
import { useLoginMutation } from '../../services/authApi';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useSyncCartApiMutation } from '../../services/cartApi';
import { selectCartItems } from '../../store/slices/cartSlice';
const logoSrc = '/assets/madalsa-logo.webp';

const Login: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  // If we were redirected here from another page (e.g. review modal), go back there after login
  const locationState = location.state as { from?: string; registered?: boolean } | null;
  const redirectTo = locationState?.from || null;
  const justRegistered = Boolean(locationState?.registered);
  const localCartItems = useSelector(selectCartItems);
  const [loginMutation, { isLoading }] = useLoginMutation();
  const [syncCartApi] = useSyncCartApiMutation();
  const { triggerGoogleSignIn, isGoogleLoading, googleError } = useGoogleSignIn('login');




  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      const destination = redirectTo || (user.role === 'ADMIN' ? '/admin/dashboard' : '/');
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, navigate, user, redirectTo]);

  const getLoginErrorMessage = (error: unknown) => {
    const apiError = error as { data?: any; status?: number };
    const data = apiError?.data;

    if (!data) {
      return 'Invalid email or password. Please try again.';
    }

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data.message === 'string') {
      return data.message;
    }

    if (typeof data.error === 'string') {
      return data.error;
    }

    if (typeof data.error?.message === 'string') {
      return data.error.message;
    }

    return 'Invalid email or password. Please try again.';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    try {
      setErrorMessage('');
      const response = await loginMutation({
        email: email.trim().toLowerCase(),
        password,
      }).unwrap();

      const resUser = response.user as Record<string, any> | undefined;
      const normalizedEmail = email.trim().toLowerCase();
      const accessToken = response.accessToken ?? (response as Record<string, any>).token ?? null;
      const refreshToken = response.refreshToken ?? null;
      const serverRole = (response.role ?? resUser?.role ?? '').toString().trim().toUpperCase();
      const role = serverRole.includes('ADMIN') ? 'ADMIN' : 'USER' as 'ADMIN' | 'USER';
      const userId = resUser?.id ?? resUser?._id ?? '1';
      const userEmail = resUser?.email ?? normalizedEmail;
      const name = resUser?.name ?? (normalizedEmail.split('@')[0] || normalizedEmail);

      dispatch(login({
        id: userId,
        email: userEmail,
        name,
        role,
        token: accessToken ?? undefined,
        accessToken: accessToken ?? undefined,
        refreshToken: refreshToken ?? undefined,
        user: {
          id: userId,
          name,
          email: userEmail,
          role,
        },
      }));

      // Sync guest cart items to server cart if available
      if (localCartItems.length > 0) {
        try {
          await syncCartApi({
            items: localCartItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              selectedSize: item.size,
              selectedColor: item.color,
              quantity: item.quantity,
              price: item.price,
            })),
          }).unwrap();
        } catch {
          // Silent fallback for guest cart sync
        }
      }

      navigate(redirectTo || (role === 'ADMIN' ? '/admin/dashboard' : '/'), { replace: true });

    } catch (error: unknown) {
      console.error('Login failed', error);
      setErrorMessage(getLoginErrorMessage(error));
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src={logoSrc} alt="Madalsa Couture" className="h-14 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h1>
          <p className="text-slate-600 text-sm">Sign in to your account to continue shopping</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {justRegistered && !errorMessage && (
              <div role="status" className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-medium text-green-900">
                Account created successfully. Please sign in.
              </div>
            )}

            {/* Error Alert */}
            {(typeof errorMessage === 'string' && errorMessage) || (typeof googleError === 'string' && googleError) ? (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex gap-3">
                <div className="text-red-500 mt-0.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-900">
                    {(typeof errorMessage === 'string' && errorMessage) ? errorMessage : googleError}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-2">
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
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-[#E85D88] focus:bg-white focus:ring-2 focus:ring-[#E85D88]/20 hover:border-slate-300"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-900 mb-2">
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
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-[#E85D88] focus:bg-white focus:ring-2 focus:ring-[#E85D88]/20 hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between pt-2">
              <span />
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-[#E85D88] hover:text-[#d44f72] transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#E85D88] to-[#d44f72] hover:shadow-lg text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-[0_10px_30px_rgba(232,93,136,0.3)]"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-500 uppercase">Or continue with</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={triggerGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed hover:border-slate-300 hover:shadow-md"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="text-center pt-4 border-t border-slate-100">
            <p className="text-slate-600 text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold text-[#E85D88] hover:text-[#d44f72] transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
