import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';
import { uploadMediaFormData } from './directUpload';

export interface MediaAsset {
  _id: string;
  cloudinaryPublicId: string;
  publicId?: string; // alias for backward-compat
  url: string;
  format?: string;
  resourceType?: 'image' | 'video' | 'raw';
  mimeType?: string; // computed or alias
  folder?: string;
  tags?: string[];
  bytes?: number;
  size?: number; // alias for backward-compat
  width?: number;
  height?: number;
  referenceCount?: number;
  uploadedBy?: string | { _id: string; name?: string; email?: string } | null;
  filename?: string; // computed from publicId / url
  isDeleted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MediaParams {
  page?: number;
  limit?: number;
  folder?: string;
  tags?: string | string[];
  resourceType?: 'image' | 'video' | 'raw';
  search?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedMediaResponse {
  data: MediaAsset[];
  pagination: PaginationMeta;
}

export interface UploadMediaResponse {
  url: string;
  publicId: string;
  asset?: MediaAsset;
}

function normalizeAsset(item: any): MediaAsset {
  const publicId = item.cloudinaryPublicId || item.publicId || item._id || '';
  const url = item.url || '';
  const parts = (url || publicId).split('/');
  const filename = parts[parts.length - 1] || publicId;

  return {
    ...item,
    _id: item._id || publicId,
    cloudinaryPublicId: publicId,
    publicId,
    url,
    format: item.format || (url.includes('.') ? url.split('.').pop() : undefined),
    resourceType: item.resourceType || 'image',
    mimeType: item.mimeType || (item.resourceType === 'video' ? 'video/mp4' : 'image/jpeg'),
    folder: item.folder || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    bytes: item.bytes ?? item.size,
    size: item.bytes ?? item.size,
    width: item.width,
    height: item.height,
    referenceCount: item.referenceCount ?? 0,
    filename: item.filename || filename,
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

export const mediaApi = createApi({
  reducerPath: 'mediaApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Media'],
  endpoints: (builder) => ({
    getMedia: builder.query<PaginatedMediaResponse, MediaParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.MEDIA,
        params: params
          ? {
              ...(params.page !== undefined && { page: params.page }),
              ...(params.limit !== undefined && { limit: params.limit }),
              ...(params.folder && params.folder !== 'ALL' && { folder: params.folder }),
              ...(params.resourceType && params.resourceType !== ('ALL' as any) && { resourceType: params.resourceType }),
              ...(params.tags && { tags: Array.isArray(params.tags) ? params.tags.join(',') : params.tags }),
              ...(params.search && params.search.trim() && { search: params.search.trim() }),
            }
          : undefined,
      }),
      transformResponse: (response: unknown): PaginatedMediaResponse => {
        const fallback: PaginationMeta = { total: 0, page: 1, limit: 20, totalPages: 0 };

        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          // Shape: { data: { media: [...] }, meta: { pagination: {...} } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            const rawList = inner.media || inner.assets || inner.data;
            if (Array.isArray(rawList)) {
              const meta = r.meta as { pagination?: PaginationMeta; total?: number; page?: number; limit?: number; totalPages?: number } | undefined;
              const pagination = meta?.pagination ?? (meta?.total !== undefined ? { total: meta.total, page: meta.page || 1, limit: meta.limit || 20, totalPages: meta.totalPages || 1 } : fallback);
              return {
                data: rawList.map(normalizeAsset),
                pagination,
              };
            }
          }

          // Shape: { data: [...], pagination: {...} }
          if (Array.isArray(r.data)) {
            return {
              data: r.data.map(normalizeAsset),
              pagination: (r.pagination as PaginationMeta) ?? fallback,
            };
          }
        }

        return { data: [], pagination: fallback };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((a) => ({ type: 'Media' as const, id: a.cloudinaryPublicId || a._id })),
              'Media',
            ]
          : ['Media'],
    }),

    uploadMedia: builder.mutation<UploadMediaResponse, FormData>({
      // Direct-to-storage upload (Vercel's 4.5 MB request limit); same input and result as before.
      queryFn: async (formData) => {
        try {
          const { url, publicId } = await uploadMediaFormData(formData);
          return { data: { url, publicId } };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: error instanceof Error ? error.message : 'Upload failed.' } as const };
        }
      },
      invalidatesTags: ['Media'],
    }),

    deleteMedia: builder.mutation<{ success: boolean }, string>({
      query: (publicIdOrId) => ({
        url: ENDPOINTS.ADMIN.MEDIA_DETAIL(encodeURIComponent(publicIdOrId)),
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Media', id }, 'Media'],
    }),
  }),
});

export const { useGetMediaQuery, useUploadMediaMutation, useDeleteMediaMutation } = mediaApi;
export default mediaApi;
