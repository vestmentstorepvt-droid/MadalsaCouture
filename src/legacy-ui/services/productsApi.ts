import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

// ── Data shapes ──────────────────────────────────────────────────────────────

export interface ProductVariant {
  _id: string;
  size: string;
  color?: string;
  stock: number;
  reservedStock?: number;
  available?: number;
  sku?: string;
  price?: number;
}

export interface ProductAttribute {
  label: string;
  value: string;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  originalPrice?: number;
  category: string;
  primaryImage?: string;
  images: string[];
  isNewArrival: boolean;
  isBestSeller: boolean;
  inStock: boolean;
  designer?: string;
  sku?: string;
  variants?: ProductVariant[];
  tags?: string[];
  productDetails?: ProductAttribute[];
  sizeFit?: ProductAttribute[];
  stylingTips?: string[];
  careInstructions?: string[];
  deliveryReturns?: string[];
  disclaimer?: string | null;
  specifications?: {
    fabric?: string | null;
    washCare?: string | null;
    fitNotes?: string | null;
  };

  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeItem {
  _id: string;
  name: string;
  slug: string;
  parentId: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  displayOrder?: number;
  status: 'active' | 'archived';
  children?: CategoryTreeItem[];
}


export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  // Shop filters (see src/server/services/shopFilterService.ts)
  collection?: string;
  categories?: string[];
  sizes?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
}

export interface ShopFacets {
  total: number;
  collections: { slug: string; name: string; count: number }[];
  categories: { slug: string; name: string; count: number }[];
  sizes: { value: string; count: number; inStockCount: number }[];
  colors: { value: string; label: string; swatch: string; count: number }[];
  price: { min: number; max: number };
  inStockCount: number;
  onSaleCount: number;
}


interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── RTK Query slice ──────────────────────────────────────────────────────────

export const productsApi = createApi({
  reducerPath: 'productsApi',
  baseQuery: baseQueryWithErrorLogging,
  keepUnusedDataFor: 120,
  tagTypes: ['Products'],

  endpoints: (builder) => ({
    getProducts: builder.query<
      { products: Product[]; pagination?: PaginatedResponse<Product>['pagination'] },
      ProductQueryParams
    >({
      query: (params = {}) => {
        const queryParams: Record<string, unknown> = {};
        if (params.page !== undefined) queryParams.page = params.page;
        if (params.limit !== undefined) queryParams.limit = params.limit;
        if (params.search?.trim()) queryParams.search = params.search.trim();
        if (params.sort && params.sort !== 'default') queryParams.sort = params.sort;

        if (params.category === 'new-arrivals' || params.category === 'new-arrival') {
          queryParams.isNewArrival = 'true';
        } else if (params.category === 'best-seller' || params.category === 'best-sellers') {
          queryParams.isBestSeller = 'true';
        } else if (params.category && params.category !== 'all') {
          queryParams.category = params.category;
          queryParams.categoryId = params.category;
        }


        if (params.isNewArrival !== undefined) queryParams.isNewArrival = params.isNewArrival;
        if (params.isBestSeller !== undefined) queryParams.isBestSeller = params.isBestSeller;

        if (params.collection) queryParams.collection = params.collection;
        if (params.categories?.length) queryParams.categories = params.categories.join(',');
        if (params.sizes?.length) queryParams.sizes = params.sizes.join(',');
        if (params.colors?.length) queryParams.colors = params.colors.join(',');
        if (params.minPrice !== undefined) queryParams.minPrice = params.minPrice;
        if (params.maxPrice !== undefined) queryParams.maxPrice = params.maxPrice;
        if (params.inStock) queryParams.inStock = 'true';
        if (params.onSale) queryParams.onSale = 'true';

        return {
          url: ENDPOINTS.PRODUCTS,
          params: queryParams,
        };
      },
      transformResponse: (response: unknown) => {
        const r = response as Record<string, unknown>;
        let rawArray: any[] = [];
        let pagination: any = { page: 1, limit: 20, total: 0, totalPages: 0 };

        if (Array.isArray(r?.data)) {
          rawArray = r.data;
        } else if (r?.data && typeof r.data === 'object' && Array.isArray((r.data as any).products)) {
          rawArray = (r.data as any).products;
        } else if (Array.isArray(response)) {
          rawArray = response as any[];
        }

        const meta = r?.meta as any;
        if (meta?.pagination) {
          pagination = meta.pagination;
        } else if (r?.pagination) {
          pagination = r.pagination;
        }

        const normalizedProducts: Product[] = rawArray.map((p: any) => {
          let imgUrl = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800';
          if (Array.isArray(p.images) && p.images.length > 0) {
            const primary = p.images.find((img: any) => img.role === 'primary') || p.images[0];
            imgUrl = typeof primary === 'string' ? primary : (primary?.url || imgUrl);
          }

          const catName = typeof p.category === 'object' && p.category ? p.category.name : (p.category || 'Couture');

          return {
            _id: String(p._id),
            name: p.title || p.name || 'Untitled Product',
            slug: p.slug || String(p._id),
            description: p.description || '',
            shortDescription: p.shortDescription || '',
            price: Number(p.basePrice ?? p.price ?? 0),
            originalPrice: p.mrp ? Number(p.mrp) : undefined,
            category: catName,
            primaryImage: p.primaryImage || imgUrl,
            images: [imgUrl],
            isNewArrival: Boolean(p.isNewArrival ?? p.flags?.isNewArrival ?? false),
            isBestSeller: Boolean(p.isBestSeller ?? p.flags?.isBestSeller ?? false),
            inStock: Boolean(p.inStock ?? true),
            specifications: p.specifications ? {
              fabric: p.specifications.fabric || null,
              washCare: p.specifications.washCare || null,
              fitNotes: p.specifications.fitNotes || null,
            } : undefined,
            createdAt: p.createdAt || '',
            updatedAt: p.updatedAt || '',
          };

        });

        return { products: normalizedProducts, pagination };
      },
      providesTags: ['Products'],
    }),


    getProductBySlug: builder.query<Product, string>({
      query: (slug) => {
        const cleanSlug = encodeURIComponent(slug.trim());
        return {
          url: ENDPOINTS.PRODUCT_DETAIL(cleanSlug),
        };
      },
      transformResponse: (response: unknown): Product => {
        let p: any = {};
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            p = inner.product || inner;
          } else if (r.product && typeof r.product === 'object') {
            p = r.product;
          } else {
            p = response;
          }
        }

        const rawImages: any[] = Array.isArray(p.images) ? p.images : [];
        const imageUrls: string[] = rawImages
          .map((img: any) => {
            if (typeof img === 'string') return img;
            return img?.url || '';
          })
          .filter(Boolean);

        if (imageUrls.length === 0) {
          imageUrls.push('https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800');
        }

        const catName =
          typeof p.category === 'object' && p.category ? p.category.name : (p.category || 'Couture');

        return {
          _id: String(p._id || ''),
          name: p.title || p.name || 'Untitled Product',
          slug: p.slug || '',
          description: p.description || p.shortDescription || '',
          shortDescription: p.shortDescription || p.description || '',
          price: Number(p.basePrice ?? p.price ?? 0),
          originalPrice: p.mrp ? Number(p.mrp) : undefined,
          category: catName,
          primaryImage: p.primaryImage || (imageUrls.length > 0 ? imageUrls[0] : undefined),
          images: imageUrls,
          isNewArrival: Boolean(p.isNewArrival ?? p.flags?.isNewArrival ?? false),
          isBestSeller: Boolean(p.isBestSeller ?? p.flags?.isBestSeller ?? false),
          inStock: Boolean(p.inStock ?? true),
          designer: p.designer || undefined,
          sku: p.sku || undefined,
          variants: p.variants,
          tags: Array.isArray(p.tags) ? p.tags.map((t: any) => (typeof t === 'object' ? t.name : t)).filter(Boolean) : [],
          productDetails: p.productDetails,
          sizeFit: p.sizeFit,
          stylingTips: p.stylingTips,
          careInstructions: p.careInstructions,
          deliveryReturns: p.deliveryReturns,
          disclaimer: p.disclaimer,
          specifications: p.specifications,
          createdAt: p.createdAt || '',
          updatedAt: p.updatedAt || '',
        };
      },
      providesTags: (_result, _error, slug) => [{ type: 'Products', id: slug }],
    }),

    // Keep getProductById as alias for backward compat (uses slug too)
    getProductById: builder.query<Product, string>({
      query: (slug) => {
        const cleanSlug = encodeURIComponent(slug.trim());
        return {
          url: ENDPOINTS.PRODUCT_DETAIL(cleanSlug),
        };
      },
      transformResponse: (response: unknown): Product => {
        let p: any = {};
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            p = inner.product || inner;
          } else if (r.product && typeof r.product === 'object') {
            p = r.product;
          } else {
            p = response;
          }
        }

        const rawImages: any[] = Array.isArray(p.images) ? p.images : [];
        const imageUrls: string[] = rawImages
          .map((img: any) => {
            if (typeof img === 'string') return img;
            return img?.url || '';
          })
          .filter(Boolean);

        if (imageUrls.length === 0) {
          imageUrls.push('https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800');
        }

        const catName =
          typeof p.category === 'object' && p.category ? p.category.name : (p.category || 'Couture');

        return {
          _id: String(p._id || ''),
          name: p.title || p.name || 'Untitled Product',
          slug: p.slug || '',
          description: p.description || p.shortDescription || '',
          shortDescription: p.shortDescription || p.description || '',
          price: Number(p.basePrice ?? p.price ?? 0),
          originalPrice: p.mrp ? Number(p.mrp) : undefined,
          category: catName,
          primaryImage: p.primaryImage || (imageUrls.length > 0 ? imageUrls[0] : undefined),
          images: imageUrls,
          isNewArrival: Boolean(p.isNewArrival ?? p.flags?.isNewArrival ?? false),
          isBestSeller: Boolean(p.isBestSeller ?? p.flags?.isBestSeller ?? false),
          inStock: Boolean(p.inStock ?? true),
          designer: p.designer || undefined,
          sku: p.sku || undefined,
          variants: p.variants,
          tags: Array.isArray(p.tags) ? p.tags.map((t: any) => (typeof t === 'object' ? t.name : t)).filter(Boolean) : [],
          productDetails: p.productDetails,
          sizeFit: p.sizeFit,
          stylingTips: p.stylingTips,
          careInstructions: p.careInstructions,
          deliveryReturns: p.deliveryReturns,
          disclaimer: p.disclaimer,
          specifications: p.specifications,
          createdAt: p.createdAt || '',
          updatedAt: p.updatedAt || '',
        };
      },
      providesTags: (_result, _error, slug) => [{ type: 'Products', id: slug }],
    }),
    getCategoriesTree: builder.query<CategoryTreeItem[], void>({
      query: () => ENDPOINTS.CATEGORIES_TREE,
      transformResponse: (response: unknown): CategoryTreeItem[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.tree)) {
              return inner.tree as CategoryTreeItem[];
            }
          }
        }
        return [];
      },
    }),

    /** Filter options + counts for the shop page, within a collection and search. */
    getProductFacets: builder.query<ShopFacets, { collection?: string; search?: string }>({
      query: ({ collection, search } = {}) => ({
        url: `${ENDPOINTS.PRODUCTS}/facets`,
        params: {
          ...(collection ? { collection } : {}),
          ...(search?.trim() ? { search: search.trim() } : {}),
        },
      }),
      transformResponse: (response: unknown) => {
        const r = response as { data?: ShopFacets };
        return (r?.data ?? response) as ShopFacets;
      },
      providesTags: ['Products'],
    }),

  }),
});

export const {
  useGetProductsQuery,
  useGetProductBySlugQuery,
  useGetProductByIdQuery,
  useGetCategoriesTreeQuery,
  useGetProductFacetsQuery,
} = productsApi;
