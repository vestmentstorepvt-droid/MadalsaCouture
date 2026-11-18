import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface AdminTag {
  _id: string;
  name: string;
  slug: string;
  isDeleted: boolean;
  createdAt: string;
}

export const tagsApi = createApi({
  reducerPath: 'tagsApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Tags'],
  endpoints: (builder) => ({
    getAdminTags: builder.query<{ data: AdminTag[]; meta: any }, { search?: string; page?: number; limit?: number }>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.TAGS,
        params,
      }),
      providesTags: ['Tags'],
    }),

    getPublicTags: builder.query<{ data: AdminTag[] }, void>({
      query: () => '/tags', // Assuming public tags endpoint from tagController
      providesTags: ['Tags'],
    }),

    createTag: builder.mutation<{ tag: AdminTag }, { name: string }>({
      query: (body) => ({
        url: ENDPOINTS.ADMIN.TAGS,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Tags'],
    }),

    deleteTag: builder.mutation<{ tag: AdminTag }, string>({
      query: (id) => ({
        url: `${ENDPOINTS.ADMIN.TAGS}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tags'],
    }),
  }),
});

export const {
  useGetAdminTagsQuery,
  useGetPublicTagsQuery,
  useCreateTagMutation,
  useDeleteTagMutation,
} = tagsApi;
