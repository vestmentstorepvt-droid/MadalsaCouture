import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';
import type { AdminProduct } from './adminProductsApi';

export interface CollectionRule {
  field: string;
  operator: string;
  value: string;
}

export interface Collection {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  type: 'manual' | 'rule-based';
  status: 'active' | 'inactive';
  image?: string;
  rules?: CollectionRule[];
  matchType?: 'any' | 'all';
  productIds?: string[];
  products?: AdminProduct[];
  createdAt: string;
  updatedAt: string;
}

export const collectionsApi = createApi({
  reducerPath: 'collectionsApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Collections', 'CollectionProducts'],
  endpoints: (builder) => ({
    // Admin Endpoints
    getAdminCollections: builder.query<{ data: Collection[]; meta: any }, { search?: string; type?: string; page?: number; limit?: number }>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.COLLECTIONS,
        params,
      }),
      providesTags: ['Collections'],
    }),

    getAdminCollectionById: builder.query<{ collection: Collection }, string>({
      query: (id) => `${ENDPOINTS.ADMIN.COLLECTIONS}/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Collections', id }],
    }),

    createCollection: builder.mutation<{ collection: Collection }, Partial<Collection>>({
      query: (body) => ({
        url: ENDPOINTS.ADMIN.COLLECTIONS,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Collections'],
    }),

    updateCollection: builder.mutation<{ collection: Collection }, { id: string; data: Partial<Collection> }>({
      query: ({ id, data }) => ({
        url: `${ENDPOINTS.ADMIN.COLLECTIONS}/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Collections', id }, 'Collections'],
    }),

    deleteCollection: builder.mutation<{ collection: Collection }, string>({
      query: (id) => ({
        url: `${ENDPOINTS.ADMIN.COLLECTIONS}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Collections'],
    }),

    // Public Endpoints
    getPublicCollections: builder.query<{ collections: Collection[] }, void>({
      query: () => '/collections', // Public endpoint
      providesTags: ['Collections'],
    }),

    getPublicCollectionBySlug: builder.query<{ collection: Collection; products: AdminProduct[] }, string>({
      query: (slug) => `/collections/${slug}`, // Public endpoint
      providesTags: (_result, _error, slug) => [{ type: 'CollectionProducts', id: slug }],
      transformResponse: (response: any) => response.data,
    }),
  }),
});

export const {
  useGetAdminCollectionsQuery,
  useGetAdminCollectionByIdQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  useGetPublicCollectionsQuery,
  useGetPublicCollectionBySlugQuery,
} = collectionsApi;
