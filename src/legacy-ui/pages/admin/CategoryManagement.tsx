import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Archive,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { AppButton } from '../../components/ui/button/AppButton';
import {
  useGetAdminCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useArchiveCategoryMutation,
  useDeleteCategoryMutation,
  type AdminCategory,
} from '../../services/adminProductsApi';
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

export const CategoryManagement: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const { data: categories = [], isLoading, isFetching, refetch } = useGetAdminCategoriesQuery();
  
  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateCategoryMutation();
  const [archiveCategory, { isLoading: isArchiving }] = useArchiveCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchInput.toLowerCase()) || 
    c.slug.toLowerCase().includes(searchInput.toLowerCase())
  );

  const openModal = (cat?: AdminCategory) => {
    if (cat) {
      setEditingCat(cat);
      setForm({ name: cat.name, description: cat.description || '' });
    } else {
      setEditingCat(null);
      setForm({ name: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCat(null);
    setForm({ name: '', description: '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCat) {
        await updateCategory({ id: editingCat._id, data: form }).unwrap();
        setToast({ type: 'success', message: 'Category updated successfully.' });
      } else {
        await createCategory(form).unwrap();
        setToast({ type: 'success', message: 'Category created successfully.' });
      }
      closeModal();
      refetch();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.data?.message || 'Action failed.' });
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm('Are you sure you want to archive this category? It will be hidden from the storefront.')) return;
    try {
      await archiveCategory(id).unwrap();
      setToast({ type: 'success', message: 'Category archived.' });
      refetch();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.data?.message || 'Action failed.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category? Products using this category might be affected.')) return;
    try {
      await deleteCategory(id).unwrap();
      setToast({ type: 'success', message: 'Category deleted.' });
      refetch();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.data?.message || 'Failed to delete. Make sure no products are using it.' });
    }
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Category Management</h1>
          <p className="text-sm text-slate-500 mt-1">Organize your product catalog with categories.</p>
        </div>
        <div className="flex items-center gap-3">
          <AppButton variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching && !isLoading}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </AppButton>
          <AppButton variant="primary" size="md" onClick={() => openModal()}>
            <Plus className="w-4 h-4 mr-1.5" /> New Category
          </AppButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Categories"
          value={categories.length.toLocaleString()}
          changePercentage={0}
          changeText="Active & Archived"
          icon={FolderTree}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-700"
        />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] transition"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Slug</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold">Status</th>
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
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" /> No categories found.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat._id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">{cat.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{cat.slug}</td>
                    <td className="px-6 py-4 text-slate-600 truncate max-w-xs">{cat.description || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cat.status === 'archived' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {cat.status === 'archived' ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openModal(cat)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleArchive(cat._id)} disabled={isArchiving} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition disabled:opacity-50" title="Archive">
                        <Archive className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(cat._id)} disabled={isDeleting} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg">{editingCat ? 'Edit Category' : 'New Category'}</h3>
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
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <AppButton type="button" variant="outline" onClick={closeModal}>Cancel</AppButton>
                <AppButton type="submit" variant="primary" isLoading={isCreating || isUpdating}>Save Category</AppButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;
