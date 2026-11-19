import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  User, Lock, Mail, Shield, Check, AlertCircle, RefreshCw,
  Eye, EyeOff, Sparkles, Key, Save
} from 'lucide-react';
import type { RootState } from '../../store';
import { login } from '../../store/slices/authSlice';
import {
  useGetProfileQuery,
  useUpdateAdminProfileMutation,
  useChangePasswordMutation,
  useChangeEmailMutation,
} from '../../services/profileApi';
import { AppButton } from '../../components/ui/button/AppButton';
import { PASSWORD_POLICY_HINT, validatePasswordPolicy } from '../../utils/passwordPolicy';

// ── Shared styles ──────────────────────────────────────────────────────────────
const INPUT = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition';
const INPUT_ERR = 'w-full px-4 py-2.5 rounded-xl border border-rose-400 text-sm bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300/30 focus:border-rose-500 transition';

const FieldError: React.FC<{ msg?: string }> = ({ msg }) =>
  msg ? <p className="text-xs text-rose-500 mt-1">{msg}</p> : null;

// ── Password visibility toggle ─────────────────────────────────────────────────
const PasswordInput: React.FC<{
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string;
  className?: string;
}> = ({ id, value, onChange, placeholder, autoComplete, className }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${className} pr-10`}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(p => !p)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

// ── Toast ──────────────────────────────────────────────────────────────────────
interface Toast { message: string; type: 'success' | 'error' }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show };
}

const ToastBanner: React.FC<{ toast: Toast | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div role="alert" className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900' : 'bg-rose-50/95 border-rose-200 text-rose-900'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
        {toast.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      </div>
      {toast.message}
    </div>
  );
};

// ── Section card wrapper ───────────────────────────────────────────────────────
const SectionCard: React.FC<{
  step: string; title: string; subtitle: string;
  color: string; icon: React.ReactNode; children: React.ReactNode;
}> = ({ step, title, subtitle, color, icon, children }) => (
  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${color}`}>{step}</div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-slate-400">{icon}</span>
        <div>
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
    {children}
  </div>
);

// ─── Card 1: Profile Info (GET + PATCH /admin-profile for name/email) ─────────
const ProfileInfoCard: React.FC = () => {
  const dispatch = useDispatch();
  const authUser = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);

  // GET /auth/profile — load real server data
  const { data: profile, isLoading: profileLoading, refetch } = useGetProfileQuery();

  // PATCH /auth/admin-profile — update name and/or email together
  const [updateAdminProfile, { isLoading: isSaving }] = useUpdateAdminProfileMutation();

  const { toast, show: showToast } = useToast();

  const [form, setForm] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    if (profile) {
      setForm({ name: profile.name ?? '', email: profile.email ?? '' });
    } else if (authUser) {
      setForm({ name: authUser.name ?? '', email: authUser.email ?? '' });
    }
  }, [profile, authUser]);

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      // PATCH /auth/admin-profile — accepts { name, email, password }
      const updated = await updateAdminProfile({ name: form.name.trim() }).unwrap();
      // Sync Redux auth state
      if (authUser) {
        dispatch(login({
          id: authUser.id,
          name: updated.name,
          email: authUser.email,
          role: authUser.role as 'ADMIN' | 'USER',
          token: token ?? undefined,
          refreshToken: refreshToken ?? undefined,
        }));
      }
      refetch();
      showToast('Profile updated successfully!', 'success');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      showToast(e?.data?.message ?? 'Failed to update profile.', 'error');
    }
  };

  return (
    <>
      <ToastBanner toast={toast} />
      <SectionCard step="01" title="Account Identity" subtitle="Your display name and account email" color="bg-indigo-50 text-indigo-700" icon={<User className="w-4 h-4" />}>
        {profileLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-slate-200" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="admin-name" className="text-xs font-bold text-slate-700 block mb-1">Full Name *</label>
              <input
                id="admin-name"
                type="text"
                className={errors.name ? INPUT_ERR : INPUT}
                value={form.name}
                onChange={(e) => { setForm(f => ({ ...f, name: e.target.value })); setErrors(v => ({ ...v, name: '' })); }}
                placeholder="Your display name"
              />
              <FieldError msg={errors.name} />
            </div>

            {/* Email — read-only; changing email requires current password via separate flow */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
              <input
                type="email"
                className={`${INPUT} bg-slate-50 text-slate-400 cursor-not-allowed`}
                value={form.email}
                readOnly
                aria-label="Email (read only — use Change Email section below)"
              />
              <p className="text-xs text-slate-400 mt-1">To change your email address, use the <span className="font-bold text-slate-600">Change Email</span> section below.</p>
            </div>

            {/* Role pill */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-slate-700">Role</span>
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-ink text-white shadow-sm">
                <Sparkles className="w-2.5 h-2.5" /> {authUser?.role ?? 'ADMIN'}
              </span>
              <span className="text-xs text-slate-400">Role cannot be changed via this page.</span>
            </div>

            <div className="flex justify-end pt-1">
              <AppButton variant="primary" size="md" isLoading={isSaving} onClick={() => void handleSave()}>
                <Save className="w-4 h-4 mr-1.5" /> Save Profile
              </AppButton>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
};

// ─── Card 2: Change Password (POST /auth/change-password) ─────────────────────
const ChangePasswordCard: React.FC = () => {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const { toast, show: showToast } = useToast();

  const [fields, setFields] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<typeof fields>>({});

  const set = (k: keyof typeof fields) => (v: string) => {
    setFields(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e: Partial<typeof fields> = {};
    if (!fields.currentPassword) e.currentPassword = 'Current password is required.';
    if (!fields.newPassword) e.newPassword = 'New password is required.';
    else {
      const policyError = validatePasswordPolicy(fields.newPassword);
      if (policyError) e.newPassword = policyError;
    }
    if (!fields.confirmPassword) e.confirmPassword = 'Please confirm your new password.';
    else if (fields.newPassword !== fields.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await changePassword({
        currentPassword: fields.currentPassword,
        newPassword: fields.newPassword,
        confirmPassword: fields.confirmPassword,
      }).unwrap();
      setFields({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password changed successfully!', 'success');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      showToast(e?.data?.message ?? 'Failed to change password. Check your current password.', 'error');
    }
  };

  return (
    <>
      <ToastBanner toast={toast} />
      <SectionCard step="02" title="Change Password" subtitle="Requires your current password" color="bg-amber-50 text-amber-700" icon={<Lock className="w-4 h-4" />}>
        <div className="space-y-4">
          <div>
            <label htmlFor="cp-current" className="text-xs font-bold text-slate-700 block mb-1">Current Password *</label>
            <PasswordInput id="cp-current" value={fields.currentPassword} onChange={set('currentPassword')} placeholder="••••••••" autoComplete="current-password" className={errors.currentPassword ? INPUT_ERR : INPUT} />
            <FieldError msg={errors.currentPassword} />
          </div>
          <div>
            <label htmlFor="cp-new" className="text-xs font-bold text-slate-700 block mb-1">New Password * <span className="font-normal text-slate-400">({PASSWORD_POLICY_HINT})</span></label>
            <PasswordInput id="cp-new" value={fields.newPassword} onChange={set('newPassword')} placeholder="••••••••" autoComplete="new-password" className={errors.newPassword ? INPUT_ERR : INPUT} />
            <FieldError msg={errors.newPassword} />
          </div>
          <div>
            <label htmlFor="cp-confirm" className="text-xs font-bold text-slate-700 block mb-1">Confirm New Password *</label>
            <PasswordInput id="cp-confirm" value={fields.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" autoComplete="new-password" className={errors.confirmPassword ? INPUT_ERR : INPUT} />
            <FieldError msg={errors.confirmPassword} />
          </div>

          {/* Strength hint */}
          {fields.newPassword && (
            <div className="flex gap-1 mt-1">
              {[8, 12, 16].map((len, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${fields.newPassword.length >= len ? ['bg-rose-400', 'bg-amber-400', 'bg-emerald-500'][i] : 'bg-slate-200'}`} />
              ))}
              <span className="text-xs text-slate-400 ml-2 self-center">
                {fields.newPassword.length < 8 ? 'Weak' : fields.newPassword.length < 12 ? 'Fair' : fields.newPassword.length < 16 ? 'Good' : 'Strong'}
              </span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <AppButton variant="primary" size="md" isLoading={isLoading} onClick={() => void handleSubmit()}>
              <Key className="w-4 h-4 mr-1.5" /> Change Password
            </AppButton>
          </div>
        </div>
      </SectionCard>
    </>
  );
};

// ─── Card 3: Change Email (POST /auth/change-email) ───────────────────────────
const ChangeEmailCard: React.FC = () => {
  const [changeEmail, { isLoading }] = useChangeEmailMutation();
  const { toast, show: showToast } = useToast();

  const [fields, setFields] = useState({ currentPassword: '', newEmail: '' });
  const [errors, setErrors] = useState<Partial<typeof fields>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(p => ({ ...p, [k]: e.target.value }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e: Partial<typeof fields> = {};
    if (!fields.currentPassword) e.currentPassword = 'Current password is required.';
    if (!fields.newEmail) e.newEmail = 'New email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.newEmail)) e.newEmail = 'Enter a valid email address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      // POST /auth/change-email  Body: { currentPassword, newEmail }
      await changeEmail({ currentPassword: fields.currentPassword, newEmail: fields.newEmail }).unwrap();
      setSentTo(fields.newEmail);
      setFields({ currentPassword: '', newEmail: '' });
      showToast('Verification email sent!', 'success');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      showToast(e?.data?.message ?? 'Failed to request email change.', 'error');
    }
  };

  return (
    <>
      <ToastBanner toast={toast} />
      <SectionCard step="03" title="Change Email Address" subtitle="Requires your current password; a verification link is emailed to the new address" color="bg-sky-50 text-sky-700" icon={<Mail className="w-4 h-4" />}>
        {sentTo ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-sky-50 border-2 border-sky-200 flex items-center justify-center">
              <Mail className="w-7 h-7 text-sky-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Verification Email Sent</p>
              <p className="text-xs text-slate-500 mt-1">A verification link was sent to <strong className="text-slate-800">{sentTo}</strong>.</p>
              <p className="text-xs text-slate-500">Please check your inbox and click the link to confirm the change.</p>
            </div>
            <button type="button" onClick={() => setSentTo(null)} className="text-xs font-bold text-accent hover:underline transition">
              Change Again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="ce-pass" className="text-xs font-bold text-slate-700 block mb-1">Current Password *</label>
              <PasswordInput id="ce-pass" value={fields.currentPassword} onChange={(v) => { setFields(p => ({ ...p, currentPassword: v })); setErrors(p => ({ ...p, currentPassword: '' })); }} placeholder="••••••••" autoComplete="current-password" className={errors.currentPassword ? INPUT_ERR : INPUT} />
              <FieldError msg={errors.currentPassword} />
            </div>
            <div>
              <label htmlFor="ce-email" className="text-xs font-bold text-slate-700 block mb-1">New Email Address *</label>
              <input id="ce-email" type="email" className={errors.newEmail ? INPUT_ERR : INPUT} value={fields.newEmail} onChange={set('newEmail')} placeholder="new@example.com" autoComplete="email" />
              <FieldError msg={errors.newEmail} />
            </div>
            <div className="flex justify-end pt-1">
              <AppButton variant="primary" size="md" isLoading={isLoading} onClick={() => void handleSubmit()}>
                <Mail className="w-4 h-4 mr-1.5" /> Request Email Change
              </AppButton>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export const AdminProfile: React.FC = () => {
  const authUser = useSelector((state: RootState) => state.auth.user);
  const { isLoading: profileLoading } = useGetProfileQuery();
  const userInitial = ((authUser?.name || authUser?.email || 'A').charAt(0) || 'A').toUpperCase();

  return (
    <div className="min-h-screen p-6 sm:p-8 bg-canvas space-y-6">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Gradient banner */}
        <div className="h-12 bg-ink relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #c2255c 0%, transparent 60%), radial-gradient(circle at 80% 20%, #c03a6b 0%, transparent 50%)' }} />
        </div>

        {/* Avatar + info row */}
        <div className="px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-3xl bg-ink flex items-center justify-center text-white text-3xl font-black border-4 border-white shadow-xl shadow-black/20 flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 truncate">{authUser?.name ?? 'Admin User'}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-ink text-white shadow-sm">
                  <Sparkles className="w-2.5 h-2.5" /> {authUser?.role ?? 'ADMIN'}
                </span>
                {profileLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{authUser?.email ?? ''}</p>
            </div>
          </div>
        </div>
      </div>



      {/* ── Cards ────────────────────────────────────────────────────────── */}
      <ProfileInfoCard />
      <ChangePasswordCard />
      <ChangeEmailCard />
    </div>
  );
};

export default AdminProfile;
