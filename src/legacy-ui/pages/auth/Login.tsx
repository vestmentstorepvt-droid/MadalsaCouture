import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { login } from '../../store/slices/authSlice';
import type { AppDispatch, RootState } from '../../store';
import { useLoginMutation } from '../../services/authApi';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useSyncCartApiMutation } from '../../services/cartApi';
import { selectCartItems } from '../../store/slices/cartSlice';
import { AuthSplitLayout } from '../../components/features/auth/AuthSplitLayout';

const inputClass =
  'h-11 w-full rounded-md border border-hairline-strong bg-surface px-3.5 text-base text-ink placeholder:text-faint outline-none transition-colors hover:border-mute focus:border-ink focus:ring-2 focus:ring-ink/15 sm:text-sm';

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

    if (!data) return 'Invalid email or password. Please try again.';
    if (typeof data === 'string') return data;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
    if (typeof data.error?.message === 'string') return data.error.message;
    return 'Invalid email or password. Please try again.';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;

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
      const avatar = (resUser?.avatar as string | null | undefined) ?? null;

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
          avatar,
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

  const shownError = (typeof errorMessage === 'string' && errorMessage) || (typeof googleError === 'string' && googleError) || '';

  return (
    <AuthSplitLayout
      title="Welcome back"
      description="Sign in to track your orders, save your addresses and check out faster."
      footer={
        <p>
          New to Madalsa?{' '}
          <Link to="/signup" state={location.state} className="font-medium text-accent underline-offset-4 hover:text-accent-deep hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      {justRegistered && !shownError && (
        <div role="status" className="mb-6 flex gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Your account is ready. Sign in to continue.
        </div>
      )}

      {shownError && (
        <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p>{shownError}</p>
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
        {isGoogleLoading ? 'Connecting to Google…' : 'Continue with Google'}
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-mute">
        <span className="h-px flex-1 bg-hairline" />
        or sign in with email
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              Password
            </label>
            <Link to="/forgot-password" className="text-sm text-mute underline-offset-4 hover:text-ink hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#5e0d1d] text-sm font-medium text-[#f6ead2] ring-1 ring-inset ring-[#e2c27a]/50 transition-colors hover:bg-[#741427] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e0d1d] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthSplitLayout>
  );
};

export default Login;
