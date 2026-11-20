import React, { useState, type FormEvent } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { Briefcase, Home, Loader2, MapPin, Plus } from 'lucide-react';
import {
  useGetAddressesQuery,
  useCreateAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
  type Address,
  type CreateAddressPayload,
} from '../../../services/addressApi';
import {
  AccountHeading,
  Dialog,
  Panel,
  btnPrimary,
  btnSecondary,
  fieldClass,
  fieldErrorClass,
  labelClass,
  useAccountToast,
} from '../../../components/features/account/AccountUI';

// ── Form state ────────────────────────────────────────────────────────────────
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
type FormErrors = Partial<Record<keyof AddressForm, string>>;

const EMPTY_FORM: AddressForm = {
  fullName: '', phone: '', line1: '', line2: '',
  city: '', state: '', pincode: '', country: 'India',
  label: 'Home', isDefault: false,
};

const LABELS = [
  { value: 'Home', icon: Home },
  { value: 'Office', icon: Briefcase },
  { value: 'Other', icon: MapPin },
] as const;

function formToPayload(f: AddressForm): CreateAddressPayload {
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

function validateForm(f: AddressForm): FormErrors {
  const e: FormErrors = {};
  if (!f.fullName.trim()) e.fullName = 'Enter the name of the person receiving the parcel.';
  if (!f.phone.trim()) e.phone = 'Enter a phone number for the courier.';
  else if (!/^[+\d\s-]{7,15}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number.';
  if (!f.line1.trim()) e.line1 = 'Enter the house number and street.';
  if (!f.city.trim()) e.city = 'Enter the city.';
  if (!f.state.trim()) e.state = 'Enter the state.';
  if (!f.pincode.trim()) e.pincode = 'Enter the pincode.';
  else if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = 'Pincodes have 6 digits.';
  return e;
}

const apiMessage = (err: unknown) => (err as { data?: { message?: string; error?: { message?: string } } })?.data?.error?.message
  || (err as { data?: { message?: string } })?.data?.message;

// ── Address editor ────────────────────────────────────────────────────────────
const AddressDialog: React.FC<{
  mode: 'add' | 'edit';
  form: AddressForm;
  errors: FormErrors;
  isSubmitting: boolean;
  onClose: () => void;
  onChange: (key: keyof AddressForm, value: string | boolean) => void;
  onSubmit: () => void;
}> = ({ mode, form, errors, isSubmitting, onClose, onChange, onSubmit }) => {
  const field = (
    key: keyof AddressForm,
    label: string,
    opts: { placeholder?: string; autoComplete?: string; inputMode?: 'numeric' | 'tel'; optional?: boolean; span?: boolean } = {},
  ) => (
    <div className={opts.span ? 'sm:col-span-2' : ''}>
      <label htmlFor={`addr-${key}`} className={labelClass}>
        {label}
        {opts.optional ? <span className="font-normal text-mute"> (optional)</span> : null}
      </label>
      <input
        id={`addr-${key}`}
        value={form[key] as string}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete}
        inputMode={opts.inputMode}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `addr-${key}-error` : undefined}
        className={`${fieldClass} ${errors[key] ? fieldErrorClass : ''}`}
      />
      {errors[key] ? (
        <p id={`addr-${key}-error`} className="mt-1 text-xs text-rose-700">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Dialog
      title={mode === 'add' ? 'Add an address' : 'Edit address'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form="address-form" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Saving' : 'Save address'}
          </button>
        </>
      }
    >
      <form id="address-form" onSubmit={submit} noValidate className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {field('fullName', 'Full name', { autoComplete: 'name' })}
          {field('phone', 'Phone number', { autoComplete: 'tel', inputMode: 'tel', placeholder: '10-digit mobile number' })}
          {field('line1', 'House number and street', { autoComplete: 'address-line1', span: true })}
          {field('line2', 'Area or landmark', { autoComplete: 'address-line2', optional: true, span: true })}
          {field('pincode', 'Pincode', { autoComplete: 'postal-code', inputMode: 'numeric' })}
          {field('city', 'City', { autoComplete: 'address-level2' })}
          {field('state', 'State', { autoComplete: 'address-level1' })}
          {field('country', 'Country', { autoComplete: 'country-name' })}
        </div>

        <fieldset>
          <legend className={labelClass}>Save as</legend>
          <div className="flex flex-wrap gap-2">
            {LABELS.map(({ value, icon: Icon }) => {
              const active = form.label === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange('label', value)}
                  aria-pressed={active}
                  className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                    active ? 'border-ink bg-ink text-white' : 'border-hairline-strong text-ink hover:bg-hairline-soft'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => onChange('isDefault', e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-hairline-strong accent-ink"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Make this my default address</span>
            <span className="block text-xs text-mute">We’ll pick it first at checkout.</span>
          </span>
        </label>
      </form>
    </Dialog>
  );
};

// ── Address card ──────────────────────────────────────────────────────────────
const AddressCard: React.FC<{
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isSettingDefault: boolean;
}> = ({ address, onEdit, onDelete, onSetDefault, isSettingDefault }) => {
  const Icon = LABELS.find((l) => l.value === address.label)?.icon ?? MapPin;
  const actionClass = 'text-sm font-medium text-ink underline-offset-4 hover:underline disabled:opacity-50';
  return (
    <li
      className={`flex flex-col rounded-2xl border bg-surface p-5 ${
        address.isDefault ? 'border-ink' : 'border-hairline'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <Icon className="h-4 w-4 text-mute" />
          {address.label ?? 'Address'}
        </span>
        {address.isDefault ? (
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-white">Default</span>
        ) : null}
      </div>

      <address className="mt-3 flex-1 text-sm not-italic leading-6 text-body">
        <span className="block font-medium text-ink">{address.fullName}</span>
        {[address.line1, address.line2].filter(Boolean).join(', ')}
        <br />
        {address.city}, {address.state} {address.pincode}
        {address.country && address.country !== 'India' ? `, ${address.country}` : ''}
        <span className="mt-1 block tabular-nums text-mute">{address.phone}</span>
      </address>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-4">
        <button type="button" onClick={onEdit} className={actionClass}>
          Edit
        </button>
        {!address.isDefault ? (
          <>
            <button type="button" onClick={onSetDefault} disabled={isSettingDefault} className={`${actionClass} inline-flex items-center gap-1.5`}>
              {isSettingDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Set as default
            </button>
            <button type="button" onClick={onDelete} className="ml-auto text-sm font-medium text-rose-700 underline-offset-4 hover:underline">
              Remove
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
};

const Skeleton = () => (
  <ul className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
    {[0, 1].map((i) => (
      <li key={i} className="h-52 animate-pulse rounded-2xl border border-hairline bg-surface" />
    ))}
  </ul>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const SavedAddressesPage: React.FC = () => {
  const { show: toast, node: toastNode } = useAccountToast();

  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; editId?: string } | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { data: rawAddresses, isLoading, isError, refetch } = useGetAddressesQuery(undefined, { skip: !isAuthenticated });
  const addresses = Array.isArray(rawAddresses)
    ? [...rawAddresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    : [];

  const [createAddress, { isLoading: isCreating }] = useCreateAddressMutation();
  const [updateAddress, { isLoading: isUpdating }] = useUpdateAddressMutation();
  const [deleteAddress] = useDeleteAddressMutation();
  const [setDefaultAddress] = useSetDefaultAddressMutation();

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, isDefault: addresses.length === 0 });
    setFormErrors({});
    setModal({ mode: 'add' });
  };
  const openEdit = (a: Address) => {
    setForm(addressToForm(a));
    setFormErrors({});
    setModal({ mode: 'edit', editId: a._id });
  };

  const handleChange = (key: keyof AddressForm, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async () => {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      document.getElementById(`addr-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    try {
      if (modal?.mode === 'add') {
        await createAddress(formToPayload(form)).unwrap();
        toast('Address saved.');
      } else if (modal?.mode === 'edit' && modal.editId) {
        await updateAddress({ id: modal.editId, data: formToPayload(form) }).unwrap();
        toast('Address updated.');
      }
      setModal(null);
    } catch (err) {
      toast(apiMessage(err) ?? 'Could not save the address. Please try again.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAddress(deleteTarget._id).unwrap();
      toast('Address removed.');
    } catch (err) {
      toast(apiMessage(err) ?? 'This address is on an order that hasn’t been delivered yet, so it can’t be removed.', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setSettingDefaultId(id);
    try {
      await setDefaultAddress(id).unwrap();
      toast('Default address updated.');
    } catch {
      toast('Could not change the default address. Please try again.', 'error');
    } finally {
      setSettingDefaultId(null);
    }
  };

  return (
    <>
      <AccountHeading
        title="Saved addresses"
        description="Where we deliver your orders."
        action={
          addresses.length > 0 ? (
            <button type="button" onClick={openAdd} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Add address
            </button>
          ) : null
        }
      />

      {isLoading ? (
        <Skeleton />
      ) : isError ? (
        <Panel>
          <div className="py-8 text-center">
            <p className="text-sm text-body">We couldn’t load your addresses.</p>
            <button type="button" onClick={() => void refetch()} className={`${btnSecondary} mt-4`}>
              Try again
            </button>
          </div>
        </Panel>
      ) : addresses.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hairline-soft text-ink">
              <MapPin className="h-6 w-6" />
            </span>
            <p className="mt-4 font-display text-2xl text-ink">No saved addresses</p>
            <p className="mt-1 max-w-xs text-sm text-mute">Add one now and checkout takes a single tap next time.</p>
            <button type="button" onClick={openAdd} className={`${btnPrimary} mt-6`}>
              <Plus className="h-4 w-4" />
              Add address
            </button>
          </div>
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <AddressCard
              key={a._id}
              address={a}
              onEdit={() => openEdit(a)}
              onDelete={() => setDeleteTarget(a)}
              onSetDefault={() => void handleSetDefault(a._id)}
              isSettingDefault={settingDefaultId === a._id}
            />
          ))}
          <li>
            <button
              type="button"
              onClick={openAdd}
              className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline-strong text-sm font-medium text-body transition-colors hover:border-ink hover:text-ink"
            >
              <Plus className="h-5 w-5" />
              Add another address
            </button>
          </li>
        </ul>
      )}

      {modal ? (
        <AddressDialog
          mode={modal.mode}
          form={form}
          errors={formErrors}
          isSubmitting={modal.mode === 'add' ? isCreating : isUpdating}
          onClose={() => setModal(null)}
          onChange={handleChange}
          onSubmit={() => void handleSubmit()}
        />
      ) : null}

      {deleteTarget ? (
        <Dialog
          title="Remove this address?"
          size="sm"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" onClick={() => setDeleteTarget(null)} className={btnSecondary}>
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className={`${btnPrimary} bg-rose-700 hover:bg-rose-800`}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isDeleting ? 'Removing' : 'Remove'}
              </button>
            </>
          }
        >
          <p className="text-sm text-body">
            {deleteTarget.label ?? 'This address'} for {deleteTarget.fullName}, {deleteTarget.city}. Orders already placed keep their
            delivery address.
          </p>
        </Dialog>
      ) : null}
      {toastNode}
    </>
  );
};

export default SavedAddressesPage;
