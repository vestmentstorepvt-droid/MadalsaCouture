import React, { useState } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { AppButton } from '../../components/ui/button/AppButton';
import { Pagination } from '../../components/ui/pagination/Pagination';
import {
  useGetAdminTagsQuery,
  useCreateTagMutation,
  useDeleteTagMutation,
} from '../../services/tagsApi';

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

export const TagManagement: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isFetching, refetch } = useGetAdminTagsQuery({ search: debouncedSearch, page, limit });
  const tags = data?.data || [];
  const totalItems: number = data?.meta?.pagination?.total ?? data?.meta?.total ?? tags.length;
  
  const [createTag, { isLoading: isCreating }] = useCreateTagMutation();
  const [deleteTag, { isLoading: isDeleting }] = useDeleteTagMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tagName, setTagName] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchInput);
    setPage(1);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTag({ name: tagName }).unwrap();
      setToast({ type: 'success', message: 'Tag created successfully.' });
      setIsModalOpen(false);
      setTagName('');
      refetch();
    } catch (err: any) {
      setToast({ type: 'error', message: err?.data?.message || 'Action failed.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this tag? Products using this tag will lose it.')) return;
    try {
      await deleteTag(id).unwrap();
      setToast({ type: 'success', message: 'Tag deleted.' });
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tag Management</h1>
          <p className="text-sm text-slate-500 mt-1">Organize products with searchable tags.</p>
        </div>
        <div className="flex items-center gap-3">
          <AppButton variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching && !isLoading}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </AppButton>
          <AppButton variant="primary" size="md" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Tag
          </AppButton>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSearch} className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tags..."
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
                <th className="px-6 py-4 font-semibold">Slug</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" /> Loading...
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" /> No tags found.
                  </td>
                </tr>
              ) : (
                tags.map((tag) => (
                  <tr key={tag._id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <Tag className="w-4 h-4 text-slate-400" /> {tag.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{tag.slug}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(tag.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleDelete(tag._id)} disabled={isDeleting} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50" title="Delete">
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
          itemLabel="tags"
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg">New Tag</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Tag Name *</label>
                <input
                  type="text"
                  required
                  value={tagName}
                  onChange={e => setTagName(e.target.value)}
                  placeholder="e.g. Summer Collection"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-[#E85D88] transition"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <AppButton type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</AppButton>
                <AppButton type="submit" variant="primary" isLoading={isCreating}>Create Tag</AppButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagManagement;
