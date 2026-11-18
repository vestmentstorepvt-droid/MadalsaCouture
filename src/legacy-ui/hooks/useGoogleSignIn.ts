import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../store/slices/authSlice';
import { useGoogleLoginMutation } from '../services/authApi';
import type { AppDispatch } from '../store';

declare global {
  interface Window {
    google?: any;
  }
}

const extractErrorMessage = (error: unknown): string => {
  const apiError = error as { data?: any; message?: string };
  const data = apiError?.data;

  if (!data) {
    if (typeof apiError?.message === 'string') return apiError.message;
    return 'Google authentication failed. Please try again.';
  }

  if (typeof data === 'string') return data;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.error?.message === 'string') return data.error.message;

  return 'Google authentication failed. Please try again.';
};

export const useGoogleSignIn = (mode: 'login' | 'signup' = 'login') => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [googleLoginMutation, { isLoading: isGoogleLoading }] = useGoogleLoginMutation();
  const [googleError, setGoogleError] = useState<string>('');
  const [googleSuccess, setGoogleSuccess] = useState<string>('');

  useEffect(() => {
    // Dynamically load Google Identity Services SDK script if not already present
    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  const handleGoogleSuccess = useCallback(async (token: string) => {
    try {
      setGoogleError('');
      setGoogleSuccess('');

      const response = await googleLoginMutation({ credential: token, token, mode }).unwrap();

      if (mode === 'signup') {
        const msg = response.message || 'Account created successfully with Google! Redirecting to login...';
        setGoogleSuccess(msg);
        setTimeout(() => {
          navigate('/login');
        }, 1800);
        return;
      }

      // Mode is 'login'
      const resUser = response.user as Record<string, any> | undefined;
      const accessToken = response.accessToken ?? (response as Record<string, any>).token ?? null;
      const refreshToken = response.refreshToken ?? null;
      const serverRole = (response.role ?? resUser?.role ?? '').toString().trim().toUpperCase();
      const role = serverRole.includes('ADMIN') ? 'ADMIN' : ('USER' as 'ADMIN' | 'USER');
      const userId = resUser?.id ?? resUser?._id ?? '1';
      const userEmail = resUser?.email ?? '';
      const name = resUser?.name ?? userEmail.split('@')[0] ?? 'User';

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

      navigate(role === 'ADMIN' ? '/admin/dashboard' : '/', { replace: true });
    } catch (error: unknown) {
      console.error('Google Sign-In backend verification failed', error);
      setGoogleError(extractErrorMessage(error));
    }
  }, [dispatch, googleLoginMutation, mode, navigate]);


  const triggerGoogleSignIn = useCallback(() => {
    setGoogleError('');
    setGoogleSuccess('');
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setGoogleError('Google Client ID is missing. Please configure VITE_GOOGLE_CLIENT_ID in your .env file.');
      return;
    }

    if (!window.google?.accounts) {
      setGoogleError('Google Sign-In SDK is still loading. Please try again in a moment.');
      return;
    }

    try {
      if (window.google.accounts.oauth2) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (res: any) => {
            if (res.access_token) {
              await handleGoogleSuccess(res.access_token);
            } else if (res.error) {
              setGoogleError(`Google authentication canceled or failed: ${res.error}`);
            }
          },
        });
        client.requestAccessToken();
      } else if (window.google.accounts.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (res: any) => {
            if (res.credential) {
              await handleGoogleSuccess(res.credential);
            }
          },
        });
        window.google.accounts.id.prompt();
      }
    } catch (err: any) {
      console.error('Error launching Google Sign-In popup', err);
      setGoogleError(err.message || 'Failed to open Google Sign-In.');
    }
  }, [handleGoogleSuccess]);

  return {
    triggerGoogleSignIn,
    isGoogleLoading,
    googleError,
    googleSuccess,
    setGoogleError,
    setGoogleSuccess,
  };
};
