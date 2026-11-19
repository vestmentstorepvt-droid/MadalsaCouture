import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import {
  MapPin, Plus, Pencil, Trash2, Star, Check, AlertCircle,
  RefreshCw, Home, Briefcase, X, Phone, User
} from 'lucide-react';
import {
  useGetAddressesQuery,
  useCreateAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
  type Address,
  type CreateAddressPayload,
} from '../../../services/addressApi';


const INPUT = 'w-full px-4 py-2.5 rounded-xl border border-hairline bg-surface text-sm text-slate-800 outline-none focus:border-hairline focus:ring-2 focus:ring-hairline transition placeholder:text-slate-400';
const INPUT_ERR = 'w-full px-4 py-2.5 rounded-xl border border-rose-400 bg-rose-50 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-300/30 transition';

// ── Toast ──────────────────────────────────────────────────────────────────────
interface Toast { message: string; type: 'success' | 'error' }
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
function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show };
}

// ── Address form state ─────────────────────────────────────────────────────────
interface AddressForm {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  label: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressForm = {
  fullName: '', phone: '', line1: '', line2: '',
  city: '', state: '', pincode: '', country: 'India',
  label: 'Home', isDefault: false,
};

function formToPayload(f: AddressForm): CreateAddressPayload {
  // POST /api/v1/addresses body:
  // { fullName, phone, line1, line2?, city, state, pincode, country, label?, isDefault? }
  return {
    fullName: f.fullName.trim(),
    phone: f.phone.trim(),
    line1: f.line1.trim(),
    line2: f.line2.trim() || undefined,
    city: f.city.trim(),
    state: f.state.trim(),
    pincode: f.pincode.trim(),
    country: f.country.trim() || 'India',
    label: f.label,
    isDefault: f.isDefault,
  };
}

function addressToForm(a: Address): AddressForm {
  return {
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? '',
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: a.country,
    label: a.label ?? 'Home',
    isDefault: a.isDefault,
  };
}

// ── Field validation ───────────────────────────────────────────────────────────
function validateForm(f: AddressForm): Partial<Record<keyof AddressForm, string>> {
  const e: Partial<Record<keyof AddressForm, string>> = {};
  if (!f.fullName.trim()) e.fullName = 'Full name is required.';
  if (!f.phone.trim()) e.phone = 'Phone number is required.';
  else if (!/^[+\d\s-]{7,15}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number.';
  if (!f.line1.trim()) e.line1 = 'Address line 1 is required.';
  if (!f.city.trim()) e.city = 'City is required.';
  if (!f.state.trim()) e.state = 'State is required.';
  if (!f.pincode.trim()) e.pincode = 'Pincode is required.';
  else if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = 'Enter a valid 6-digit pincode.';
  return e;
}

// ── Modal ──────────────────────────────────────────────────────────────────────
const AddressModal: React.FC<{
  mode: 'add' | 'edit';
  form: AddressForm;
  errors: Partial<Record<keyof AddressForm, string>>;
  isSubmitting: boolean;
  onClose: () => void;
  onChange: (key: keyof AddressForm, value: string | boolean) => void;
  onSubmit: () => void;
}> = ({ mode, form, errors, isSubmitting, onClose, onChange, onSubmit }) => {
  const fields: Array<{ key: keyof AddressForm; label: string; placeholder: string; required?: boolean; half?: boolean; type?: string }> = [
    { key: 'fullName', label: 'Full Name', placeholder: 'Aarohi Sharma', required: true },
    { key: 'phone', label: 'Phone Number', placeholder: '+91 98765 43210', required: true },
    { key: 'line1', label: 'Address Line 1', placeholder: 'B-12, Palm Avenue Road', required: true },
    { key: 'line2', label: 'Address Line 2', placeholder: 'Apt / Landmark (optional)' },
    { key: 'city', label: 'City', placeholder: 'Gurugram', required: true, half: true },
    { key: 'state', label: 'State', placeholder: 'Haryana', required: true, half: true },
    { key: 'pincode', label: 'Pincode', placeholder: '122001', required: true, half: true },
    { key: 'country', label: 'Country', placeholder: 'India', half: true },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-hairline bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-hairline flex items-center justify-between px-6 py-4 rounded-t-3xl">
          <div>
            <p className="eyebrow">Address Editor</p>
            <h3 className="text-lg font-serif font-semibold text-slate-900 mt-0.5">
              {mode === 'add' ? 'Add New Address' : 'Edit Address'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full border border-hairline text-slate-500 hover:bg-slate-50 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Grid fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(({ key, label, placeholder, required, half }) => (
              <div key={key} className={half ? '' : 'md:col-span-2'}>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {label} {required && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  value={form[key] as string}
                  onChange={(e) => onChange(key, e.target.value)}
                  placeholder={placeholder}
                  className={errors[key] ? INPUT_ERR : INPUT}
                />
                {errors[key] && <p className="text-xs text-rose-500 mt-1">{errors[key]}</p>}
              </div>
            ))}
          </div>

          {/* Label + isDefault */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-hairline">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Address Type</label>
              <div className="flex gap-2">
                {['Home', 'Office', 'Other'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange('label', t)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-semibold transition ${form.label === t ? 'bg-ink text-white border-ink' : 'border-hairline text-slate-700 hover:bg-slate-50'}`}
                  >
                    {t === 'Home' ? <Home className="w-3.5 h-3.5" /> : t === 'Office' ? <Briefcase className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => onChange('isDefault', !form.isDefault)}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.isDefault ? 'bg-ink' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isDefault ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Set as default</p>
                <p className="text-xs text-slate-400">Used by default at checkout</p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-6 border text-sm text-slate-700 hover:bg-slate-50 transition h-11 rounded-full border-hairline-strong bg-surface text-ink font-medium transition-colors hover:bg-hairline-soft">
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 bg-ink text-white text-sm transition disabled:opacity-60 h-11 rounded-full font-medium transition-colors hover:bg-ink-hover"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isSubmitting ? 'Saving…' : mode === 'add' ? 'Save Address' : 'Update Address'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Address Card ───────────────────────────────────────────────────────────────
const AddressCard: React.FC<{
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isSettingDefault: boolean;
}> = ({ address, onEdit, onDelete, onSetDefault, isSettingDefault }) => {
  const labelIcon = address.label === 'Home' ? <Home className="w-3.5 h-3.5" /> :
    address.label === 'Office' ? <Briefcase className="w-3.5 h-3.5" /> :
      <MapPin className="w-3.5 h-3.5" />;

  return (
    <div className={`relative rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow ${address.isDefault ? 'border-hairline ring-1 ring-hairline' : 'border-hairline'}`}>
      {/* Default badge */}
      {address.isDefault && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink/10 border border-hairline text-xs font-black text-accent">
          <Star className="w-3 h-3 fill-ink text-accent" /> DEFAULT
        </div>
      )}

      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs ${address.isDefault ? 'bg-ink' : 'bg-slate-500'}`}>
          {labelIcon}
        </div>
        <span className="text-xs font-black uppercase tracking-wider text-slate-700">{address.label ?? 'Address'}</span>
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <p className="text-sm font-bold text-slate-900">{address.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-600">{address.phone}</p>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            {[address.line1, address.line2, address.city, address.state, address.pincode, address.country]
              .filter(Boolean).join(', ')}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-hairline">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        {!address.isDefault && (
          <>
            <button
              type="button"
              onClick={onSetDefault}
              disabled={isSettingDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline text-xs font-semibold text-accent hover:bg-ink/5 transition disabled:opacity-50"
            >
              {isSettingDefault ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
              Set Default
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-50 hover:border hover:border-rose-200 transition"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Confirm delete modal ───────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  open: boolean; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}> = ({ open, isDeleting, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-sm mx-4 w-full">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-rose-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900 text-center">Delete Address?</h3>
        <p className="text-xs text-slate-500 text-center mt-1">This cannot be undone. Addresses linked to active orders cannot be deleted.</p>
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition disabled:opacity-60"
          >
            {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Skeleton ───────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="animate-pulse rounded-2xl border border-hairline bg-white p-5">
    <div className="flex gap-2 mb-3"><div className="w-7 h-7 rounded-lg bg-slate-200" /><div className="h-4 w-20 rounded-full bg-slate-200" /></div>
    <div className="space-y-2 mb-4">
      <div className="h-4 w-40 rounded-full bg-slate-200" />
      <div className="h-3 w-24 rounded-full bg-slate-100" />
      <div className="h-3 w-56 rounded-full bg-slate-100" />
    </div>
    <div className="flex gap-2 border-t border-slate-100 pt-3">
      <div className="h-7 w-14 rounded-lg bg-slate-100" />
      <div className="h-7 w-20 rounded-lg bg-slate-100" />
    </div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const SavedAddressesPage: React.FC = () => {
  const { toast, show: showToast } = useToast();

  // Modal state
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; editId?: string } | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // GET /api/v1/addresses → { data: { addresses: Address[] } }
  const { data: rawAddresses, isLoading, isError, refetch } = useGetAddressesQuery(undefined, { skip: !isAuthenticated });

  const addresses = Array.isArray(rawAddresses) ? rawAddresses : [];

  // POST /api/v1/addresses  Body: { fullName, phone, line1, line2?, city, state, pincode, country, label?, isDefault? }
  const [createAddress, { isLoading: isCreating }] = useCreateAddressMutation();

  // PATCH /api/v1/addresses/:id  Body: (same fields, all optional)
  const [updateAddress, { isLoading: isUpdating }] = useUpdateAddressMutation();

  // DELETE /api/v1/addresses/:id  (soft-delete, guard: can't delete if tied to active order)
  const [deleteAddress] = useDeleteAddressMutation();

  // PATCH /api/v1/addresses/:id/default  Body: none
  const [setDefaultAddress] = useSetDefaultAddressMutation();

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openAdd = () => { setForm(EMPTY_FORM); setFormErrors({}); setModal({ mode: 'add' }); };
  const openEdit = (a: Address) => { setForm(addressToForm(a)); setFormErrors({}); setModal({ mode: 'edit', editId: a._id }); };

  const handleChange = (key: keyof AddressForm, value: string | boolean) => {
    setForm(f => ({ ...f, [key]: value }));
    setFormErrors(e => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async () => {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    try {
      if (modal?.mode === 'add') {
        await createAddress(formToPayload(form)).unwrap();
        showToast('Address saved successfully!');
      } else if (modal?.mode === 'edit' && modal.editId) {
        await updateAddress({ id: modal.editId, data: formToPayload(form) }).unwrap();
        showToast('Address updated!');
      }
      setModal(null);
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      showToast(e?.data?.message ?? 'Failed to save address.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAddress(deleteTarget).unwrap();
      showToast('Address removed.');
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      showToast(e?.data?.message ?? 'Cannot delete — address may be used in an active order.', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setSettingDefaultId(id);
    try {
      await setDefaultAddress(id).unwrap();
      showToast('Default address updated!');
    } catch {
      showToast('Failed to set default address.', 'error');
    } finally {
      setSettingDefaultId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.1),_transparent_28%),linear-gradient(145deg,_#FFF9F1_0%,_#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <ToastBanner toast={toast} />

      <div className="mx-auto max-w-5xl space-y-8">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-8">
          <div>
            <p className="eyebrow">Delivery Preferences</p>
            <h1 className="text-4xl text-slate-900 mt-1 font-semibold">Saved Addresses</h1>
            <div className="h-0.5 w-12 bg-ink mt-3" />
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="self-start sm:self-auto flex items-center gap-2 px-5 rounded-2xl bg-ink text-white text-sm transition h-11 rounded-full font-medium transition-colors hover:bg-ink-hover"
          >
            <Plus className="w-4 h-4" /> Add New Address
          </button>
        </div>

        {/* ── Stats bar ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-hairline px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4 text-accent" />
            <span><strong>{addresses.length}</strong> saved {addresses.length === 1 ? 'destination' : 'destinations'}</span>
          </div>
          <button type="button" onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-accent transition">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[...Array(2)].map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-8 py-14 text-center">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-rose-700">Failed to load addresses.</p>
            <button type="button" onClick={() => refetch()} className="mt-3 text-xs text-rose-600 hover:underline">Retry</button>
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-ink/10 flex items-center justify-center mx-auto">
              <MapPin className="w-8 h-8 text-accent" />
            </div>
            <h2 className="font-serif text-2xl text-slate-800">No saved addresses yet</h2>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">Save your go-to delivery locations for faster checkout.</p>
            <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 mt-2 bg-ink px-8 text-white h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover">
              <Plus className="w-4 h-4" /> Create First Address
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {addresses.map((a) => (
              <AddressCard
                key={a._id}
                address={a}
                onEdit={() => openEdit(a)}
                onDelete={() => setDeleteTarget(a._id)}
                onSetDefault={() => handleSetDefault(a._id)}
                isSettingDefault={settingDefaultId === a._id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {modal && (
        <AddressModal
          mode={modal.mode}
          form={form}
          errors={formErrors}
          isSubmitting={modal.mode === 'add' ? isCreating : isUpdating}
          onClose={() => setModal(null)}
          onChange={handleChange}
          onSubmit={() => void handleSubmit()}
        />
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        isDeleting={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default SavedAddressesPage;
