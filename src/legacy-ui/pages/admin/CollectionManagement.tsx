import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { AppButton } from '../../components/ui/button/AppButton';
import { Pagination } from '../../components/ui/pagination/Pagination';
import {
  useGetAdminCollectionsQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  type Collection,
} from '../../services/collectionsApi';
import { useGetAdminProductsQuery } from '../../services/adminProductsApi';
import { StatsCard } from '../../components/ui/cards/StatsCards';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const Toast: React.FC<{ toast: ToastState | null; onClose: () => void }> = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div role="alert" className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
      {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
      <span className="font-medium">{toast.message}</span>
      <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 ml-2">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const CollectionManagement: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isFetching, refetch } = useGetAdminCollectionsQuery({ search: debouncedSearch, page, limit });
  const collections = data?.data || [];
  const totalItems: number = data?.meta?.pagination?.total ?? data?.meta?.total ?? collections.length;
  
  const [createCollection, { isLoading: isCreating }] = useCreateCollectionMutation();
  const [updateCollection, { isLoading: isUpdating }] = useUpdateCollectionMutation();
  const [deleteCollection, { isLoading: isDeleting }] = useDeleteCollectionMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCol, setEditingCol] = useState<Collection | null>(null);
  const [form, setForm] = useState({ 
    name: '', 
    description: '', 
    type: 'manual' as 'manual' | 'rule-based', 
    status: 'active' as 'active' | 'inactive', 
    productIds: [] as string[],
    rules: [] as { field: string, operator: string, value: string }[] 
  });

  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedProductSearch(productSearch), 300);
    return () => clearTimeout(handler);
  }, [productSearch]);

  const [productPage, setProductPage] = useState(1);
  const PRODUCT_PAGE_SIZE = 50;

  // Reset product page when modal opens or search changes
  React.useEffect(() => {
    setProductPage(1);
  }, [isModalOpen, debouncedProductSearch]);

  const { data: productsData, isLoading: isLoadingProducts, isFetching: isFetchingProducts } =
    useGetAdminProductsQuery(
      { search: debouncedProductSearch, limit: PRODUCT_PAGE_SIZE, page: productPage },
      { skip: !isModalOpen || form.type !== 'manual' }
    );
  const products = productsData?.data || [];
  const productTotalPages = productsData?.pagination?.totalPages ?? 1;
  const productTotal = productsData?.pagination?.total ?? 0;

  const toggleProduct = (productId: string) => {
    setForm(prev => {
      const isSelected = prev.productIds.includes(productId);
      return {
        ...prev,
        productIds: isSelected 
          ? prev.productIds.filter(id => id !== productId)
          : [...prev.productIds, productId]
      };
    });
  };

  const addRule = () => setForm(prev => ({ ...prev, rules: [...prev.rules, { field: 'basePrice', operator: 'gte', value: '' }] }));
  const removeRule = (index: number) => setForm(prev => ({ ...prev, rules: prev.rules.filter((_, i) => i !== index) }));
  const updateRule = (index: number, key: string, value: string) => setForm(prev => {
    const newRules = [...prev.rules];
    newRules[index] = { ...newRules[index], [key]: value };
    return { ...prev, rules: newRules };
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchInput);
    setPage(1);
  };

  const openModal = (col?: Collection) => {
    if (col) {
      setEditingCol(col);
      setForm({ name: col.name, description: col.description || '', type: col.type, status: col.status, productIds: col.productIds || [], rules: col.rules || [] });
    } else {
      setEditingCol(null);
      setForm({ name: '', description: '', type: 'manual', status: 'active', productIds: [], rules: [] });
    }
    setProductSearch('');
    setProductPage(1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCol(null);
    setForm({ name: '', description: '', type: 'manual', status: 'active', productIds: [], rules: [] });
    setProductSearch('');
    setProductPage(1);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCol) {
        await updateCollection({ id: editingCol._id, data: form }).unwrap();
        setToast({ type: 'success', message: 'Collection updated.' });
      } else {
        await createCollection(form).unwrap();
        setToast({ type: 'success', message: 'Collection created.' });
      }
      closeModal();
      refetch();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.data?.message || 'Action failed.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this collection?')) return;
    try {
      await deleteCollection(id).unwrap();
      setToast({ type: 'success', message: 'Collection deleted.' });
      refetch();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.data?.message || 'Failed to delete.' });
    }
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Collection Management</h1>
          <p className="text-sm text-slate-500 mt-1">Group products into collections for discovery.</p>
        </div>
        <div className="flex items-center gap-3">
          <AppButton variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching && !isLoading}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </AppButton>
          <AppButton variant="primary" size="md" onClick={() => openModal()}>
            <Plus className="w-4 h-4 mr-1.5" /> New Collection
          </AppButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Collections"
          value={collections.length.toLocaleString()}
          changePercentage={0}
          changeText="Manual & Automated"
          icon={Layers}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-700"
        />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSearch} className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search collections..."
            className="w-full pl-9 pr-20 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] transition"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded-lg transition">
            Search
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Products</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" /> Loading...
                  </td>
                </tr>
              ) : collections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" /> No collections found.
                  </td>
                </tr>
              ) : (
                collections.map((col) => (
                  <tr key={col._id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">{col.name}</td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-slate-600 font-medium">{col.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${col.status === 'inactive' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {col.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {col.type === 'manual' ? (col.productIds?.length || 0) : 'Dynamic'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <a href={`/collections/${col.slug}`} target="_blank" rel="noreferrer" className="inline-block p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition" title="View Public Page">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button onClick={() => openModal(col)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(col._id)} disabled={isDeleting} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          totalItems={totalItems}
          pageSize={limit}
          onPageChange={setPage}
          showPageSizeSelector={false}
          itemLabel="collections"
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full border border-slate-200 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg">{editingCol ? 'Edit Collection' : 'New Collection'}</h3>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-[#E85D88] transition"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-[#E85D88] transition"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as 'manual' | 'rule-based' })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-[#E85D88] transition bg-white"
                  >
                    <option value="manual">Manual</option>
                    <option value="rule-based">Rule-Based</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-[#E85D88] transition bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              {form.type === 'manual' && (
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Assign Products
                    </label>
                    {form.productIds.length > 0 && (
                      <span className="text-xs font-semibold bg-[#E85D88]/10 text-[#E85D88] px-2 py-0.5 rounded-full">
                        {form.productIds.length} selected
                      </span>
                    )}
                  </div>
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products to add..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:border-[#E85D88] transition"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
                    {isLoadingProducts ? (
                      <p className="text-xs text-slate-500 text-center py-4">Loading products...</p>
                    ) : products.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No products found.</p>
                    ) : (
                      products.map(product => (
                        <label key={product._id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition">
                          <input
                            type="checkbox"
                            checked={form.productIds.includes(product._id)}
                            onChange={() => toggleProduct(product._id)}
                            className="w-4 h-4 rounded border-slate-300 text-[#E85D88] focus:ring-[#E85D88]"
                          />
                          {(product.primaryImage || product.images?.[0]?.url) && (
                            <img src={product.primaryImage || product.images?.[0]?.url} alt={product.title} className="w-8 h-8 rounded-md object-cover bg-slate-200" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{product.title}</p>
                            <p className="text-xs text-slate-500">₹{product.basePrice.toFixed(2)}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  {/* Pagination controls for product picker */}
                  {productTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-2 px-1">
                      <span className="text-xs text-slate-400">
                        {isFetchingProducts ? 'Loading...' : `Showing ${((productPage - 1) * PRODUCT_PAGE_SIZE) + 1}–${Math.min(productPage * PRODUCT_PAGE_SIZE, productTotal)} of ${productTotal} products`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={productPage <= 1 || isFetchingProducts}
                          onClick={() => setProductPage(p => Math.max(1, p - 1))}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                        >
                          ← Prev
                        </button>
                        <span className="text-xs text-slate-500 px-1">{productPage}/{productTotalPages}</span>
                        <button
                          type="button"
                          disabled={productPage >= productTotalPages || isFetchingProducts}
                          onClick={() => setProductPage(p => Math.min(productTotalPages, p + 1))}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {form.type === 'rule-based' && (
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-600">Product Rules</label>
                    <button type="button" onClick={addRule} className="text-xs font-semibold text-[#E85D88] hover:text-[#D14D75] bg-pink-50 hover:bg-pink-100 px-2 py-1 rounded transition flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Rule
                    </button>
                  </div>
                  {form.rules.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">No rules added yet. Products will not be matched.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {form.rules.map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={rule.field}
                            onChange={(e) => updateRule(idx, 'field', e.target.value)}
                            className="w-1/3 px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E85D88]"
                          >
                            <option value="basePrice">Base Price</option>
                            <option value="status">Status</option>
                            <option value="categoryId">Category ID</option>
                            <option value="tagIds">Tag ID</option>
                          </select>
                          <select
                            value={rule.operator}
                            onChange={(e) => updateRule(idx, 'operator', e.target.value)}
                            className="w-1/4 px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E85D88]"
                          >
                            <option value="eq">Equals</option>
                            <option value="gte">Greater &ge;</option>
                            <option value="lte">Less &le;</option>
                            <option value="in">In List</option>
                          </select>
                          <input
                            type="text"
                            value={rule.value}
                            onChange={(e) => updateRule(idx, 'value', e.target.value)}
                            placeholder="Value..."
                            className="flex-1 px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E85D88]"
                          />
                          <button type="button" onClick={() => removeRule(idx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <AppButton type="button" variant="outline" onClick={closeModal}>Cancel</AppButton>
                <AppButton type="submit" variant="primary" isLoading={isCreating || isUpdating}>Save Collection</AppButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionManagement;
