import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Tag,
  Percent,
  IndianRupee,
  CalendarDays,
  Hash,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { useCreateCouponMutation } from '../../services/couponApi';
import type { CreateCouponPayload } from '../../services/couponApi';
import { AppButton } from '../../components/ui/button/AppButton';
import { endOfDayIso, startOfDayIso } from '../../utils/dateTime';

interface FormState {
  code: string;
  type: 'percentage' | 'flat' | 'free_shipping';
  value: string;
  minOrderValue: string;
  startDate: string;
  endDate: string;
  usageLimitTotal: string;
  usageLimitPerCustomer: string;
  isActive: boolean;
}

const initialForm: FormState = {
  code: '',
  type: 'percentage',
  value: '',
  minOrderValue: '',
  startDate: '',
  endDate: '',
  usageLimitTotal: '',
  usageLimitPerCustomer: '1',
  isActive: true,
};

export const CreateCoupon: React.FC = () => {
  const navigate = useNavigate();
  const [createCoupon, { isLoading }] = useCreateCouponMutation();
  const [form, setForm] = useState<FormState>({ ...initialForm });
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.code.trim()) {
      errs.code = 'Coupon code is required';
    }

    if (form.type === 'percentage') {
      const numVal = Number(form.value);
      if (!form.value || isNaN(numVal)) {
        errs.value = 'Percentage discount value is required';
      } else if (numVal <= 0 || numVal > 100) {
        errs.value = 'Percentage must be between 1% and 100%';
      }
    } else if (form.type === 'flat') {
      const numVal = Number(form.value);
      if (!form.value || isNaN(numVal) || numVal <= 0) {
        errs.value = 'Flat discount amount must be greater than 0';
      }
    }

    if (form.minOrderValue && Number(form.minOrderValue) < 0) {
      errs.minOrderValue = 'Minimum order value cannot be negative';
    }

    if (form.usageLimitTotal && (Number(form.usageLimitTotal) < 1 || !Number.isInteger(Number(form.usageLimitTotal)))) {
      errs.usageLimitTotal = 'Total usage limit must be a whole number of at least 1';
    }

    if (form.usageLimitPerCustomer && (Number(form.usageLimitPerCustomer) < 1 || !Number.isInteger(Number(form.usageLimitPerCustomer)))) {
      errs.usageLimitPerCustomer = 'Per-customer usage limit must be a whole number of at least 1';
    }

    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      errs.endDate = 'End date cannot be earlier than start date';
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    const payload: CreateCouponPayload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      ...(form.type !== 'free_shipping' && { value: Number(form.value) }),
      ...(form.minOrderValue ? { minOrderValue: Number(form.minOrderValue) } : { minOrderValue: 0 }),
      ...(form.startDate ? { startDate: startOfDayIso(form.startDate) } : {}),
      ...(form.endDate ? { endDate: endOfDayIso(form.endDate) } : {}),
      ...(form.usageLimitTotal ? { usageLimitTotal: Number(form.usageLimitTotal) } : {}),
      ...(form.usageLimitPerCustomer ? { usageLimitPerCustomer: Number(form.usageLimitPerCustomer) } : {}),
      isActive: form.isActive,
    };

    try {
      await createCoupon(payload).unwrap();
      setSuccess(true);
      setTimeout(() => navigate('/admin/coupons'), 1000);
    } catch (err: unknown) {
      const apiErr = err as {
        status?: number;
        data?: {
          error?: { code?: string; message?: string; details?: Array<{ field: string; message: string }> };
          message?: string;
        };
      };

      if (apiErr?.data?.error?.details && Array.isArray(apiErr.data.error.details)) {
        const fieldErrs: Record<string, string> = {};
        apiErr.data.error.details.forEach((d) => {
          fieldErrs[d.field] = d.message;
        });
        setValidationErrors(fieldErrs);
        setError('Please check the validation errors below.');
      } else if (apiErr?.status === 409 || apiErr?.data?.error?.code === 'CONFLICT') {
        setError(`A coupon with code "${form.code.trim().toUpperCase()}" already exists. Please choose a different code.`);
      } else {
        setError(apiErr?.data?.error?.message || apiErr?.data?.message || 'Failed to create coupon.');
      }
    }
  };

  const inputClass = (hasErr?: boolean) =>
    `w-full px-4 py-3 rounded-xl border ${
      hasErr ? 'border-rose-400 focus:ring-rose-200 focus:border-rose-500' : 'border-slate-200 focus:ring-[#E85D88]/20 focus:border-[#E85D88]'
    } bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400`;

  const labelClass = 'flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1.5';

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate('/admin/coupons')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#E85D88] transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Coupons
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Create New Coupon</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure discount rules, order thresholds, and validity dates for your campaign.
          </p>
        </div>

        {/* Success Toast */}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Coupon created successfully! Redirecting to coupon list...</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Row 1: Code & Discount Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>
                <Tag className="w-4 h-4 text-[#E85D88]" /> Coupon Code *
              </label>
              <input
                type="text"
                className={inputClass(Boolean(validationErrors.code))}
                placeholder="e.g. FESTIVE20"
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                autoFocus
              />
              {validationErrors.code ? (
                <p className="text-xs text-rose-500 mt-1">{validationErrors.code}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Unique uppercase discount promo code.</p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                <Percent className="w-4 h-4 text-[#E85D88]" /> Discount Type *
              </label>
              <select
                className={inputClass(Boolean(validationErrors.type))}
                value={form.type}
                onChange={(e) => set('type', e.target.value as 'percentage' | 'flat' | 'free_shipping')}
              >
                <option value="percentage">Percentage Discount (%)</option>
                <option value="flat">Flat Amount (₹)</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
            </div>
          </div>

          {/* Row 2: Discount Value & Min Order Value */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>
                {form.type === 'percentage' ? (
                  <Percent className="w-4 h-4 text-[#E85D88]" />
                ) : (
                  <IndianRupee className="w-4 h-4 text-[#E85D88]" />
                )}
                Discount Value {form.type !== 'free_shipping' ? '*' : ''}
              </label>
              <input
                type="number"
                className={inputClass(Boolean(validationErrors.value))}
                placeholder={form.type === 'percentage' ? 'e.g. 20 (for 20%)' : form.type === 'flat' ? 'e.g. 500 (for ₹500)' : 'N/A'}
                value={form.value}
                onChange={(e) => set('value', e.target.value)}
                min={0}
                max={form.type === 'percentage' ? 100 : undefined}
                disabled={form.type === 'free_shipping'}
              />
              {validationErrors.value ? (
                <p className="text-xs text-rose-500 mt-1">{validationErrors.value}</p>
              ) : form.type === 'free_shipping' ? (
                <p className="text-xs text-slate-400 mt-1">Free shipping coupons waive delivery charge automatically.</p>
              ) : null}
            </div>

            <div>
              <label className={labelClass}>
                <IndianRupee className="w-4 h-4 text-[#E85D88]" /> Minimum Order Value (₹)
              </label>
              <input
                type="number"
                className={inputClass(Boolean(validationErrors.minOrderValue))}
                placeholder="e.g. 999 (0 for no minimum)"
                value={form.minOrderValue}
                onChange={(e) => set('minOrderValue', e.target.value)}
                min={0}
              />
              {validationErrors.minOrderValue && (
                <p className="text-xs text-rose-500 mt-1">{validationErrors.minOrderValue}</p>
              )}
            </div>
          </div>

          {/* Row 3: Validity Start & End Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>
                <CalendarDays className="w-4 h-4 text-[#E85D88]" /> Start Date (Optional)
              </label>
              <input
                type="date"
                className={inputClass(Boolean(validationErrors.startDate))}
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
              {validationErrors.startDate && (
                <p className="text-xs text-rose-500 mt-1">{validationErrors.startDate}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                <CalendarDays className="w-4 h-4 text-[#E85D88]" /> End / Expiry Date (Optional)
              </label>
              <input
                type="date"
                className={inputClass(Boolean(validationErrors.endDate))}
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
              {validationErrors.endDate && (
                <p className="text-xs text-rose-500 mt-1">{validationErrors.endDate}</p>
              )}
            </div>
          </div>

          {/* Row 4: Usage Limits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>
                <Hash className="w-4 h-4 text-[#E85D88]" /> Total Usage Limit (Optional)
              </label>
              <input
                type="number"
                className={inputClass(Boolean(validationErrors.usageLimitTotal))}
                placeholder="e.g. 100 (leave blank for unlimited)"
                value={form.usageLimitTotal}
                onChange={(e) => set('usageLimitTotal', e.target.value)}
                min={1}
              />
              {validationErrors.usageLimitTotal ? (
                <p className="text-xs text-rose-500 mt-1">{validationErrors.usageLimitTotal}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Maximum global redemptions across all customers.</p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                <Users className="w-4 h-4 text-[#E85D88]" /> Limit Per Customer (Optional)
              </label>
              <input
                type="number"
                className={inputClass(Boolean(validationErrors.usageLimitPerCustomer))}
                placeholder="e.g. 1"
                value={form.usageLimitPerCustomer}
                onChange={(e) => set('usageLimitPerCustomer', e.target.value)}
                min={1}
              />
              {validationErrors.usageLimitPerCustomer ? (
                <p className="text-xs text-rose-500 mt-1">{validationErrors.usageLimitPerCustomer}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Maximum times a single user can use this coupon.</p>
              )}
            </div>
          </div>

          {/* Row 5: Initial Status */}
          <div className="max-w-xs">
            <label className={labelClass}>
              <ShieldCheck className="w-4 h-4 text-[#E85D88]" /> Initial Status
            </label>
            <select
              className={inputClass()}
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => set('isActive', e.target.value === 'active')}
            >
              <option value="active">Active (Available for checkout)</option>
              <option value="inactive">Inactive (Disabled)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/admin/coupons')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
              disabled={isLoading}
            >
              Cancel
            </button>
            <AppButton type="submit" variant="primary" size="md" isLoading={isLoading}>
              Create Coupon
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCoupon;
