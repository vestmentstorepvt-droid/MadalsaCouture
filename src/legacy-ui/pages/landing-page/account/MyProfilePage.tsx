import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useChangeEmailMutation,
} from '../../../services/profileApi';
import { removeAvatar, uploadAvatar } from '../../../services/directUpload';
import { updateUser } from '../../../store/slices/authSlice';
import { PASSWORD_POLICY_HINT, validatePasswordPolicy } from '../../../utils/passwordPolicy';
import {
  AccountHeading,
  Avatar,
  FormMessage,
  Panel,
  btnPrimary,
  btnSecondary,
  btnSmall,
  fieldClass,
  labelClass,
  useAccountToast,
} from '../../../components/features/account/AccountUI';

type ApiError = { data?: { message?: string; error?: { message?: string }; errors?: { message: string }[] } };
const apiMessage = (err: unknown) => {
  const e = err as ApiError;
  return e?.data?.errors?.[0]?.message || e?.data?.error?.message || e?.data?.message;
};

const ALLOWED_PHOTO = /^image\/(jpeg|png|webp|avif|heic|heif)$/i;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/* ── Photo ─────────────────────────────────────────────────────────────────── */

const PhotoPanel = ({ name, avatar, onChanged }: { name: string; avatar: string | null; onChanged: (url: string | null) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null || removing;

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!ALLOWED_PHOTO.test(file.type)) return setError('Choose a JPG, PNG or WebP photo.');
    if (file.size > MAX_PHOTO_BYTES) return setError('That photo is over 5 MB. Choose a smaller one.');

    const local = URL.createObjectURL(file);
    setPreview(local);
    setProgress(0);
    try {
      const url = await uploadAvatar(file, setProgress);
      onChanged(url);
    } catch (err) {
      setError((err as Error).message || 'Could not upload the photo. Please try again.');
    } finally {
      setProgress(null);
      setPreview(null);
    }
  };

  const remove = async () => {
    setError(null);
    setRemoving(true);
    try {
      await removeAvatar();
      onChanged(null);
    } catch (err) {
      setError((err as Error).message || 'Could not remove the photo. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Panel title="Profile photo" description="Shown in the header when you're signed in.">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="group relative h-24 w-24 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          aria-label={avatar ? 'Change profile photo' : 'Add a profile photo'}
        >
          {preview ? (
            <img src={preview} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <Avatar name={name} src={avatar} size={96} />
          )}
          <span
            className={`absolute inset-0 flex items-center justify-center rounded-full bg-ink/45 text-white transition-opacity ${
              busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {progress !== null ? (
              <span className="text-sm font-medium tabular-nums">{progress}%</span>
            ) : removing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </span>
        </button>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={btnSmall}>
              <Camera className="h-4 w-4" />
              {avatar ? 'Change photo' : 'Upload photo'}
            </button>
            {avatar ? (
              <button type="button" onClick={() => void remove()} disabled={busy} className={`${btnSmall} text-rose-700 hover:bg-rose-50`}>
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-xs text-mute">JPG, PNG or WebP, up to 5 MB. A square photo of your face works best.</p>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void pick(e)}
        />
      </div>
    </Panel>
  );
};

/* ── Password field ────────────────────────────────────────────────────────── */

const PasswordField = ({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${fieldClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-mute transition-colors hover:text-ink"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────────── */

const ProfileSkeleton = () => (
  <div className="animate-pulse space-y-5" aria-hidden="true">
    {[120, 220, 180].map((h) => (
      <div key={h} className="rounded-2xl border border-hairline bg-surface" style={{ height: h }} />
    ))}
  </div>
);

const MyProfilePage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, user: authUser } = useSelector((state: RootState) => state.auth);
  const { show: toast, node: toastNode } = useAccountToast();

  const { data: profile, isLoading, isError, refetch } = useGetProfileQuery(undefined, { skip: !isAuthenticated });
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();
  const [changeEmail, { isLoading: isChangingEmail }] = useChangeEmailMutation();

  // Personal details
  const [isEditing, setIsEditing] = useState(false);
  const [details, setDetails] = useState({ name: '', phone: '' });
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Email
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  // Password
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const name = profile?.name ?? authUser?.name ?? '';
  const email = profile?.email ?? authUser?.email ?? '';
  const phone = profile?.phone ?? '';
  const avatar = profile?.avatar ?? authUser?.avatar ?? null;

  useEffect(() => {
    if (!isEditing) setDetails({ name, phone });
  }, [name, phone, isEditing]);

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    setDetailsError(null);
    const trimmed = { name: details.name.trim(), phone: details.phone.trim() };
    if (trimmed.name.length < 3) return setDetailsError('Name must be at least 3 characters.');
    if (trimmed.phone && !/^\d{10}$/.test(trimmed.phone)) return setDetailsError('Enter a 10-digit mobile number without +91 or spaces.');
    try {
      await updateProfile({ name: trimmed.name, ...(trimmed.phone ? { phone: trimmed.phone } : {}) }).unwrap();
      dispatch(updateUser({ name: trimmed.name }));
      setIsEditing(false);
      toast('Your details are saved.');
    } catch (err) {
      setDetailsError(apiMessage(err) || 'Could not save your details. Please try again.');
    }
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSent(null);
    const newEmail = emailForm.newEmail.trim();
    if (!newEmail || !emailForm.currentPassword) return setEmailError('Enter the new email and your current password.');
    try {
      await changeEmail({ newEmail, currentPassword: emailForm.currentPassword }).unwrap();
      setEmailSent(newEmail);
      setEmailForm({ newEmail: '', currentPassword: '' });
      void refetch();
    } catch (err) {
      setEmailError(apiMessage(err) || 'Could not change your email. Check your current password and try again.');
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!passwords.currentPassword) return setPasswordError('Enter your current password.');
    if (!passwords.newPassword) return setPasswordError('Enter a new password.');
    const policyError = validatePasswordPolicy(passwords.newPassword);
    if (policyError) return setPasswordError(policyError);
    if (passwords.newPassword !== passwords.confirmPassword) return setPasswordError('The new passwords don’t match.');
    try {
      await changePassword(passwords).unwrap();
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast('Your password is changed.');
    } catch (err) {
      setPasswordError(apiMessage(err) || 'Could not change your password. Check your current password and try again.');
    }
  };

  const onPhotoChanged = (url: string | null) => {
    dispatch(updateUser({ avatar: url }));
    void refetch();
    toast(url ? 'Your photo is updated.' : 'Your photo is removed.');
  };

  return (
    <>
      <AccountHeading title="My profile" description="Your photo, contact details and sign-in settings." />

      {isLoading ? (
        <ProfileSkeleton />
      ) : isError && !authUser ? (
        <Panel>
          <div className="py-8 text-center">
            <p className="text-sm text-body">We couldn’t load your profile.</p>
            <button type="button" onClick={() => void refetch()} className={`${btnSecondary} mt-4`}>
              Try again
            </button>
          </div>
        </Panel>
      ) : (
        <div className="space-y-5">
          <PhotoPanel name={name} avatar={avatar} onChanged={onPhotoChanged} />

          <Panel
            title="Personal details"
            action={
              !isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)} className={btnSmall}>
                  Edit
                </button>
              ) : null
            }
          >
            {isEditing ? (
              <form onSubmit={(e) => void saveDetails(e)} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-name" className={labelClass}>
                      Full name
                    </label>
                    <input
                      id="profile-name"
                      value={details.name}
                      onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))}
                      autoComplete="name"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-phone" className={labelClass}>
                      Mobile number
                    </label>
                    <input
                      id="profile-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={details.phone}
                      onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value.replace(/\D/g, '') }))}
                      autoComplete="tel-national"
                      placeholder="10-digit number"
                      className={fieldClass}
                    />
                  </div>
                </div>
                {detailsError ? <FormMessage tone="error">{detailsError}</FormMessage> : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setDetailsError(null);
                    }}
                    className={btnSecondary}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isSaving} className={btnPrimary}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSaving ? 'Saving' : 'Save details'}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                {[
                  { term: 'Full name', value: name },
                  { term: 'Email', value: email },
                  { term: 'Mobile number', value: phone ? `+91 ${phone}` : null },
                ].map(({ term, value }) => (
                  <div key={term} className="min-w-0">
                    <dt className="text-xs text-mute">{term}</dt>
                    <dd className={`mt-0.5 truncate text-sm ${value ? 'text-ink' : 'text-faint'}`}>{value || 'Not added'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          <Panel title="Email address" description={`You sign in with ${email}. We’ll send a link to confirm the new address.`}>
            <form onSubmit={(e) => void submitEmail(e)} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-email" className={labelClass}>
                    New email
                  </label>
                  <input
                    id="new-email"
                    type="email"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm((f) => ({ ...f, newEmail: e.target.value }))}
                    autoComplete="email"
                    placeholder="name@example.com"
                    className={fieldClass}
                  />
                </div>
                <PasswordField
                  id="email-current-password"
                  label="Current password"
                  value={emailForm.currentPassword}
                  onChange={(v) => setEmailForm((f) => ({ ...f, currentPassword: v }))}
                  autoComplete="current-password"
                />
              </div>
              {emailError ? <FormMessage tone="error">{emailError}</FormMessage> : null}
              {emailSent ? (
                <FormMessage tone="success">
                  We sent a confirmation link to {emailSent}. Your current email keeps working until you open it.
                </FormMessage>
              ) : null}
              <div className="flex justify-end">
                <button type="submit" disabled={isChangingEmail} className={btnPrimary}>
                  {isChangingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isChangingEmail ? 'Sending link' : 'Change email'}
                </button>
              </div>
            </form>
          </Panel>

          <Panel title="Password" description={PASSWORD_POLICY_HINT}>
            <form onSubmit={(e) => void submitPassword(e)} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-3">
                <PasswordField
                  id="current-password"
                  label="Current password"
                  value={passwords.currentPassword}
                  onChange={(v) => setPasswords((p) => ({ ...p, currentPassword: v }))}
                  autoComplete="current-password"
                />
                <PasswordField
                  id="new-password"
                  label="New password"
                  value={passwords.newPassword}
                  onChange={(v) => setPasswords((p) => ({ ...p, newPassword: v }))}
                  autoComplete="new-password"
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirm new password"
                  value={passwords.confirmPassword}
                  onChange={(v) => setPasswords((p) => ({ ...p, confirmPassword: v }))}
                  autoComplete="new-password"
                />
              </div>
              {passwordError ? <FormMessage tone="error">{passwordError}</FormMessage> : null}
              <div className="flex justify-end">
                <button type="submit" disabled={isChangingPassword} className={btnPrimary}>
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isChangingPassword ? 'Changing' : 'Change password'}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}
      {toastNode}
    </>
  );
};

export default MyProfilePage;
