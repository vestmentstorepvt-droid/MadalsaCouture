import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface Address {
  _id: string;
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export type CreateAddressPayload = Omit<Address, '_id' | 'isDefault'> & { isDefault?: boolean };
export type UpdateAddressPayload = Partial<CreateAddressPayload>;

function normalizeAddress(item: any): Address {
  if (!item || typeof item !== 'object') return item;
  return {
    _id: String(item._id || ''),
    label: item.label || 'Home',
    fullName: item.fullName || item.name || '',
    phone: item.phone || '',
    line1: item.line1 || item.addressLine || '',
    line2: item.line2 || '',
    city: item.city || '',
    state: item.state || '',
    pincode: item.pincode || '',
    country: item.country || 'India',
    isDefault: Boolean(item.isDefault),
  };
}

export const addressApi = createApi({
  reducerPath: 'addressApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Addresses'],
  endpoints: (builder) => ({
    getAddresses: builder.query<Address[], void>({
      query: () => ENDPOINTS.ADDRESSES,
      transformResponse: (response: unknown): Address[] => {
        let rawList: any[] = [];

        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.addresses)) rawList = inner.addresses;
            else if (Array.isArray(inner.data)) rawList = inner.data;
          } else if (Array.isArray(r.data)) {
            rawList = r.data;
          } else if (Array.isArray(r.addresses)) {
            rawList = r.addresses;
          }
        } else if (Array.isArray(response)) {
          rawList = response;
        }

        return rawList.map(normalizeAddress);
      },
      providesTags: ['Addresses'],
    }),

    createAddress: builder.mutation<Address, CreateAddressPayload>({
      query: (body) => {
        let cleanedPhone = (body.phone || '').replace(/\D/g, '');
        if (cleanedPhone.length > 10) cleanedPhone = cleanedPhone.slice(-10);
        const cleanedPincode = (body.pincode || '').replace(/\D/g, '').slice(0, 6);

        return {
          url: ENDPOINTS.ADDRESSES,
          method: 'POST',
          body: {
            name: body.fullName || (body as any).name,
            addressLine: body.line1 || (body as any).addressLine,
            line2: body.line2 || undefined,
            city: body.city,
            state: body.state,
            pincode: cleanedPincode,
            country: body.country || 'India',
            phone: cleanedPhone,
            isDefault: body.isDefault,
            label: body.label,
          },
        };
      },
      transformResponse: (response: unknown): Address => {
        let item: any = response;
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.address) item = inner.address;
            else if (inner.data) item = inner.data;
          } else if (r.address) {
            item = r.address;
          }
        }
        return normalizeAddress(item);
      },
      invalidatesTags: ['Addresses'],
    }),

    updateAddress: builder.mutation<Address, { id: string; data: UpdateAddressPayload }>({
      query: ({ id, data }) => {
        let cleanedPhone = data.phone ? data.phone.replace(/\D/g, '') : undefined;
        if (cleanedPhone && cleanedPhone.length > 10) cleanedPhone = cleanedPhone.slice(-10);
        const cleanedPincode = data.pincode ? data.pincode.replace(/\D/g, '').slice(0, 6) : undefined;

        const payload: Record<string, unknown> = {};
        if (data.fullName || (data as any).name) payload.name = data.fullName || (data as any).name;
        if (data.line1 || (data as any).addressLine) payload.addressLine = data.line1 || (data as any).addressLine;
        if (data.line2) payload.line2 = data.line2;
        if (data.label) payload.label = data.label;
        if (data.city) payload.city = data.city;
        if (data.state) payload.state = data.state;
        if (cleanedPincode) payload.pincode = cleanedPincode;
        if (data.country) payload.country = data.country;
        if (cleanedPhone) payload.phone = cleanedPhone;
        if (data.isDefault !== undefined) payload.isDefault = data.isDefault;

        return {
          url: ENDPOINTS.ADDRESS_DETAIL(id),
          method: 'PATCH',
          body: payload,
        };
      },
      transformResponse: (response: unknown): Address => {
        let item: any = response;
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.address) item = inner.address;
            else if (inner.data) item = inner.data;
          } else if (r.address) {
            item = r.address;
          }
        }
        return normalizeAddress(item);
      },
      invalidatesTags: ['Addresses'],
    }),

    deleteAddress: builder.mutation<void, string>({
      query: (id) => ({
        url: ENDPOINTS.ADDRESS_DETAIL(id),
        method: 'DELETE',
      }),
      invalidatesTags: ['Addresses'],
    }),

    setDefaultAddress: builder.mutation<Address, string>({
      query: (id) => ({
        url: ENDPOINTS.ADDRESS_DEFAULT(id),
        method: 'PATCH',
      }),
      transformResponse: (response: unknown): Address => {
        let item: any = response;
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.address) item = inner.address;
          } else if (r.address) {
            item = r.address;
          }
        }
        return normalizeAddress(item);
      },
      invalidatesTags: ['Addresses'],
    }),

  }),
});

export const {
  useGetAddressesQuery,
  useCreateAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
} = addressApi;
