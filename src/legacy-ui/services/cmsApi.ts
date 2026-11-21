import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

// ── CMS Data Interfaces ───────────────────────────────────────────────────────

export interface CmsHeroStyles {
  headlineSize?: 'small' | 'medium' | 'large' | 'xlarge';
  subHeadlineSize?: 'small' | 'medium' | 'large';
  buttonSize?: 'small' | 'medium' | 'large';
  buttonStyle?: 'outline' | 'solid' | 'gold_glow';
  alignment?: 'bottom-left' | 'bottom-center' | 'center' | 'bottom-right';
}

export interface CmsHeroMedia {
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mobileMediaUrl?: string;
}

export interface CmsHero {
  /** Carousel items; legacy single-media fields are still accepted. */
  media?: CmsHeroMedia[];
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  headline?: string;
  subHeadline?: string;
  cta?: {
    label?: string;
    url?: string;
  };
  styles?: CmsHeroStyles;
  /** 'active' means the hero should be shown; 'inactive' means hidden */
  status: 'active' | 'inactive';
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CmsAnnouncementBar {
  _id?: string;
  message?: string;
  text?: string; // backwards compatibility alias for message
  link?: string;
  backgroundColor?: string;
  textColor?: string;
  countdownTarget?: string | null;
  status?: 'active' | 'inactive';
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CmsCollectionItem {
  _id?: string;
  name: string;
  imageUrl: string;
  slug: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface CmsBanner {
  _id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  promoCouponCode?: string;
  altText?: string;
  placement: string;
  priority?: number;
  status: 'active' | 'inactive';
  startsAt?: string;
  endsAt?: string;
  // CTA button — only relevant for homepage-hero banners (optional)
  showCtaButton?: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface CmsVideoCard {
  _id: string;
  title: string;
  description?: string;
  videoUrl: string;
  posterUrl: string;
  linkUrl?: string;
  buttonText?: string;
  displayOrder?: number;
  status: 'active' | 'inactive';
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CmsAboutUs {
  _id?: string;
  heroLabel?: string;
  heading?: string;
  subheading?: string;
  body?: string;
  designerName?: string;
  designerRole?: string;
  designerImageUrl?: string;
  establishedYear?: string;
  founderQuote?: string;
  storyParagraphs?: string[];
  highlights?: Array<string | { title?: string; description?: string }>;
  cards?: Array<{ title?: string; description?: string; imageUrl?: string; icon?: string }>;
  virtues?: Array<{ label: string; desc: string }>;
  craftBadges?: Array<{ title: string; description: string; icon?: string }>;
  imageBlocks?: Array<{ imageUrl?: string; caption?: string; displayOrder?: number }>;
  status?: 'active' | 'inactive';
  [key: string]: unknown;
}

export interface CmsContact {
  _id?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  businessHours?: string | null;
  formRoutingEmail?: string | null;
  mapEmbedUrl?: string | null;
  status?: 'active' | 'inactive';
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CmsStaticPage {
  _id: string;
  slug: string;
  title: string;
  body: string;
  status?: 'published' | 'draft';
  updatedAt: string;
}

// ── API Response Envelope ─────────────────────────────────────────────────────

// ── RTK Query Slice ───────────────────────────────────────────────────────────

/** GET /api/v1/reviews/featured — recent 4–5★ reviews for the home page. */
export interface FeaturedReview {
  _id: string;
  rating: number;
  body: string;
  author: string;
  createdAt: string;
  product: { title: string; slug: string; image: string | null } | null;
}

/** Turns the public hero API response into the shape the Hero uses. Also used for the copy the
 * server puts in the home page HTML, so both paths give identical data. */
export const toCmsHero = (response: unknown): CmsHero => {
  const defaults: CmsHero = {
    media: [],
    mediaType: 'video',
    mediaUrl: '',
    headline: '',
    subHeadline: '',
    cta: {},
    styles: {
      headlineSize: 'large',
      subHeadlineSize: 'medium',
      buttonSize: 'medium',
      buttonStyle: 'outline',
      alignment: 'bottom-left',
    },
    status: 'inactive',
  };

  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    // Envelope: { data: { hero: {...} } }
    if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
      const inner = r.data as Record<string, unknown>;
      const raw = (inner.hero ?? inner) as Record<string, unknown>;
      const legacyMedia = raw.mediaUrl
        ? [{
            mediaType: (raw.mediaType as 'image' | 'video') ?? 'image',
            mediaUrl: raw.mediaUrl as string,
          }]
        : [];
      return {
        media: Array.isArray(raw.media)
          ? raw.media as CmsHeroMedia[]
          : legacyMedia,
        mediaType: (raw.mediaType as 'image' | 'video') ?? defaults.mediaType,
        mediaUrl: (raw.mediaUrl as string) ?? defaults.mediaUrl,
        headline: (raw.headline as string) ?? defaults.headline,
        subHeadline: (raw.subHeadline as string) ?? defaults.subHeadline,
        cta: {
          label: ((raw.cta as Record<string, string>)?.label) ?? '',
          url: ((raw.cta as Record<string, string>)?.url) ?? '',
        },
        styles: (raw.styles as CmsHeroStyles) ?? defaults.styles,
        status: (raw.status as 'active' | 'inactive') ?? 'inactive',
        startsAt: (raw.startsAt as string) || null,
        endsAt: (raw.endsAt as string) || null,
      };
    }
  }
  return defaults;
};

export const cmsApi = createApi({
  reducerPath: 'cmsApi',
  baseQuery: baseQueryWithErrorLogging,
  keepUnusedDataFor: 300,
  tagTypes: ['CmsHero', 'CmsAnnouncement', 'CmsCollections', 'CmsBanners', 'CmsVideoCards', 'CmsAbout', 'CmsContact', 'CmsStaticPages'],

  endpoints: (builder) => ({
    getFeaturedReviews: builder.query<FeaturedReview[], number | void>({
      query: (limit) => `/reviews/featured?limit=${limit ?? 6}`,
      transformResponse: (response: unknown): FeaturedReview[] =>
        ((response as { data?: { reviews?: FeaturedReview[] } })?.data?.reviews) ?? [],
    }),
    getHero: builder.query<CmsHero, void>({
      query: () => ENDPOINTS.CMS.HERO,
      transformResponse: toCmsHero,
      providesTags: ['CmsHero'],
    }),

    getAnnouncementBar: builder.query<CmsAnnouncementBar, void>({
      query: () => ENDPOINTS.CMS.ANNOUNCEMENT_BAR,
      transformResponse: (response: unknown): CmsAnnouncementBar => {
        const defaults: CmsAnnouncementBar = {
          message: '',
          text: '',
          link: '',
          backgroundColor: '#D4AF37',
          textColor: '#000000',
          countdownTarget: null,
          status: 'inactive',
          isActive: false,
          startsAt: null,
          endsAt: null,
        };

        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            const raw = (inner.announcementBar ?? inner) as Record<string, unknown>;
            const msg = (raw.message as string) ?? (raw.text as string) ?? '';
            return {
              _id: raw._id as string | undefined,
              message: msg,
              text: msg,
              link: (raw.link as string) ?? '',
              backgroundColor: (raw.backgroundColor as string) ?? '#D4AF37',
              textColor: (raw.textColor as string) ?? '#000000',
              countdownTarget: (raw.countdownTarget as string) ?? null,
              status: (raw.status as 'active' | 'inactive') ?? 'inactive',
              isActive: raw.status === 'active' || raw.isActive === true,
              startsAt: (raw.startsAt as string) ?? null,
              endsAt: (raw.endsAt as string) ?? null,
            };
          }
        }
        return defaults;
      },
      providesTags: ['CmsAnnouncement'],
    }),

    getCollectionsShowcase: builder.query<CmsCollectionItem[], void>({
      query: () => ENDPOINTS.CMS.COLLECTIONS_SHOWCASE,
      transformResponse: (response: unknown) => {
        // Backend returns { success, data: { items: [...] } }
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.items)) return inner.items as CmsCollectionItem[];
          }
          if (Array.isArray(r.data)) return r.data as CmsCollectionItem[];
        }
        if (Array.isArray(response)) return response as CmsCollectionItem[];
        return [] as CmsCollectionItem[];
      },
      providesTags: ['CmsCollections'],
    }),

    getBanners: builder.query<CmsBanner[], { placement?: string } | void>({
      query: (params) => ({
        url: ENDPOINTS.CMS.BANNERS,
        params:
          params && typeof params === 'object' && params.placement
            ? { placement: params.placement }
            : undefined,
      }),
      transformResponse: (response: unknown): CmsBanner[] => {
        if (Array.isArray(response)) return response as CmsBanner[];
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.banners)) return inner.banners as CmsBanner[];
          }
          if (Array.isArray(r.data)) return r.data as CmsBanner[];
        }
        return [];
      },
      providesTags: ['CmsBanners'],
    }),

    getVideoCards: builder.query<CmsVideoCard[], void>({
      query: () => ENDPOINTS.CMS.VIDEO_CARDS,
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
      providesTags: ['CmsVideoCards'],
    }),

    getAboutUs: builder.query<CmsAboutUs, void>({
      query: () => ENDPOINTS.CMS.ABOUT_US,
      transformResponse: (response: unknown): CmsAboutUs => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            const raw = (inner.aboutUs ?? inner) as Record<string, unknown>;
            const result: CmsAboutUs = { ...raw };

            // Helper to strip HTML tags like <p>, </p>, &nbsp;
            const stripHtml = (str: string) => str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

            if (Array.isArray(raw.storyParagraphs) && raw.storyParagraphs.length > 0) {
              const cleaned = (raw.storyParagraphs as string[])
                .map(p => typeof p === 'string' ? stripHtml(p) : '')
                .filter(Boolean);
              result.storyParagraphs = cleaned;
            } else if (typeof raw.body === 'string' && raw.body.trim()) {
              const cleanedBody = stripHtml(raw.body);
              if (cleanedBody) {
                result.storyParagraphs = [cleanedBody];
              } else {
                delete result.storyParagraphs;
              }
            }

            if (typeof result.subheading === 'string') {
              result.subheading = stripHtml(result.subheading);
            }
            if (typeof result.body === 'string') {
              result.body = stripHtml(result.body);
            }

            return result as CmsAboutUs;
          }
        }
        return response as CmsAboutUs;
      },
      providesTags: ['CmsAbout'],
    }),

    getContact: builder.query<CmsContact, void>({
      query: () => ENDPOINTS.CMS.CONTACT,
      transformResponse: (response: unknown): CmsContact => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (inner.contact) return inner.contact as CmsContact;
            return inner as CmsContact;
          }
        }
        return response as CmsContact;
      },
      providesTags: ['CmsContact'],
    }),

    getStaticPage: builder.query<CmsStaticPage, string>({
      query: (slug) => ENDPOINTS.CMS.STATIC_PAGE(slug),
      transformResponse: (response: unknown): CmsStaticPage => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (inner.page) return inner.page as CmsStaticPage;
            return inner as unknown as CmsStaticPage;
          }
        }
        return response as CmsStaticPage;
      },
      providesTags: (_result, _error, slug) => [{ type: 'CmsStaticPages', id: slug }],
    }),

    submitContactInquiry: builder.mutation<{ message: string }, { name: string; email: string; phone?: string; subject?: string; message: string }>({
      query: (body) => ({
        url: '/cms/contact/inquiry',
        method: 'POST',
        body,
      }),
    }),

    claimPromoCoupon: builder.mutation<{ message: string; couponCode: string; discountDetails: string }, { email: string; firstName?: string }>({
      query: (body) => ({
        url: '/coupons/claim-promo',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useGetFeaturedReviewsQuery,
  useGetHeroQuery,
  useGetAnnouncementBarQuery,
  useGetCollectionsShowcaseQuery,
  useGetBannersQuery,
  useGetVideoCardsQuery,
  useGetAboutUsQuery,
  useGetContactQuery,
  useGetStaticPageQuery,
  useSubmitContactInquiryMutation,
  useClaimPromoCouponMutation,
} = cmsApi;
