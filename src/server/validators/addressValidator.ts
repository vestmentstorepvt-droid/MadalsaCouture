// @ts-nocheck — ported from the Express backend (validators/addressValidator.js); logic unchanged.
import * as __imp0 from "zod";

const { z } = __imp0;

// ---------------------------------------------------------------------------
// 1. createAddressSchema — POST /api/v1/addresses
// ---------------------------------------------------------------------------

function preprocessAddressData(data) {
  if (!data || typeof data !== 'object') return data;
  const rawName = data.name || data.fullName || '';
  const rawLine = data.addressLine || data.line1 || '';
  const line2 = data.line2 ? `, ${data.line2}` : '';
  const fullAddressLine = rawLine ? `${rawLine}${line2}` : '';

  let phone = String(data.phone || '').replace(/\D/g, '');
  if (phone.length > 10) phone = phone.slice(-10);

  let pincode = String(data.pincode || '').replace(/\D/g, '');

  return {
    ...data,
    name: rawName || data.name,
    addressLine: fullAddressLine || data.addressLine,
    phone: phone || data.phone,
    pincode: pincode || data.pincode,
  };
}

const createAddressSchema = z.preprocess(preprocessAddressData, z.object({
  name: z.string({ required_error: 'name is required' }).min(1, 'name is required'),
  addressLine: z.string({ required_error: 'addressLine is required' }).min(1, 'addressLine is required'),
  city: z.string({ required_error: 'city is required' }).min(1, 'city is required'),
  state: z.string({ required_error: 'state is required' }).min(1, 'state is required'),
  pincode: z
    .string({ required_error: 'pincode is required' })
    .regex(/^\d{6}$/, 'pincode must be a 6-digit number'),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
  country: z.string().optional().default('India'),
  phone: z
    .string({ required_error: 'phone is required' })
    .regex(/^\d{10}$/, 'phone must be a 10-digit number'),
  deliveryPhone: z.string().optional()
}));

// ---------------------------------------------------------------------------
// 2. updateAddressSchema — PATCH /api/v1/addresses/:id
// ---------------------------------------------------------------------------

const updateAddressSchema = z.preprocess(preprocessAddressData, z.object({
  name: z.string().min(1, 'name cannot be empty').optional(),
  addressLine: z.string().min(1, 'addressLine cannot be empty').optional(),
  city: z.string().min(1, 'city cannot be empty').optional(),
  state: z.string().min(1, 'state cannot be empty').optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'pincode must be a 6-digit number')
    .optional(),
  country: z.string().optional(),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'phone must be a 10-digit number')
    .optional(),
  deliveryPhone: z.string().optional()
}));


// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const __exports: any = { createAddressSchema, updateAddressSchema };

export default __exports;
