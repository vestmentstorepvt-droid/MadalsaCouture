import { useState, useEffect } from 'react';
import { Eye, EyeOff, Pencil, ShieldCheck, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useChangeEmailMutation,
} from '../../../services/profileApi';
import { ActionButton, SectionCard } from '../../../components/features/account/AccountComponents';
import { validatePasswordPolicy } from '../../../utils/passwordPolicy';

// ─── Loading skeleton ─────────────────────────────────────────────────────────
const ProfileSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-4 w-32 rounded-full bg-slate-200" />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="h-12 rounded-2xl bg-slate-100" />
      <div className="h-12 rounded-2xl bg-slate-100" />
      <div className="h-12 rounded-2xl bg-slate-100" />
    </div>
  </div>
);

// ─── Error state ──────────────────────────────────────────────────────────────
const ProfileErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-8 py-14 text-center shadow-sm">
    <p className="text-lg font-semibold text-rose-700">Failed to load your profile.</p>
    {onRetry ? (
      <ActionButton variant="outline" onClick={onRetry} className="mt-4">
        Retry
      </ActionButton>
    ) : null}
  </div>
);

const MyProfilePage = () => {
  const { isAuthenticated, user: authUser } = useSelector((state: RootState) => state.auth);


  // Fetch from API only if authenticated
  const {
    data: profileData,
    isLoading: isProfileLoading,
    isError: isProfileError,
    refetch,
  } = useGetProfileQuery(undefined, { skip: !isAuthenticated });


  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();
  const [changeEmail, { isLoading: isChangingEmail }] = useChangeEmailMutation();

  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });

  // Keep a snapshot to revert on cancel
  const [snapshot, setSnapshot] = useState(form);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Initialize form from profile data (API wins over auth state for phone)
  useEffect(() => {
    const name = profileData?.name ?? authUser?.name ?? '';
    const email = profileData?.email ?? authUser?.email ?? '';
    const phone = profileData?.phone ?? '';
    const newForm = { fullName: name, email, phone };
    setForm(newForm);
    setSnapshot(newForm);
  }, [profileData, authUser]);

  const handleField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handlePassword = (key: keyof typeof passwords) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPasswords((prev) => ({ ...prev, [key]: e.target.value }));

  const toggleShow = (key: keyof typeof show) =>
    setShow((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleEdit = () => {
    setSnapshot(form);
    setSaveError(null);
    setSaveSuccess(false);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setForm(snapshot);
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateProfile({ name: form.fullName, phone: form.phone }).unwrap();
      setIsEditing(false);
      setSaveSuccess(true);
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!passwords.currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!passwords.newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }
    const policyError = validatePasswordPolicy(passwords.newPassword);
    if (policyError) {
      setPasswordError(policyError);
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword,
      }).unwrap();
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string; error?: { message?: string }; errors?: { message: string }[] } };
      const backendMsg =
        apiErr?.data?.errors?.[0]?.message ||
        apiErr?.data?.error?.message ||
        apiErr?.data?.message;
      setPasswordError(backendMsg || 'Failed to update password. Please check your current password and try again.');
    }
  };

  const handleUpdateEmail = async () => {
    setEmailError('');
    setEmailSuccess(false);

    if (!emailForm.newEmail.trim() || !emailForm.currentPassword.trim()) {
      setEmailError('Please provide both new email and current password.');
      return;
    }

    try {
      await changeEmail({
        newEmail: emailForm.newEmail,
        currentPassword: emailForm.currentPassword,
      }).unwrap();

      setEmailSuccess(true);
      setEmailForm({ newEmail: '', currentPassword: '' });
      refetch(); // to get updated email
      
      // Clear success after 3s
      setTimeout(() => setEmailSuccess(false), 3000);
    } catch (err: any) {
      const backendMsg = err?.data?.errors?.[0]?.message || err?.data?.error?.message || err?.data?.message;
      setEmailError(backendMsg || 'Failed to update email. Please check your current password and try again.');
    }
  };

  const inputBase =
    'w-full rounded-2xl border px-4 py-3 text-sm text-slate-800 outline-none transition';

  const inputClass = isEditing
    ? `${inputBase} border-[#E4D1BB] bg-[#FFFDF9] focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20`
    : `${inputBase} border-transparent bg-[#F7F4EF] text-slate-600 cursor-default select-none`;

  const passwordInputClass =
    `${inputBase} border-[#E4D1BB] bg-[#FFFDF9] pr-12 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20`;

  // Show loading skeleton while fetching profile
  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.12),_transparent_28%),linear-gradient(145deg,_#FFF9F1_0%,_#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionCard title="My Profile" subtitle="Manage your personal details and account security.">
            <ProfileSkeleton />
          </SectionCard>
        </div>
      </div>
    );
  }

  // Show error state if profile fetch failed and no auth data
  if (isProfileError && !authUser) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.12),_transparent_28%),linear-gradient(145deg,_#FFF9F1_0%,_#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionCard title="My Profile" subtitle="Manage your personal details and account security.">
            <ProfileErrorState onRetry={refetch} />
          </SectionCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.12),_transparent_28%),linear-gradient(145deg,_#FFF9F1_0%,_#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionCard title="My Profile" subtitle="Manage your personal details and account security.">

          {/* ── Personal Information header ── */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4AF37]">
              Personal Information
            </p>
            {isEditing ? (
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1.5 rounded-full border border-[#E4D1BB] bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEdit}
                className="flex items-center gap-1.5 rounded-full border border-[#E4D1BB] bg-white px-3 py-1.5 text-xs font-medium text-[#A67B26] transition hover:border-[#D4AF37] hover:bg-[#FFF9F0]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Full Name', key: 'fullName' as const, type: 'text' },
              { label: 'Email', key: 'email' as const, type: 'email' },
              { label: 'Phone', key: 'phone' as const, type: 'tel' },
            ].map(({ label, key, type }) => (
              <label key={key} className="block text-sm text-slate-700">
                <span className="mb-2 block font-medium">{label}</span>
                <input
                  type={type}
                  value={form[key]}
                  onChange={handleField(key)}
                  readOnly={!isEditing || key === 'email'}
                  className={key === 'email' ? `${inputBase} border-transparent bg-[#F7F4EF] text-slate-600 cursor-default select-none` : inputClass}
                />
              </label>
            ))}
          </div>

          {saveError ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Profile updated successfully.
            </p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <ActionButton
              variant="primary"
              disabled={!isEditing || isSaving}
              onClick={() => void handleSave()}
              className={!isEditing ? 'opacity-40 cursor-not-allowed' : ''}
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </ActionButton>
          </div>

          {/* ── Separator ── */}
          <div className="my-6 border-t border-[#EDE3D6]" />

          {/* ── Change Email ── */}
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4AF37]">
            Change Email
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-700">
              <span className="mb-2 flex items-center gap-2 font-medium">
                New Email
              </span>
              <input
                type="email"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm(prev => ({ ...prev, newEmail: e.target.value }))}
                placeholder="new@example.com"
                className={inputBase + ' border-[#E4D1BB] bg-[#FFFDF9] focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20'}
              />
            </label>

            <label className="block text-sm text-slate-700">
              <span className="mb-2 flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
                Current Password
              </span>
              <div className="relative">
                <input
                  type={show.currentPassword ? 'text' : 'password'}
                  value={emailForm.currentPassword}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="••••••••"
                  className={passwordInputClass}
                />
              </div>
            </label>
          </div>

          {emailError ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {emailError}
            </p>
          ) : null}
          {emailSuccess ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Verification link sent. Check your new inbox and click the link to confirm the change — your current email stays active until then.
            </p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <ActionButton
              variant="primary"
              disabled={isChangingEmail}
              onClick={() => void handleUpdateEmail()}
            >
              {isChangingEmail ? 'Updating…' : 'Update Email'}
            </ActionButton>
          </div>

          {/* ── Separator ── */}
          <div className="my-6 border-t border-[#EDE3D6]" />

          {/* ── Change Password ── */}
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4AF37]">
            Change Password
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {([
              { label: 'Current Password', key: 'currentPassword' as const },
              { label: 'New Password', key: 'newPassword' as const },
              { label: 'Confirm Password', key: 'confirmPassword' as const },
            ] as const).map(({ label, key }) => (
              <label key={key} className="block text-sm text-slate-700">
                <span className="mb-2 flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
                  {label}
                </span>
                <div className="relative">
                  <input
                    type={show[key] ? 'text' : 'password'}
                    value={passwords[key]}
                    onChange={handlePassword(key)}
                    placeholder="••••••••"
                    className={passwordInputClass}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow(key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    aria-label={show[key] ? 'Hide password' : 'Show password'}
                  >
                    {show[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            ))}
          </div>

          {passwordError ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {passwordError}
            </p>
          ) : null}
          {passwordSuccess ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Password updated successfully.
            </p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <ActionButton
              variant="primary"
              disabled={isChangingPassword}
              onClick={() => void handleUpdatePassword()}
            >
              {isChangingPassword ? 'Updating…' : 'Update Password'}
            </ActionButton>
          </div>

        </SectionCard>
      </div>
    </div>
  );
};

export default MyProfilePage;
