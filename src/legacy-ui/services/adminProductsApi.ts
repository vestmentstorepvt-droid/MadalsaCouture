import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface ProductImage {
  url: string;
  altText?: string;
  role?: 'primary' | 'gallery' | 'hover' | 'sizeChart' | 'lifestyle' | 'back' | 'side' | 'closeup' | 'video' | '360';
  sortOrder?: number;
}

export interface ProductSpecifications {
  fabric?: string | null;
  careInstructions?: string | null;
  fitNotes?: string | null;
  measurements?: string | null;
  washCare?: string | null;
  countryOfOrigin?: string;

}

export interface ProductAttribute {
  label: string;
  value: string;
}

export interface AdminProduct {
  _id: string;
  title: string;
  slug: string;
  sku?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  basePrice: number;
  mrp?: number | null;
  taxRate?: number;
  hsnCode?: string | null;
  categoryId?: string | { _id: string; name: string; slug?: string } | null;
  subcategoryId?: string | null;
  collectionIds?: string[];
  tagIds?: string[];
  designer?: string | null;
  brand?: string | null;
  occasions?: string[];
  season?: string | null;
  gender?: 'Women' | 'Men' | 'Girls' | 'Boys' | 'Unisex';
  ageGroup?: 'Adult' | 'Teen' | 'Kids';
  primaryImage?: string | null;
  images?: ProductImage[];
  status: 'draft' | 'published' | 'archived';
  flags?: {
    isNewArrival?: boolean;
    isFeatured?: boolean;
    isBestSeller?: boolean;
    isTrending?: boolean;
    isLimitedEdition?: boolean;
    isMadeToOrder?: boolean;
    isReadyToShip?: boolean;
    isPreOrder?: boolean;
  };
  productDetails?: ProductAttribute[];
  sizeFit?: ProductAttribute[];
  stylingTips?: string[];
  careInstructions?: string[];
  deliveryReturns?: string[];
  disclaimer?: string | null;
  specifications?: ProductSpecifications;
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    metaKeywords?: string[];
    canonicalUrl?: string | null;
    ogImage?: string | null;
  };
  variants?: AdminProductVariant[];

  createdAt: string;
  updatedAt: string;
}

export interface AdminProductVariant {
  _id: string;
  productId: string;
  size: string;
  color: string;
  fabric?: string;
  sku?: string;
  barcode?: string | null;
  price: number;
  stock: number;
  images?: ProductImage[];
  weight?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  status?: 'active' | 'archived';
}

export interface AdminProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  categoryId?: string;
  sort?: string;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
}

export interface PaginatedProductsResponse {
  data: AdminProduct[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface ProductStatsResponse {
  totalProducts: number;
  publishedCount: number;
  draftArchivedCount: number;
}

export const adminProductsApi = createApi({
  reducerPath: 'adminProductsApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Products', 'Categories', 'Variants'],
  endpoints: (builder) => ({
    getAdminProducts: builder.query<PaginatedProductsResponse, AdminProductsParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.PRODUCTS,
        params: params
          ? {
              ...(params.page !== undefined && { page: params.page }),
              ...(params.limit !== undefined && { limit: params.limit }),
              ...(params.search?.trim() && { search: params.search.trim() }),
              ...(params.status && params.status !== 'ALL' && { status: params.status }),
              ...(params.categoryId && params.categoryId !== 'ALL' && { categoryId: params.categoryId }),
              ...(params.sort && { sort: params.sort }),
              ...(params.isFeatured !== undefined && { isFeatured: params.isFeatured }),
              ...(params.isNewArrival !== undefined && { isNewArrival: params.isNewArrival }),
              ...(params.isBestSeller !== undefined && { isBestSeller: params.isBestSeller }),
            }
          : undefined,
      }),
      transformResponse: (response: unknown): PaginatedProductsResponse => {
        const fallback = { total: 0, page: 1, limit: 20, totalPages: 0 };
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          const data = Array.isArray(r.data) ? (r.data as AdminProduct[]) : [];
          const meta = r.meta as { pagination?: typeof fallback } | undefined;
          const pagination = meta?.pagination ?? (r.pagination as typeof fallback) ?? fallback;
          return { data, pagination };
        }
        return { data: [], pagination: fallback };
      },
      providesTags: (result) =>
        result
          ? [...result.data.map((p) => ({ type: 'Products' as const, id: p._id })), 'Products']
          : ['Products'],
    }),

    getAdminProductStats: builder.query<ProductStatsResponse, void>({
      queryFn: async (_arg, _queryApi, _extraOptions, baseQuery) => {
        // Run 3 lightweight queries in parallel to get accurate global status counts
        const [totalRes, publishedRes, draftRes] = await Promise.all([
          baseQuery({ url: ENDPOINTS.ADMIN.PRODUCTS, params: { limit: 1, page: 1 } }),
          baseQuery({ url: ENDPOINTS.ADMIN.PRODUCTS, params: { limit: 1, page: 1, status: 'published' } }),
          baseQuery({ url: ENDPOINTS.ADMIN.PRODUCTS, params: { limit: 1, page: 1, status: 'draft' } }),
        ]);

        if (totalRes.error) return { error: totalRes.error };
        if (publishedRes.error) return { error: publishedRes.error };
        if (draftRes.error) return { error: draftRes.error };

        const extractTotal = (res: { data?: unknown }): number => {
          const r = res.data as Record<string, unknown> | undefined;
          if (!r) return 0;
          const meta = r.meta as { pagination?: { total?: number } } | undefined;
          const pag = r.pagination as { total?: number } | undefined;
          return meta?.pagination?.total ?? pag?.total ?? 0;
        };

        return {
          data: {
            totalProducts: extractTotal(totalRes),
            publishedCount: extractTotal(publishedRes),
            draftArchivedCount: extractTotal(draftRes),
          },
        };
      },
      providesTags: ['Products'],
    }),

    getProductById: builder.query<AdminProduct, string>({
      query: (id) => ENDPOINTS.ADMIN.PRODUCT_DETAIL(id),
      transformResponse: (response: unknown): AdminProduct => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.product && typeof inner.product === 'object') {
              return inner.product as AdminProduct;
            }
          }
          if (r.product && typeof r.product === 'object') {
            return r.product as AdminProduct;
          }
        }
        return response as AdminProduct;
      },
      providesTags: (_result, _error, id) => [{ type: 'Products', id }],
    }),

    getAdminCategories: builder.query<AdminCategory[], void>({
      query: () => ENDPOINTS.ADMIN.CATEGORIES,
      transformResponse: (response: unknown) => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (Array.isArray(r.data)) return r.data as AdminCategory[];
          if (Array.isArray(r.categories)) return r.categories as AdminCategory[];
          if (Array.isArray(response)) return response as AdminCategory[];
        }
        return [];
      },
      providesTags: ['Categories'],
    }),

    createCategory: builder.mutation<AdminCategory, { name: string; description?: string }>({
      query: (body) => ({
        url: ENDPOINTS.ADMIN.CATEGORIES,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown): AdminCategory => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.category && typeof inner.category === 'object') {
              return inner.category as AdminCategory;
            }
          }
          if (r.category && typeof r.category === 'object') {
            return r.category as AdminCategory;
          }
        }
        return response as AdminCategory;
      },
      invalidatesTags: ['Categories'],
    }),

    updateCategory: builder.mutation<AdminCategory, { id: string; data: Partial<AdminCategory> }>({
      query: ({ id, data }) => ({
        url: `${ENDPOINTS.ADMIN.CATEGORIES}/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Categories'],
    }),

    archiveCategory: builder.mutation<AdminCategory, string>({
      query: (id) => ({
        url: `${ENDPOINTS.ADMIN.CATEGORIES}/${id}/archive`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Categories'],
    }),

    deleteCategory: builder.mutation<AdminCategory, string>({
      query: (id) => ({
        url: `${ENDPOINTS.ADMIN.CATEGORIES}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Categories'],
    }),

    createProduct: builder.mutation<AdminProduct, Partial<AdminProduct>>({

      query: (body) => ({ url: ENDPOINTS.ADMIN.PRODUCTS, method: 'POST', body }),
      transformResponse: (response: unknown): AdminProduct => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && (r.data as Record<string, unknown>).product) {
            return (r.data as Record<string, unknown>).product as AdminProduct;
          }
        }
        return response as AdminProduct;
      },
      invalidatesTags: ['Products'],
    }),

    updateProduct: builder.mutation<AdminProduct, { id: string; data: Partial<AdminProduct> }>({
      query: ({ id, data }) => ({
        url: ENDPOINTS.ADMIN.PRODUCT_DETAIL(id),
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: unknown): AdminProduct => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && (r.data as Record<string, unknown>).product) {
            return (r.data as Record<string, unknown>).product as AdminProduct;
          }
        }
        return response as AdminProduct;
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Products', id }, 'Products'],
    }),

    updateProductStatus: builder.mutation<AdminProduct, { id: string; status: 'draft' | 'published' | 'archived' }>({
      query: ({ id, status }) => ({
        url: ENDPOINTS.ADMIN.PRODUCT_STATUS(id),
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (response: unknown): AdminProduct => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && (r.data as Record<string, unknown>).product) {
            return (r.data as Record<string, unknown>).product as AdminProduct;
          }
        }
        return response as AdminProduct;
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Products', id }, 'Products'],
    }),

    deleteProduct: builder.mutation<void, string>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.PRODUCT_DETAIL(id), method: 'DELETE' }),
      invalidatesTags: ['Products'],
    }),

    getProductVariants: builder.query<AdminProductVariant[], string>({
      query: (productId) => ENDPOINTS.ADMIN.PRODUCT_VARIANTS(productId),
      transformResponse: (response: unknown): AdminProductVariant[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.variants)) return inner.variants as AdminProductVariant[];
          }
          if (Array.isArray(r.variants)) return r.variants as AdminProductVariant[];
          if (Array.isArray(r.data)) return r.data as AdminProductVariant[];
          if (Array.isArray(response)) return response as AdminProductVariant[];
        }
        return [];
      },
      providesTags: (_result, _error, productId) => [{ type: 'Variants', id: productId }],
    }),

    createVariant: builder.mutation<
      AdminProductVariant,
      { productId: string; data: Partial<AdminProductVariant> }
    >({
      query: ({ productId, data }) => ({
        url: ENDPOINTS.ADMIN.PRODUCT_VARIANTS(productId),
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: unknown): AdminProductVariant => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && (r.data as Record<string, unknown>).variant) {
            return (r.data as Record<string, unknown>).variant as AdminProductVariant;
          }
        }
        return response as AdminProductVariant;
      },
      invalidatesTags: (_result, _error, { productId }) => [{ type: 'Variants', id: productId }, 'Products'],
    }),

    updateVariant: builder.mutation<
      AdminProductVariant,
      { productId: string; variantId: string; data: Partial<AdminProductVariant> }
    >({
      query: ({ variantId, data }) => ({
        url: ENDPOINTS.ADMIN.VARIANT_DETAIL(variantId),
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: unknown): AdminProductVariant => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && (r.data as Record<string, unknown>).variant) {
            return (r.data as Record<string, unknown>).variant as AdminProductVariant;
          }
        }
        return response as AdminProductVariant;
      },
      invalidatesTags: (_result, _error, { productId }) => [{ type: 'Variants', id: productId }, 'Products'],
    }),

    deleteVariant: builder.mutation<void, { productId: string; variantId: string }>({
      query: ({ variantId }) => ({
        url: ENDPOINTS.ADMIN.VARIANT_DETAIL(variantId),
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { productId }) => [{ type: 'Variants', id: productId }, 'Products'],
    }),
  }),
});

export const {
  useGetAdminProductsQuery,
  useGetAdminProductStatsQuery,
  useGetProductByIdQuery,
  useGetAdminCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useArchiveCategoryMutation,
  useDeleteCategoryMutation,
  useCreateProductMutation,
  useUpdateProductMutation,
  useUpdateProductStatusMutation,
  useDeleteProductMutation,
  useGetProductVariantsQuery,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
} = adminProductsApi;

