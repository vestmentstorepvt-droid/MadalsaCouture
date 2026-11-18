import { createApi } from '@reduxjs/toolkit/query/react';
import { uploadReviewFile, type UploadedRef } from './directUpload';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommentUser {
  _id: string | null;
  name: string;
}

export interface CommentMedia {
  url: string;
  type: 'image' | 'video';
}

export interface Comment {
  _id: string;
  body: string;
  rating: number | null;
  user: CommentUser | null;
  isGuest?: boolean;
  media?: CommentMedia[];
  createdAt: string;
}

export interface CommentsListResponse {
  comments: Comment[];
  avgRating: number | null;
  ratingCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCommentPayload {
  productId: string;
  body: string;
  rating?: number | null;
  /** Required only for guests (not signed in) */
  name?: string;
  email?: string;
  /** Optional images/videos */
  files?: File[];
}

// ── API slice ────────────────────────────────────────────────────────────────

export const commentsApi = createApi({
  reducerPath: 'commentsApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Comments'],

  endpoints: (builder) => ({
    // GET /api/v1/products/:productId/comments?page=&limit=
    getComments: builder.query<CommentsListResponse, { productId: string; page?: number; limit?: number }>({
      query: ({ productId, page = 1, limit = 10 }) => ({
        url: ENDPOINTS.COMMENTS(productId),
        params: { page, limit },
      }),
      transformResponse: (response: unknown): CommentsListResponse => {
        const r = response as Record<string, unknown>;
        const data = (r?.data ?? {}) as Record<string, unknown>;
        const meta = (r?.meta ?? {}) as Record<string, unknown>;

        return {
          comments: Array.isArray(data.comments) ? data.comments as Comment[] : [],
          avgRating: typeof data.avgRating === 'number' ? data.avgRating : null,
          ratingCount: typeof data.ratingCount === 'number' ? data.ratingCount : 0,
          distribution: (data.distribution as CommentsListResponse['distribution']) ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          pagination: (meta.pagination as CommentsListResponse['pagination']) ?? {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        };
      },
      providesTags: (_result, _error, { productId }) => [{ type: 'Comments', id: productId }],
    }),

    // POST /api/v1/products/:productId/comments
    createComment: builder.mutation<Comment, CreateCommentPayload>({
      // Review photos/videos go straight to storage first (Vercel's 4.5 MB request
      // limit); the review itself is the same POST, listing them in `mediaUploads`.
      queryFn: async ({ productId, body, rating, name, email, files }, _api, _extra, baseQuery) => {
        let mediaUploads: UploadedRef[] = [];
        try {
          mediaUploads = await Promise.all((files ?? []).map((f) => uploadReviewFile(f)));
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: error instanceof Error ? error.message : 'Media upload failed.' } as const };
        }
        const fd = new FormData();
        fd.append('body', body);
        if (rating) fd.append('rating', String(rating));
        if (name) fd.append('name', name);
        if (email) fd.append('email', email);
        if (mediaUploads.length) fd.append('mediaUploads', JSON.stringify(mediaUploads));
        const result = await baseQuery({ url: ENDPOINTS.COMMENTS(productId), method: 'POST', body: fd });
        if (result.error) return { error: result.error };
        const r = result.data as Record<string, unknown>;
        const data = (r?.data ?? {}) as Record<string, unknown>;
        return { data: (data.comment ?? data) as Comment };
      },
      invalidatesTags: (_result, _error, { productId }) => [{ type: 'Comments', id: productId }],
    }),

    // DELETE /api/v1/products/:productId/comments
    deleteComment: builder.mutation<void, string>({
      query: (productId) => ({
        url: ENDPOINTS.COMMENTS(productId),
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, productId) => [{ type: 'Comments', id: productId }],
    }),
  }),
});

export const {
  useGetCommentsQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
} = commentsApi;
