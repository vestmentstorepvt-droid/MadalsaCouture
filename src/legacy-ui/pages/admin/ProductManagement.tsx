import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Tag,
} from 'lucide-react';
import { StatsCard } from '../../components/ui/cards/StatsCards';
import { AppDropdown } from '../../components/ui/dropdown/AppDropdown';
import { AppButton } from '../../components/ui/button/AppButton';
import { Pagination } from '../../components/ui/pagination/Pagination';
import {
  useGetAdminProductsQuery,
  useGetAdminProductStatsQuery,
  useGetAdminCategoriesQuery,
  useCreateCategoryMutation,
  useCreateProductMutation,
  useUpdateProductMutation,
  useUpdateProductStatusMutation,
  useDeleteProductMutation,
  useGetProductVariantsQuery,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
} from '../../services/adminProductsApi';

import type {
  AdminProduct,
  AdminProductVariant,
  AdminCategory,
} from '../../services/adminProductsApi';
import {
  MultiImageUploader,
  type ProductImageItem,
} from '../../components/ui/upload/MultiImageUploader';
import { DynamicListInput } from '../../components/ui/forms/DynamicListInput';
import { DynamicKeyValueInput } from '../../components/ui/forms/DynamicKeyValueInput';

// ─── Filter dropdown options ──────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { label: 'All Status', value: 'ALL' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Archived', value: 'archived' },
];

const SORT_OPTIONS = [
  { label: 'Newest First', value: 'createdAt:desc' },
  { label: 'Oldest First', value: 'createdAt:asc' },
  { label: 'Price: Low → High', value: 'basePrice:asc' },
  { label: 'Price: High → Low', value: 'basePrice:desc' },
  { label: 'Title: A → Z', value: 'title:asc' },
  { label: 'Title: Z → A', value: 'title:desc' },
];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

// ─── Toast Component ──────────────────────────────────────────────────────────
interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const Toast: React.FC<{ toast: ToastState | null; onClose: () => void }> = ({
  toast,
  onClose,
}) => {
  if (!toast) return null;
  return (
    <div
      role="alert"
      className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${toast.type === 'error'
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}
    >
      {toast.type === 'error' ? (
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
      )}
      <span className="font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-400 hover:text-slate-700 ml-2 focus:outline-none"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── Product Form Modal ───────────────────────────────────────────────────────
interface ProductFormData {
  title: string;
  shortDescription: string;
  description: string;
  basePrice: string;
  mrp: string;
  sku: string;
  categoryId: string;
  fabric: string;
  washCare: string;
  productDetails: { label: string; value: string }[];
  sizeFit: { label: string; value: string }[];
  stylingTips: string[];
  careInstructions: string[];
  deliveryReturns: string[];
  disclaimer: string;
  images: ProductImageItem[];
  isNewArrival: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
}

const EMPTY_FORM: ProductFormData = {
  title: '',
  shortDescription: '',
  description: '',
  basePrice: '',
  mrp: '',
  sku: '',
  categoryId: '',
  fabric: '',
  washCare: '',
  productDetails: [],
  sizeFit: [],
  stylingTips: [],
  careInstructions: [],
  deliveryReturns: [],
  disclaimer: '',
  images: [],
  isNewArrival: false,
  isBestSeller: false,
  isFeatured: false,
  isTrending: false,
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
};

function productToForm(p: AdminProduct): ProductFormData {
  let catId = '';
  if (p.categoryId) {
    catId = typeof p.categoryId === 'string' ? p.categoryId : p.categoryId._id;
  }
  return {
    title: p.title || '',
    shortDescription: p.shortDescription || '',
    description: p.description || '',
    basePrice: p.basePrice != null ? String(p.basePrice) : '',
    mrp: p.mrp != null ? String(p.mrp) : '',
    sku: p.sku || '',
    categoryId: catId,
    fabric: p.specifications?.fabric || '',
    washCare: p.specifications?.washCare || '',
    productDetails: p.productDetails || [],
    sizeFit: p.sizeFit || [],
    stylingTips: p.stylingTips || [],
    careInstructions: p.careInstructions || [],
    deliveryReturns: p.deliveryReturns || [],
    disclaimer: p.disclaimer || '',
    images: Array.isArray(p.images)
      ? p.images.map((img) => ({
        url: img.url,
        altText: img.altText || '',
        role: (img.role as any) || 'gallery',
        sortOrder: img.sortOrder || 0,
      }))
      : [],
    isNewArrival: p.flags?.isNewArrival ?? false,
    isBestSeller: p.flags?.isBestSeller ?? false,
    isFeatured: p.flags?.isFeatured ?? false,
    isTrending: p.flags?.isTrending ?? false,
    metaTitle: p.seo?.metaTitle || p.title || '',
    metaDescription: p.seo?.metaDescription || p.shortDescription || '',
    metaKeywords: Array.isArray(p.seo?.metaKeywords) ? p.seo.metaKeywords.join(', ') : '',
  };
}

// ─── Create Category Modal ───────────────────────────────────────────────────
interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCatId: string) => void;
}

const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createCategory, { isLoading }] = useCreateCategoryMutation();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    try {
      const created = await createCategory({
        name: name.trim(),
        description: description.trim() || undefined,
      }).unwrap();
      setName('');
      setDescription('');
      onSuccess(created._id);
      onClose();
    } catch (err: any) {
      const msg = err?.data?.error?.message || err?.data?.message || 'Failed to create category.';
      setError(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200 space-y-4 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4 text-accent" /> Add New Product Category
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Category Name *</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink"
              placeholder="e.g. Co-ord Sets, Anarkali Suits, Sarees"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink"
              placeholder="Brief description of this luxury collection category..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <AppButton type="submit" variant="primary" size="sm" isLoading={isLoading}>
              Create Category
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ProductFormModalProps {
  product: AdminProduct | null;
  categories: AdminCategory[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AdminProduct>) => Promise<void>;
  isLoading: boolean;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  categories,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [form, setForm] = useState<ProductFormData>(
    product ? productToForm(product) : EMPTY_FORM
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  React.useEffect(() => {
    setForm(product ? productToForm(product) : EMPTY_FORM);
    setErrors({});
  }, [product, isOpen]);

  if (!isOpen) return null;


  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Product title is required';
    if (!form.basePrice || isNaN(Number(form.basePrice)) || Number(form.basePrice) < 0) {
      errs.basePrice = 'Valid base price (>= 0) is required';
    }
    if (form.mrp && (isNaN(Number(form.mrp)) || Number(form.mrp) < 0)) {
      errs.mrp = 'MRP must be a valid non-negative number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const finalMetaTitle = form.metaTitle.trim() || form.title.trim();
    const finalMetaDescription = form.metaDescription.trim() || form.shortDescription.trim() || undefined;
    const keywordsList = form.metaKeywords
      ? form.metaKeywords.split(',').map((k) => k.trim()).filter(Boolean)
      : [];

    const payload: Partial<AdminProduct> = {
      title: form.title.trim(),
      shortDescription: form.shortDescription.trim() || null,
      description: form.description.trim() || null,
      basePrice: Number(form.basePrice),
      mrp: form.mrp ? Number(form.mrp) : null,
      sku: form.sku.trim() || null,
      categoryId: form.categoryId || null,
      images: form.images.map((img, idx) => ({
        url: img.url,
        altText: img.altText || form.title.trim(),
        role: img.role || (idx === 0 ? 'primary' : 'gallery'),
        sortOrder: idx,
      })),
      specifications: {
        ...product?.specifications,
        fabric: form.fabric.trim() || null,
        washCare: form.washCare.trim() || null,
      },
      productDetails: form.productDetails.filter((item) => item.label.trim() && item.value.trim()),
      sizeFit: form.sizeFit.filter((item) => item.label.trim() && item.value.trim()),
      stylingTips: form.stylingTips.map(t => t.trim()).filter(Boolean),
      careInstructions: form.careInstructions.map(t => t.trim()).filter(Boolean),
      deliveryReturns: form.deliveryReturns.map(t => t.trim()).filter(Boolean),
      disclaimer: form.disclaimer.trim() || null,
      flags: {
        ...product?.flags,
        isNewArrival: form.isNewArrival,
        isBestSeller: form.isBestSeller,
        isFeatured: form.isFeatured,
        isTrending: form.isTrending,
      },
      seo: {
        metaTitle: finalMetaTitle,
        metaDescription: finalMetaDescription,
        metaKeywords: keywordsList,
      },
    };

    await onSubmit(payload);
  };


  const inputClass = (hasErr?: boolean) =>
    `w-full px-3.5 py-2.5 rounded-xl border ${hasErr ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200 focus:ring-ink/20 focus:border-ink'
    } bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 transition placeholder:text-slate-400`;

  const labelClass = 'text-xs font-semibold text-slate-600 block mb-1';

  // Compute structured Cloudinary folder path
  const selectedCategory = categories.find((c) => c._id === form.categoryId);
  const categorySlug =
    selectedCategory?.slug ||
    selectedCategory?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
    'general';
  const productSlug =
    form.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
    'new-product';
  const cloudinaryFolderPath = `Madalsa/${categorySlug}/${productSlug}`;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {product ? 'Edit Product' : 'Add New Product'}
            </h2>
            <p className="text-xs text-slate-500">Configure product catalog details, images, and pricing</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Multi-Image Uploader with dynamic folder path */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <MultiImageUploader
              images={form.images}
              onChange={(imgs) => setForm({ ...form, images: imgs })}
              folder={cloudinaryFolderPath}
              tags={`${categorySlug}, ${productSlug}`}
            />
          </div>

          <div>
            <label className={labelClass}>Product Title *</label>
            <input
              type="text"
              className={inputClass(Boolean(errors.title))}
              placeholder="e.g. Banarasi Silk Saree"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Base Price (₹) *</label>
              <input
                type="number"
                className={inputClass(Boolean(errors.basePrice))}
                placeholder="e.g. 4999"
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                min={0}
              />
              {errors.basePrice && <p className="text-xs text-rose-500 mt-1">{errors.basePrice}</p>}
            </div>

            <div>
              <label className={labelClass}>MRP / Original Price (₹)</label>
              <input
                type="number"
                className={inputClass(Boolean(errors.mrp))}
                placeholder="e.g. 6999"
                value={form.mrp}
                onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                min={0}
              />
            </div>

            <div>
              <label className={labelClass}>SKU (Stock Keeping Unit)</label>
              <input
                type="text"
                className={inputClass(false)}
                placeholder="e.g. MAD-001"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass}>Category</label>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="text-xs font-semibold text-accent hover:text-accent-deep flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> New Category
              </button>
            </div>
            <select
              className={inputClass()}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>


          <div>
            <label className={labelClass}>Short Description (Max 300 characters)</label>
            <input
              type="text"
              className={inputClass()}
              placeholder="Brief summary shown in product cards"
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              maxLength={300}
            />
          </div>

          <div>
            <label className={labelClass}>Full Description</label>
            <textarea
              rows={3}
              className={inputClass()}
              placeholder="Detailed product story, craftsmanship, and materials..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fabric / Material</label>
              <input
                type="text"
                className={inputClass()}
                placeholder="e.g. Pure Katan Silk"
                value={form.fabric}
                onChange={(e) => setForm({ ...form, fabric: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>Wash Care</label>
              <input
                type="text"
                className={inputClass()}
                placeholder="e.g. Dry Clean Only"
                value={form.washCare}
                onChange={(e) => setForm({ ...form, washCare: e.target.value })}
              />
            </div>
          </div>

          {/* Storefront Accordion Details */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-800 tracking-wider">
                Storefront Accordion Details
              </span>
              <span className="text-xs text-slate-400 font-medium bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
                Displayed as dynamic lists on product page
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <DynamicKeyValueInput
                label="Product Details"
                items={form.productDetails}
                onChange={(items) => setForm({ ...form, productDetails: items })}
                labelPlaceholder="e.g. Color"
                valuePlaceholder="e.g. Mustard Yellow"
              />

              <DynamicKeyValueInput
                label="Size & Fit"
                items={form.sizeFit}
                onChange={(items) => setForm({ ...form, sizeFit: items })}
                labelPlaceholder="e.g. Model Size"
                valuePlaceholder="e.g. Model is wearing Size XS"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <DynamicListInput
                label="Styling Tips"
                items={form.stylingTips}
                onChange={(items) => setForm({ ...form, stylingTips: items })}
                placeholder="e.g. Pair with statement chandbalis..."
              />

              <DynamicListInput
                label="Care Instructions"
                items={form.careInstructions}
                onChange={(items) => setForm({ ...form, careInstructions: items })}
                placeholder="e.g. Dry clean only."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <DynamicListInput
                label="Delivery & Returns"
                items={form.deliveryReturns}
                onChange={(items) => setForm({ ...form, deliveryReturns: items })}
                placeholder="e.g. Dispatched in 15-25 days."
              />

              <div>
                <label className={labelClass}>Disclaimer</label>
                <textarea
                  rows={3}
                  className={inputClass()}
                  placeholder="e.g. Product color may slightly vary due to lighting..."
                  value={form.disclaimer}
                  onChange={(e) => setForm({ ...form, disclaimer: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* SEO & Search Optimization */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                SEO & Search Engine Optimization
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Required for publishing
              </span>
            </div>

            <div>
              <label className={labelClass}>Meta Title (Search Title)</label>
              <input
                type="text"
                className={inputClass()}
                placeholder={form.title ? `Default: ${form.title}` : 'e.g. Banarasi Silk Saree | Madalsa Couture'}
                value={form.metaTitle}
                onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">
                If left blank, Product Title will be used automatically.
              </p>
            </div>

            <div>
              <label className={labelClass}>Meta Description</label>
              <textarea
                rows={2}
                className={inputClass()}
                placeholder="Brief summary for Google search results..."
                value={form.metaDescription}
                onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>Meta Keywords (Comma Separated)</label>
              <input
                type="text"
                className={inputClass()}
                placeholder="e.g. silk saree, banarasi, wedding, luxury couture"
                value={form.metaKeywords}
                onChange={(e) => setForm({ ...form, metaKeywords: e.target.value })}
              />
            </div>
          </div>

          {/* Product Flags */}

          <div>
            <label className={labelClass}>Merchandising Flags</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isNewArrival}
                  onChange={(e) => setForm({ ...form, isNewArrival: e.target.checked })}
                  className="rounded text-accent focus:ring-ink accent-accent"
                />
                New Arrival
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isBestSeller}
                  onChange={(e) => setForm({ ...form, isBestSeller: e.target.checked })}
                  className="rounded text-accent focus:ring-ink accent-accent"
                />
                Best Seller
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                  className="rounded text-accent focus:ring-ink accent-accent"
                />
                Featured
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isTrending}
                  onChange={(e) => setForm({ ...form, isTrending: e.target.checked })}
                  className="rounded text-accent focus:ring-ink accent-accent"
                />
                Trending
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
              disabled={isLoading}
            >
              Cancel
            </button>
            <AppButton type="submit" variant="primary" size="md" isLoading={isLoading}>
              {product ? 'Save Changes' : 'Create Product'}
            </AppButton>
          </div>
        </form>
      </div>
    </div>
    <CreateCategoryModal
      isOpen={isCategoryModalOpen}
      onClose={() => setIsCategoryModalOpen(false)}
      onSuccess={(newCatId) => setForm((current) => ({ ...current, categoryId: newCatId }))}
    />
    </>
  );
};

// ─── Variant Panel Modal ──────────────────────────────────────────────────────
interface VariantPanelModalProps {
  product: AdminProduct | null;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const VariantPanelModal: React.FC<VariantPanelModalProps> = ({
  product,
  onClose,
  showToast,
}) => {
  const productId = product?._id ?? '';
  const { data: variants = [], isLoading, refetch } = useGetProductVariantsQuery(productId, {
    skip: !product,
  });
  const [createVariant, { isLoading: creating }] = useCreateVariantMutation();
  const [updateVariant, { isLoading: updating }] = useUpdateVariantMutation();
  const [deleteVariant, { isLoading: deleting }] = useDeleteVariantMutation();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [variantForm, setVariantForm] = useState({
    size: '',
    color: '',
    fabric: 'Standard',
    price: '',
    stock: '10',
  });

  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (product) {
      setVariantForm({
        size: '',
        color: '',
        fabric: product.specifications?.fabric || 'Standard',
        price: String(product.basePrice || ''),
        stock: '10',
      });
      setError(null);
      setIsAdding(false);
      setEditingId(null);
    }
  }, [product]);

  if (!product) return null;


  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!variantForm.size.trim()) {
      setError('Size is required (e.g. Free Size or M). Create a separate variant for each size.');
      return;
    }
    if (variantForm.size.includes(',')) {
      setError('Enter one size per variant. Create a separate variant for each size.');
      return;
    }
    if (!variantForm.color.trim()) {
      setError('Color is required (e.g. Crimson Red)');
      return;
    }
    if (!variantForm.fabric.trim()) {
      setError('Fabric is required');
      return;
    }
    if (!variantForm.price || Number(variantForm.price) < 0) {
      setError('Valid price is required');
      return;
    }

    try {
      await createVariant({
        productId: product._id,
        data: {
          size: variantForm.size.trim(),
          color: variantForm.color.trim(),
          fabric: variantForm.fabric.trim(),
          price: Number(variantForm.price),
          stock: Number(variantForm.stock) || 0,
        },
      }).unwrap();
      showToast('Variant created successfully');
      setIsAdding(false);
      setVariantForm({
        size: '',
        color: '',
        fabric: product.specifications?.fabric || 'Standard',
        price: String(product.basePrice || ''),
        stock: '10',
      });
      refetch();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string }; message?: string } };
      setError(apiErr?.data?.error?.message || apiErr?.data?.message || 'Failed to create variant.');
    }
  };


  const handleEditSubmit = async (variantId: string) => {
    if (!variantForm.size.trim() || variantForm.size.includes(',')) {
      showToast('Enter one size only. Create a separate variant for each size.', 'error');
      return;
    }
    if (!variantForm.color.trim() || !variantForm.fabric.trim()) {
      showToast('Color and fabric are required.', 'error');
      return;
    }
    if (variantForm.price === '' || Number.isNaN(Number(variantForm.price)) || Number(variantForm.price) < 0) {
      showToast('Enter a valid price.', 'error');
      return;
    }
    if (variantForm.stock === '' || !Number.isInteger(Number(variantForm.stock)) || Number(variantForm.stock) < 0) {
      showToast('Stock must be a whole number of 0 or more.', 'error');
      return;
    }
    try {
      await updateVariant({
        productId: product._id,
        variantId,
        data: {
          size: variantForm.size.trim(),
          color: variantForm.color.trim(),
          fabric: variantForm.fabric.trim(),
          price: Number(variantForm.price),
          stock: Number(variantForm.stock) || 0,
        },
      }).unwrap();
      showToast('Variant updated successfully');
      setEditingId(null);
      refetch();
    } catch {
      showToast('Failed to update variant', 'error');
    }
  };

  const handleDelete = async (variantId: string) => {
    if (!window.confirm('Delete this variant? Its stock record will be removed and it can no longer be purchased.')) return;
    try {
      await deleteVariant({ productId: product._id, variantId }).unwrap();
      showToast('Variant deleted');
      refetch();
    } catch {
      showToast('Failed to delete variant', 'error');
    }
  };

  const startEdit = (v: AdminProductVariant) => {
    setEditingId(v._id);
    setVariantForm({
      size: v.size || '',
      color: v.color || '',
      fabric: v.fabric || product.specifications?.fabric || 'Standard',
      price: String(v.price),
      stock: String(v.stock),
    });
    setIsAdding(false);
  };

  const inputClass =
    'w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Manage Variants</h2>
            <p className="text-xs text-slate-500">
              Product: <span className="font-semibold text-slate-800">{product.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Existing Variants ({variants.length})
            </span>
            {!isAdding && !editingId && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="px-3 py-1.5 rounded-lg bg-ink text-white text-xs font-semibold hover:bg-ink-hover transition"
              >
                + Add Variant
              </button>
            )}
          </div>

          {/* Add Form */}
          {isAdding && (
            <form onSubmit={handleAddSubmit} className="p-4 rounded-xl bg-pink-50/40 border border-pink-100 space-y-3">
              <p className="text-xs font-bold text-accent uppercase tracking-wider">New Variant</p>
              {error && <p className="text-xs text-rose-600">{error}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Size *</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="e.g. M or Free Size"
                    value={variantForm.size}
                    onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-slate-400">Create a separate variant for each size so stock and checkout remain accurate.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Color *</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="e.g. Crimson Red"
                    value={variantForm.color}
                    onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Fabric *</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="e.g. Pure Silk"
                    value={variantForm.fabric}
                    onChange={(e) => setVariantForm({ ...variantForm, fabric: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={variantForm.price}
                    onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Stock *</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={variantForm.stock}
                    onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })}
                    min={0}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <AppButton type="submit" variant="primary" size="sm" isLoading={creating}>
                  Save Variant
                </AppButton>
              </div>
            </form>
          )}

          {/* Variants List */}
          {isLoading ? (
            <p className="text-center py-6 text-xs text-slate-400">Loading variants...</p>
          ) : variants.length === 0 && !isAdding ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-600">No variants created yet.</p>
              <p className="text-xs text-slate-400">Add size/color options to enable inventory tracking.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {variants.map((v) =>
                editingId === v._id ? (
                  <div key={v._id} className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-3">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Edit Variant</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Size</label>
                        <input
                          type="text"
                          className={inputClass}
                          value={variantForm.size}
                          onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
                        />
                        <p className="mt-1 text-xs text-slate-400">One size per variant (e.g. XS, S, M, L or XL).</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Color</label>
                        <input
                          type="text"
                          className={inputClass}
                          value={variantForm.color}
                          onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Fabric</label>
                        <input
                          type="text"
                          className={inputClass}
                          value={variantForm.fabric}
                          onChange={(e) => setVariantForm({ ...variantForm, fabric: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Price (₹)</label>
                        <input
                          type="number"
                          className={inputClass}
                          value={variantForm.price}
                          onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Stock</label>
                        <input
                          type="number"
                          className={inputClass}
                          value={variantForm.stock}
                          onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <AppButton
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={updating}
                        onClick={() => handleEditSubmit(v._id)}
                      >
                        Save
                      </AppButton>
                    </div>
                  </div>
                ) : (
                  <div
                    key={v._id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition"
                  >
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-700">
                      <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                        {v.size}
                      </span>
                      <span className="font-medium text-slate-600">{v.color}</span>
                      {v.fabric && <span className="text-slate-400">({v.fabric})</span>}
                      {v.sku && <span className="font-mono text-slate-400">SKU: {v.sku}</span>}
                      <span className="font-bold text-slate-900">₹{v.price.toLocaleString('en-IN')}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${v.stock > 5
                            ? 'bg-emerald-50 text-emerald-700'
                            : v.stock > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                      >
                        {v.stock} in stock
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(v)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition"
                        title="Edit Variant"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(v._id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Delete Variant"
                        disabled={deleting}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <AppButton variant="outline" onClick={onClose}>
            Close
          </AppButton>
        </div>
      </div>
    </div>
  );
};

// ─── Product Details Modal ────────────────────────────────────────────────────
interface ProductDetailModalProps {
  product: AdminProduct | null;
  categories: AdminCategory[];
  onClose: () => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  categories,
  onClose,
}) => {
  if (!product) return null;

  const categoryName = () => {
    if (!product.categoryId) return 'Uncategorized';
    if (typeof product.categoryId === 'string') {
      const found = categories.find((c) => c._id === product.categoryId);
      return found ? found.name : 'Uncategorized';
    }
    return product.categoryId.name;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-slate-900">Product Overview</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">{product.title}</span>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase ${product.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : product.status === 'archived'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
              >
                {product.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">slug: {product.slug}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 block mb-1">Category</span>
              <span className="font-semibold text-slate-800">{categoryName()}</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 block mb-1">Base Price</span>
              <span className="font-bold text-accent text-sm">
                {currency.format(product.basePrice)}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 block mb-1">MRP</span>
              <span className="font-semibold text-slate-700">
                {product.mrp ? currency.format(product.mrp) : '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 block mb-1">Fabric</span>
              <span className="font-semibold text-slate-800">
                {product.specifications?.fabric || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 block mb-1">Wash Care</span>
              <span className="font-semibold text-slate-800">
                {product.specifications?.washCare || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 block mb-1">Total Variants</span>
              <span className="font-semibold text-slate-800">
                {product.variants?.length ?? 0} variants
              </span>
            </div>
          </div>

          {product.shortDescription && (
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
              <span className="font-semibold text-slate-700 block mb-1">Short Description</span>
              <p className="text-slate-600">{product.shortDescription}</p>
            </div>
          )}

          {product.description && (
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
              <span className="font-semibold text-slate-700 block mb-1">Full Description</span>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <AppButton variant="outline" onClick={onClose}>
            Close
          </AppButton>
        </div>
      </div>
    </div>
  );
};

// ─── Main ProductManagement Component ─────────────────────────────────────────
export const ProductManagement: React.FC = () => {
  // Local state for filters
  const [searchInput, setSearchInput] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sort, setSort] = useState<string>('createdAt:desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modals state
  const [formModalProduct, setFormModalProduct] = useState<AdminProduct | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isStandaloneCatOpen, setIsStandaloneCatOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState<AdminProduct | null>(null);
  const [viewProduct, setViewProduct] = useState<AdminProduct | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);


  // Queries & Mutations
  const { data: productsResp, isLoading, isFetching, refetch } = useGetAdminProductsQuery({
    page: currentPage,
    limit: pageSize,
    search: search.trim() || undefined,
    categoryId: categoryFilter !== 'ALL' ? categoryFilter : undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    sort: sort || undefined,
  });

  const { data: categories = [] } = useGetAdminCategoriesQuery();
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [updateProductStatus] = useUpdateProductStatusMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();

  const products: AdminProduct[] = productsResp?.data ?? [];
  const pagination = productsResp?.pagination;
  const total = pagination?.total ?? 0;

  // Fetch accurate global status counts (independent of current page / filters)
  const { data: statsData } = useGetAdminProductStatsQuery();
  const globalTotal = statsData?.totalProducts ?? total;
  const publishedCount = statsData?.publishedCount ?? 0;
  const draftArchivedCount = statsData?.draftArchivedCount ?? 0;

  const categoryOptions = [
    { label: 'All Categories', value: 'ALL' },
    ...categories.map((c) => ({ label: c.name, value: c._id })),
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setSort('createdAt:desc');
    setCurrentPage(1);
  };

  const handleFormSubmit = async (payload: Partial<AdminProduct>) => {
    try {
      if (formModalProduct) {
        await updateProduct({ id: formModalProduct._id, data: payload }).unwrap();
        setToast({ type: 'success', message: 'Product updated successfully' });
      } else {
        await createProduct(payload).unwrap();
        setToast({ type: 'success', message: 'Product created successfully' });
      }
      setIsFormOpen(false);
      setFormModalProduct(null);
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string }; message?: string } };
      setToast({
        type: 'error',
        message: apiErr?.data?.error?.message || apiErr?.data?.message || 'Failed to save product.',
      });
    }
  };

  const handleStatusChange = async (product: AdminProduct, newStatus: 'draft' | 'published' | 'archived') => {
    if (product.status === newStatus) return;
    try {
      await updateProductStatus({ id: product._id, status: newStatus }).unwrap();
      setToast({
        type: 'success',
        message: `Product "${product.title}" marked as ${newStatus}.`,
      });
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string; details?: string[] }; message?: string } };
      const details = apiErr?.data?.error?.details;
      const detailMsg = Array.isArray(details) && details.length ? details.join(' ') : null;
      const mainMsg = apiErr?.data?.error?.message || apiErr?.data?.message || 'Failed to update product status.';
      setToast({
        type: 'error',
        message: detailMsg ? `${mainMsg} (${detailMsg})` : mainMsg,
      });
    }
  };


  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteProduct(deleteTargetId).unwrap();
      setToast({ type: 'success', message: 'Product deleted successfully.' });
    } catch {
      setToast({ type: 'error', message: 'Failed to delete product.' });
    } finally {
      setDeleteTargetId(null);
    }
  };

  const getCategoryLabel = (product: AdminProduct): string => {
    if (!product.categoryId) return '—';
    if (typeof product.categoryId === 'string') {
      const found = categories.find((c) => c._id === product.categoryId);
      return found ? found.name : '—';
    }
    return product.categoryId.name ?? '—';
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      {/* Toast Alert */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Product Form Modal */}
      <ProductFormModal
        product={formModalProduct}
        categories={categories}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setFormModalProduct(null);
        }}
        onSubmit={handleFormSubmit}
        isLoading={isCreating || isUpdating}
      />

      {/* Variant Modal */}
      <VariantPanelModal
        product={variantProduct}
        onClose={() => setVariantProduct(null)}
        showToast={(msg, type) => setToast({ message: msg, type: type || 'success' })}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={viewProduct}
        categories={categories}
        onClose={() => setViewProduct(null)}
      />

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete Product</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete this product? All linked variants will also be archived.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <AppButton
                variant="danger"
                size="sm"
                onClick={handleDeleteConfirm}
                isLoading={isDeleting}
              >
                Yes, Delete
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, manage catalog items, configure pricing, variants, and stock.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => setIsStandaloneCatOpen(true)}
          >
            <Tag className="w-4 h-4 mr-1.5 text-accent" /> + New Category
          </AppButton>
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching && !isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </AppButton>
          <AppButton
            variant="primary"
            size="md"
            onClick={() => {
              setFormModalProduct(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Product
          </AppButton>
        </div>

        <CreateCategoryModal
          isOpen={isStandaloneCatOpen}
          onClose={() => setIsStandaloneCatOpen(false)}
          onSuccess={() => setToast({ type: 'success', message: 'Category created successfully!' })}
        />

      </div>

      {/* Stats Cards — global counts, independent of current page / filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Products"
          value={globalTotal.toLocaleString()}
          changePercentage={0}
          changeText="in catalog"
          icon={Package}
          iconBgColor="bg-rose-50"
          iconColor="text-accent"
        />
        <StatsCard
          title="Published"
          value={publishedCount.toLocaleString()}
          changePercentage={0}
          changeText="live in storefront"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Draft"
          value={draftArchivedCount.toLocaleString()}
          changePercentage={0}
          changeText="unpublished"
          icon={Tag}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-600"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-16 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold bg-ink text-white rounded-lg hover:bg-ink-hover transition"
            >
              Go
            </button>
          </form>

          {/* Category Dropdown */}
          <div className="w-full sm:w-44">
            <AppDropdown
              options={categoryOptions}
              value={categoryFilter}
              onChange={(v) => {
                setCategoryFilter(String(v));
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Status Dropdown */}
          <div className="w-full sm:w-36">
            <AppDropdown
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(String(v));
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="w-full sm:w-48">
            <AppDropdown
              options={SORT_OPTIONS}
              value={sort}
              onChange={(v) => {
                setSort(String(v));
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-accent hover:underline font-semibold self-end lg:self-center"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Products Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-4">Product</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4">Base Price</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Merchandising</th>
                <th className="py-4 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                      <span className="text-sm">Loading products...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No products found</p>
                      <p className="text-xs text-slate-400">
                        {search || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Try adjusting your search query or filters.'
                          : 'Click "+ Add Product" to create your first product.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const primaryImg = p.primaryImage || p.images?.find((img) => img.role === 'primary')?.url || p.images?.[0]?.url;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product Name & Image Thumbnail */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {primaryImg ? (
                              <img
                                src={primaryImg as string}
                                alt={p.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{p.title}</span>
                            <span className="font-mono text-xs text-slate-400 block mt-0.5">{p.slug}</span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-4 text-slate-600 text-xs font-medium">
                        {getCategoryLabel(p)}
                      </td>

                      {/* Price & MRP */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-900">
                          {currency.format(p.basePrice)}
                        </span>
                        {p.mrp && p.mrp > p.basePrice && (
                          <span className="text-xs text-slate-400 line-through block">
                            {currency.format(p.mrp)}
                          </span>
                        )}
                      </td>

                      {/* Status Dropdown/Pill */}
                      <td className="py-4 px-4">
                        <select
                          value={p.status || 'draft'}
                          onChange={(e) =>
                            handleStatusChange(p, e.target.value as 'draft' | 'published' | 'archived')
                          }
                          className={`text-xs font-semibold rounded-full px-2.5 py-1 border transition cursor-pointer focus:outline-none ${p.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'archived'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>

                      {/* Flags */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {p.flags?.isNewArrival && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-xs font-semibold">
                              New
                            </span>
                          )}
                          {p.flags?.isBestSeller && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-xs font-semibold">
                              Best Seller
                            </span>
                          )}
                          {p.flags?.isFeatured && (
                            <span className="px-2 py-0.5 rounded-full bg-pink-50 text-accent border border-pink-100 text-xs font-semibold">
                              Featured
                            </span>
                          )}
                          {!p.flags?.isNewArrival && !p.flags?.isBestSeller && !p.flags?.isFeatured && (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Overview */}
                          <button
                            type="button"
                            onClick={() => setViewProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-rose-50 transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-accent" />
                          </button>

                          {/* Edit Product */}
                          <button
                            type="button"
                            onClick={() => {
                              setFormModalProduct(p);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4 text-purple-500" />
                          </button>

                          {/* Manage Variants */}
                          <button
                            type="button"
                            onClick={() => setVariantProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition"
                            title="Manage Variants & Stock"
                          >
                            <Layers className="w-4 h-4 text-sky-500" />
                          </button>

                          {/* Delete Product */}
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(p._id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Shared Pagination Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <Pagination
            currentPage={currentPage}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            itemLabel="products"
          />
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;
