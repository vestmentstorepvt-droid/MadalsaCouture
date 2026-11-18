import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
const logoSrc = '/assets/madalsa-logo.webp';
import { useVerifyEmailChangeMutation } from '../../services/authApi';

type Status = 'verifying' | 'success' | 'error';

const getErrorMessage = (err: unknown): string => {
  const apiErr = err as { data?: { message?: string; error?: { message?: string } } };
  return (
    apiErr?.data?.error?.message ||
    apiErr?.data?.message ||
    'This verification link is invalid or has expired. Please request the email change again.'
  );
};

const VerifyEmailChange: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [verifyEmailChange] = useVerifyEmailChangeMutation();
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error');
  const [message, setMessage] = useState(
    token ? '' : 'Verification link is missing. Please use the link from your email.',
  );
  // The token is single-use; guard against React StrictMode's double effect run.
  const requestedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token || requestedToken.current === token) return;
    requestedToken.current = token;

    verifyEmailChange({ token })
      .unwrap()
      .then((res) => {
        setMessage(res.message || 'Your email address has been updated.');
        setStatus('success');
      })
      .catch((err: unknown) => {
        setMessage(getErrorMessage(err));
        setStatus('error');
      });
  }, [token, verifyEmailChange]);

  return (
    <div className="min-h-screen bg-[#FDF4F7] px-4 py-6 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[2rem] border border-[#F7D7E0] bg-white/95 p-8 text-center shadow-[0_40px_120px_rgba(232,93,136,0.12)]">
        <img src={logoSrc} alt="Madalsa Couture" className="mx-auto mb-8 h-14 w-auto object-contain" />

        {status === 'verifying' && (
          <>
            <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-[#E85D88]" />
            <h1 className="text-xl font-bold text-slate-800">Verifying your new email…</h1>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Email updated</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
            <p className="mt-1 text-xs text-slate-400">Please sign in again with your new email address.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-rose-100 bg-rose-50">
              <AlertCircle className="h-8 w-8 text-rose-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Verification failed</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
          </>
        )}

        {status !== 'verifying' && (
          <Link
            to="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#E85D88] px-5 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-[#d44f72]"
          >
            Go to Sign In
          </Link>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailChange;
