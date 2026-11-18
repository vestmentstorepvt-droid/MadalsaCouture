import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';
import type {
  CmsHero,
  CmsAnnouncementBar,
  CmsCollectionItem,
  CmsBanner,
  CmsVideoCard,
  CmsAboutUs,
  CmsContact,
  CmsStaticPage,
} from './cmsApi';

// Re-export shared CMS types so consumers only need one import
export type {
  CmsHero,
  CmsAnnouncementBar,
  CmsCollectionItem,
  CmsBanner,
  CmsVideoCard,
  CmsAboutUs,
  CmsContact,
  CmsStaticPage,
};

// ── Admin-only types ──────────────────────────────────────────────────────────

export interface CmsFeaturedSection {
  _id: string;
  title: string;
  subtitle?: string | null;
  productIds?: string[];
  displayOrder?: number;
  status: 'active' | 'inactive';
  startsAt?: string | null;
  endsAt?: string | null;
}

export type CmsVideoCardInput = Omit<CmsVideoCard, '_id'>;

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ── Internal API response envelope ───────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ── Helper: unwrap ApiResponse or pass-through ────────────────────────────────

function unwrap<T>(response: unknown): T {
  if (response !== null && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    // Shape: { data: { <key>: value } }
    if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
      const inner = r.data as Record<string, unknown>;
      // If it looks like a plain data object (has known CMS fields), return it directly
      const innerKeys = Object.keys(inner);
      if (innerKeys.length === 1) {
        // Single key wrap like { hero: {...} } — unwrap the value
        return inner[innerKeys[0]] as T;
      }
      return inner as T;
    }
    // Shape: { data: value } where data is the direct payload
    if ('data' in r && !('success' in r)) {
      return r.data as T;
    }
    // Shape: { success: true, data: value }
    if ('success' in r && 'data' in r) {
      return r.data as T;
    }
  }
  return response as T;
}

function unwrapArray<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];

  if (response !== null && typeof response === 'object') {
    const r = response as Record<string, unknown>;

    // Shape: { data: { <key>: [...] }, meta: {...} } — backend sendSuccess with paginate
    if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
      const inner = r.data as Record<string, unknown>;
      // Find the first array value inside data
      for (const val of Object.values(inner)) {
        if (Array.isArray(val)) return val as T[];
      }
    }

    // Shape: { data: [...] }
    if (Array.isArray(r.data)) return r.data as T[];
  }

  return [];
}

// ── RTK Query Admin CMS Slice ─────────────────────────────────────────────────

export const cmsAdminApi = createApi({
  reducerPath: 'cmsAdminApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: [
    'CmsHero',
    'CmsAnnouncement',
    'CmsCollections',
    'CmsBanners',
    'CmsAbout',
    'CmsContact',
    'CmsStaticPages',
    'CmsFeatured',
    'CmsVideoCards',
  ],
  endpoints: (builder) => ({

    // ── Hero ──────────────────────────────────────────────────────────────────

    getHero: builder.query<CmsHero, void>({
      query: () => ENDPOINTS.ADMIN.CMS.HERO,
      transformResponse: (response: ApiResponse<CmsHero> | CmsHero) => unwrap(response),
      providesTags: ['CmsHero'],
    }),

    updateHero: builder.mutation<CmsHero, Partial<CmsHero>>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.HERO, method: 'PUT', body }),
      transformResponse: (response: ApiResponse<CmsHero> | CmsHero) => unwrap(response),
      invalidatesTags: ['CmsHero'],
    }),

    // ── Announcement Bar ──────────────────────────────────────────────────────

    getAnnouncementBar: builder.query<CmsAnnouncementBar, void>({
      query: () => ENDPOINTS.ADMIN.CMS.ANNOUNCEMENT_BAR,
      transformResponse: (response: ApiResponse<CmsAnnouncementBar> | CmsAnnouncementBar) =>
        unwrap(response),
      providesTags: ['CmsAnnouncement'],
    }),

    updateAnnouncementBar: builder.mutation<CmsAnnouncementBar, Partial<CmsAnnouncementBar>>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.ANNOUNCEMENT_BAR, method: 'PUT', body }),
      transformResponse: (response: ApiResponse<CmsAnnouncementBar> | CmsAnnouncementBar) =>
        unwrap(response),
      invalidatesTags: ['CmsAnnouncement'],
    }),

    // ── About Us ──────────────────────────────────────────────────────────────

    getAboutUs: builder.query<CmsAboutUs, void>({
      query: () => ENDPOINTS.ADMIN.CMS.ABOUT_US,
      transformResponse: (response: ApiResponse<CmsAboutUs> | CmsAboutUs) => unwrap(response),
      providesTags: ['CmsAbout'],
    }),

    updateAboutUs: builder.mutation<CmsAboutUs, Partial<CmsAboutUs>>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.ABOUT_US, method: 'PUT', body }),
      transformResponse: (response: ApiResponse<CmsAboutUs> | CmsAboutUs) => unwrap(response),
      invalidatesTags: ['CmsAbout'],
    }),

    // ── Contact ───────────────────────────────────────────────────────────────

    getContact: builder.query<CmsContact, void>({
      query: () => ENDPOINTS.ADMIN.CMS.CONTACT,
      transformResponse: (response: ApiResponse<CmsContact> | CmsContact) => unwrap(response),
      providesTags: ['CmsContact'],
    }),

    updateContact: builder.mutation<CmsContact, Partial<CmsContact>>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.CONTACT, method: 'PUT', body }),
      transformResponse: (response: ApiResponse<CmsContact> | CmsContact) => unwrap(response),
      invalidatesTags: ['CmsContact'],
    }),

    // ── Collections Showcase ──────────────────────────────────────────────────

    getCollectionsShowcase: builder.query<CmsCollectionItem[], void>({
      query: () => ENDPOINTS.ADMIN.CMS.COLLECTIONS_SHOWCASE,
      transformResponse: (response: ApiResponse<CmsCollectionItem[]> | CmsCollectionItem[]) => {
        // Backend now returns { success, data: { items: [...] } }
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          const r = response as unknown as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.items)) return inner.items as CmsCollectionItem[];
          }
          if (Array.isArray(r.data)) return r.data as CmsCollectionItem[];
        }
        if (Array.isArray(response)) return response as CmsCollectionItem[];
        return [];
      },
      providesTags: ['CmsCollections'],
    }),

    updateCollectionsShowcase: builder.mutation<CmsCollectionItem[], CmsCollectionItem[]>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.COLLECTIONS_SHOWCASE, method: 'PUT', body }),
      transformResponse: (response: ApiResponse<CmsCollectionItem[]> | CmsCollectionItem[]) => {
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          const r = response as unknown as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.items)) return inner.items as CmsCollectionItem[];
          }
          if (Array.isArray(r.data)) return r.data as CmsCollectionItem[];
        }
        if (Array.isArray(response)) return response as CmsCollectionItem[];
        return [];
      },
      invalidatesTags: ['CmsCollections'],
    }),

    // ── Banners (full CRUD) ───────────────────────────────────────────────────

    getBanners: builder.query<CmsBanner[], PaginationParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.CMS.BANNERS,
        params: params ?? undefined,
      }),
      transformResponse: (response: ApiResponse<CmsBanner[]> | CmsBanner[]) =>
        unwrapArray(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'CmsBanners' as const, id: _id })),
              { type: 'CmsBanners' as const, id: 'LIST' },
            ]
          : [{ type: 'CmsBanners' as const, id: 'LIST' }],
    }),

    createBanner: builder.mutation<CmsBanner, Omit<CmsBanner, '_id'>>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.BANNERS, method: 'POST', body }),
      transformResponse: (response: ApiResponse<CmsBanner> | CmsBanner) => unwrap(response),
      invalidatesTags: [{ type: 'CmsBanners', id: 'LIST' }],
    }),

    updateBanner: builder.mutation<CmsBanner, { id: string; body: Partial<CmsBanner> }>({
      query: ({ id, body }) => ({
        url: ENDPOINTS.ADMIN.CMS.BANNER_DETAIL(id),
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: ApiResponse<CmsBanner> | CmsBanner) => unwrap(response),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'CmsBanners', id },
        { type: 'CmsBanners', id: 'LIST' },
      ],
    }),

    deleteBanner: builder.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({
        url: ENDPOINTS.ADMIN.CMS.BANNER_DETAIL(id),
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'CmsBanners', id },
        { type: 'CmsBanners', id: 'LIST' },
      ],
    }),

    // ── Homepage Video Cards (separate collection and cache tag) ─────────────

    getVideoCards: builder.query<CmsVideoCard[], void>({
      query: () => ENDPOINTS.ADMIN.CMS.VIDEO_CARDS,
      transformResponse: (response: unknown): CmsVideoCard[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.cards)) return inner.cards as CmsVideoCard[];
          }
          if (Array.isArray(r.data)) return r.data as CmsVideoCard[];
        }
        return [];
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'CmsVideoCards' as const, id: _id })),
              { type: 'CmsVideoCards' as const, id: 'LIST' },
            ]
          : [{ type: 'CmsVideoCards' as const, id: 'LIST' }],
    }),

    createVideoCard: builder.mutation<CmsVideoCard, CmsVideoCardInput>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.VIDEO_CARDS, method: 'POST', body }),
      transformResponse: (response: unknown) => unwrap<CmsVideoCard>(response),
      invalidatesTags: [{ type: 'CmsVideoCards', id: 'LIST' }],
    }),

    updateVideoCard: builder.mutation<CmsVideoCard, { id: string; body: Partial<CmsVideoCardInput> }>({
      query: ({ id, body }) => ({
        url: ENDPOINTS.ADMIN.CMS.VIDEO_CARD(id),
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: unknown) => unwrap<CmsVideoCard>(response),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'CmsVideoCards', id },
        { type: 'CmsVideoCards', id: 'LIST' },
      ],
    }),

    deleteVideoCard: builder.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.CMS.VIDEO_CARD(id), method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'CmsVideoCards', id },
        { type: 'CmsVideoCards', id: 'LIST' },
      ],
    }),

    // ── Static Pages (full CRUD) ──────────────────────────────────────────────

    getStaticPages: builder.query<CmsStaticPage[], PaginationParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.CMS.STATIC_PAGES,
        params: params ?? undefined,
      }),
      transformResponse: (response: ApiResponse<CmsStaticPage[]> | CmsStaticPage[]) =>
        unwrapArray(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'CmsStaticPages' as const, id: _id })),
              { type: 'CmsStaticPages' as const, id: 'LIST' },
            ]
          : [{ type: 'CmsStaticPages' as const, id: 'LIST' }],
    }),

    createStaticPage: builder.mutation<CmsStaticPage, Omit<CmsStaticPage, '_id' | 'updatedAt'>>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.STATIC_PAGES, method: 'POST', body }),
      transformResponse: (response: ApiResponse<CmsStaticPage> | CmsStaticPage) =>
        unwrap(response),
      invalidatesTags: [{ type: 'CmsStaticPages', id: 'LIST' }],
    }),

    updateStaticPage: builder.mutation<
      CmsStaticPage,
      { id: string; body: Partial<CmsStaticPage> }
    >({
      query: ({ id, body }) => ({
        url: ENDPOINTS.ADMIN.CMS.STATIC_PAGE(id),
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: ApiResponse<CmsStaticPage> | CmsStaticPage) =>
        unwrap(response),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'CmsStaticPages', id },
        { type: 'CmsStaticPages', id: 'LIST' },
      ],
    }),

    deleteStaticPage: builder.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({
        url: ENDPOINTS.ADMIN.CMS.STATIC_PAGE(id),
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'CmsStaticPages', id },
        { type: 'CmsStaticPages', id: 'LIST' },
      ],
    }),

    // ── Featured Sections (full CRUD) ─────────────────────────────────────────

    getFeaturedSections: builder.query<CmsFeaturedSection[], PaginationParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.CMS.FEATURED_SECTIONS,
        params: params ?? undefined,
      }),
      transformResponse: (response: ApiResponse<CmsFeaturedSection[]> | CmsFeaturedSection[]) =>
        unwrapArray(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'CmsFeatured' as const, id: _id })),
              { type: 'CmsFeatured' as const, id: 'LIST' },
            ]
          : [{ type: 'CmsFeatured' as const, id: 'LIST' }],
    }),

    createFeaturedSection: builder.mutation<CmsFeaturedSection, Omit<CmsFeaturedSection, '_id'>>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CMS.FEATURED_SECTIONS, method: 'POST', body }),
      transformResponse: (response: ApiResponse<CmsFeaturedSection> | CmsFeaturedSection) =>
        unwrap(response),
      invalidatesTags: [{ type: 'CmsFeatured', id: 'LIST' }],
    }),

    updateFeaturedSection: builder.mutation<
      CmsFeaturedSection,
      { id: string; body: Partial<CmsFeaturedSection> }
    >({
      query: ({ id, body }) => ({
        url: ENDPOINTS.ADMIN.CMS.FEATURED_SECTION(id),
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: ApiResponse<CmsFeaturedSection> | CmsFeaturedSection) =>
        unwrap(response),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'CmsFeatured', id },
        { type: 'CmsFeatured', id: 'LIST' },
      ],
    }),

    deleteFeaturedSection: builder.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({
        url: ENDPOINTS.ADMIN.CMS.FEATURED_SECTION(id),
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'CmsFeatured', id },
        { type: 'CmsFeatured', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  // Hero
  useGetHeroQuery,
  useUpdateHeroMutation,
  // Announcement Bar
  useGetAnnouncementBarQuery,
  useUpdateAnnouncementBarMutation,
  // About Us
  useGetAboutUsQuery,
  useUpdateAboutUsMutation,
  // Contact
  useGetContactQuery,
  useUpdateContactMutation,
  // Collections Showcase
  useGetCollectionsShowcaseQuery,
  useUpdateCollectionsShowcaseMutation,
  // Banners
  useGetBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,
  // Homepage Video Cards
  useGetVideoCardsQuery,
  useCreateVideoCardMutation,
  useUpdateVideoCardMutation,
  useDeleteVideoCardMutation,
  // Static Pages
  useGetStaticPagesQuery,
  useCreateStaticPageMutation,
  useUpdateStaticPageMutation,
  useDeleteStaticPageMutation,
  // Featured Sections
  useGetFeaturedSectionsQuery,
  useCreateFeaturedSectionMutation,
  useUpdateFeaturedSectionMutation,
  useDeleteFeaturedSectionMutation,
} = cmsAdminApi;
