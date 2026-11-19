import React, { useRef, useState } from 'react';
import {
  Copy,
  Trash2,
  Upload,
  Image as ImageIcon,
  FileText,
  Film,
  File,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Layers,
  HardDrive,
  Plus,
} from 'lucide-react';
import { AppButton } from '../../components/ui/button/AppButton';
import { AppDropdown } from '../../components/ui/dropdown/AppDropdown';
import { Pagination } from '../../components/ui/pagination/Pagination';
import { StatsCard } from '../../components/ui/cards/StatsCards';
import {
  useGetMediaQuery,
  useUploadMediaMutation,
  useDeleteMediaMutation,
  type MediaAsset,
} from '../../services/mediaApi';

// ── Constants & Helpers ───────────────────────────────────────────────────────
const PAGE_SIZE = 24;

const FOLDER_OPTIONS = [
  { label: 'All Folders', value: 'ALL' },
  { label: 'Madalsa (Root)', value: 'Madalsa' },
  { label: 'Products', value: 'products' },
  { label: 'Banners & Hero', value: 'banners' },
  { label: 'Categories', value: 'categories' },
  { label: 'Lookbook', value: 'lookbook' },
];

const RESOURCE_TYPE_OPTIONS = [
  { label: 'All Media Types', value: 'ALL' },
  { label: 'Images', value: 'image' },
  { label: 'Videos', value: 'video' },
  { label: 'Raw Files / Documents', value: 'raw' },
];

function formatBytes(bytes?: number): string {
  if (bytes == null || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function FileTypeIcon({ asset }: { asset: MediaAsset }) {
  const type = asset.resourceType || 'image';
  if (type === 'video') return <Film className="w-10 h-10 text-violet-500" />;
  if (asset.format === 'pdf') return <FileText className="w-10 h-10 text-rose-500" />;
  if (type === 'raw') return <File className="w-10 h-10 text-slate-400" />;
  return <ImageIcon className="w-10 h-10 text-pink-400" />;
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose: onCloseProp,
  onSuccess,
  showToast,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolder, setTargetFolder] = useState<string>('Madalsa');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadMedia] = useUploadMediaMutation();

  // Reset the queue whenever the modal is dismissed so stale files are never re-uploaded.
  const onClose = () => {
    setSelectedFiles([]);
    setTagsInput('');
    setUploadError(null);
    setUploadProgressMsg('');
    onCloseProp();
  };

  if (!isOpen) return null;

  const addFiles = (incoming: File[]) => {
    setUploadError(null);
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const fresh = incoming.filter((f) => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...fresh];
    });
  };

  const handleRemoveFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleModalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    let successCount = 0;
    const failedFiles: File[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgressMsg(`Uploading ${i + 1} of ${selectedFiles.length}: ${file.name}`);
      const formData = new FormData();
      formData.append('file', file);
      if (targetFolder) formData.append('folder', targetFolder);
      if (tagsInput.trim()) formData.append('tags', tagsInput.trim());

      try {
        await uploadMedia(formData).unwrap();
        successCount++;
      } catch (err: unknown) {
        failedFiles.push(file);
        console.error('Failed to upload file:', file.name, err);
      }
    }

    setIsUploading(false);
    setUploadProgressMsg('');

    if (successCount > 0) {
      onSuccess(successCount);
    }

    if (failedFiles.length === 0) {
      showToast(`Successfully uploaded ${successCount} media asset${successCount > 1 ? 's' : ''}!`);
      onClose();
      return;
    }

    // Keep only the files that failed so a retry does not duplicate the successful uploads.
    setSelectedFiles(failedFiles);
    setUploadError(
      successCount > 0
        ? `Uploaded ${successCount} file(s), but ${failedFiles.length} failed: ${failedFiles.map((f) => f.name).join(', ')}. Retry to upload the remaining files.`
        : `Failed to upload ${failedFiles.length} file(s). Please try again.`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Upload Media Assets</h2>
            <p className="text-xs text-slate-500">Upload high-res photos, lookbook assets, or videos.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 overflow-y-auto text-sm">
          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && uploadProgressMsg && (
            <div className="p-2.5 rounded-xl bg-pink-50/70 border border-pink-200 text-accent text-xs font-medium flex items-center gap-2 animate-pulse">
              <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin shrink-0" />
              <span>{uploadProgressMsg}</span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleModalDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 select-none ${
              isDragging
                ? 'border-ink bg-rose-50/60 scale-[1.01] shadow-md'
                : 'border-slate-200 hover:border-ink hover:bg-pink-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                isDragging ? 'bg-ink/10 border-2 border-ink border-dashed' : 'bg-pink-50'
              } text-accent`}
            >
              <Upload className={`w-6 h-6 ${isDragging ? 'animate-bounce' : ''}`} />
            </div>
            <div>
              {isDragging ? (
                <p className="text-sm font-bold text-accent">Release to add files!</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-800">
                    <span className="text-accent">Click to browse</span> or drag & drop files
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    PNG, JPG, WEBP, MP4, PDF up to 10 MB each
                  </p>
                  <p className="text-xs text-slate-300 mt-1">You can drop multiple files at once</p>
                </>
              )}
            </div>
          </div>

          {/* Selected Files List with per-file remove */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Queued ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''})
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-xs text-rose-500 hover:underline font-medium"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {selectedFiles.map((file, idx) => {
                  const isImageFile = file.type.startsWith('image/');
                  const isVideoFile = file.type.startsWith('video/');
                  const FileIcon = isVideoFile ? Film : isImageFile ? ImageIcon : FileText;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-700 font-medium">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-slate-400 text-xs font-mono">{formatBytes(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-0.5 rounded text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Destination Folder */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Destination Folder
            </label>
            <AppDropdown
              options={[
                { label: 'Madalsa (Root)', value: 'Madalsa' },
                { label: 'Products (/products)', value: 'products' },
                { label: 'Banners & Hero (/banners)', value: 'banners' },
                { label: 'Categories (/categories)', value: 'categories' },
                { label: 'Lookbook (/lookbook)', value: 'lookbook' },
              ]}
              value={targetFolder}
              onChange={(v) => setTargetFolder(String(v))}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Asset Tags (Optional)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. summer-2026, hero, bridal"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink"
            />
            <p className="text-xs text-slate-400 mt-1">Separate multiple tags with commas.</p>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
              disabled={isUploading}
            >
              Cancel
            </button>
            <AppButton type="submit" variant="primary" size="md" isLoading={isUploading}>
              {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? selectedFiles.length : ''} Asset(s)`}
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Asset Detail & Preview Modal ──────────────────────────────────────────────
interface AssetDetailModalProps {
  asset: MediaAsset | null;
  onClose: () => void;
  onCopyUrl: (url: string) => void;
  onDeleteClick: (asset: MediaAsset) => void;
}

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  onClose,
  onCopyUrl,
  onDeleteClick,
}) => {
  if (!asset) return null;

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
            <h2 className="text-base font-bold text-slate-900">Media Asset Details</h2>
            <p className="text-xs text-slate-500 font-mono truncate max-w-sm">{asset.cloudinaryPublicId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto text-sm">
          {/* Visual Preview */}
          <div className="relative rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center max-h-72 border border-slate-800">
            {asset.resourceType === 'image' || (!asset.resourceType && asset.url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) ? (
              <img
                src={asset.url}
                alt={asset.filename || 'asset'}
                className="max-h-72 w-full object-contain"
              />
            ) : asset.resourceType === 'video' ? (
              <video src={asset.url} controls className="max-h-72 w-full" />
            ) : (
              <div className="p-12 flex flex-col items-center gap-2 text-slate-300">
                <FileTypeIcon asset={asset} />
                <span className="text-xs font-mono">{asset.format?.toUpperCase() || 'DOCUMENT'}</span>
              </div>
            )}
          </div>

          {/* Quick Copy Link Box */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase block">
              Public CDN Delivery URL
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={asset.url}
                className="flex-1 text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 select-all"
              />
              <button
                type="button"
                onClick={() => onCopyUrl(asset.url)}
                className="px-3 py-1.5 rounded-lg bg-pink-50 text-accent text-xs font-semibold hover:bg-pink-100 transition flex items-center gap-1 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition shrink-0"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">Format</span>
              <span className="font-bold text-slate-800 uppercase text-xs">
                {asset.format || 'Auto'}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">Dimensions</span>
              <span className="font-bold text-slate-800 text-xs">
                {asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">File Size</span>
              <span className="font-bold text-slate-800 text-xs">
                {formatBytes(asset.bytes || asset.size)}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">References</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                  (asset.referenceCount ?? 0) > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {asset.referenceCount ?? 0} in use
              </span>
            </div>
          </div>

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {asset.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-400">Uploaded {formatDate(asset.createdAt)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteClick(asset);
              }}
              className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Delete Confirmation Dialog ────────────────────────────────────────────────
interface DeleteDialogProps {
  asset: MediaAsset | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({
  asset,
  onConfirm,
  onCancel,
  isDeleting,
}) => {
  if (!asset) return null;
  const hasRefs = (asset.referenceCount ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Delete Media Asset</h3>
            <p className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
              {asset.filename || asset.cloudinaryPublicId}
            </p>
          </div>
        </div>

        {hasRefs ? (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" /> Active References Warning
            </div>
            <p>
              This asset is currently in use across <strong>{asset.referenceCount}</strong> product(s)
              or banner(s). Deleting it will result in broken images on the storefront.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Are you sure you want to delete this media file from Cloudinary storage? This action cannot
            be undone.
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <AppButton
            type="button"
            variant="danger"
            size="sm"
            onClick={onConfirm}
            isLoading={isDeleting}
          >
            Delete Asset
          </AppButton>
        </div>
      </div>
    </div>
  );
};

// ── Main MediaLibrary Component ───────────────────────────────────────────────
export const MediaLibrary: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL');
  const [selectedResourceType, setSelectedResourceType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [inspectAsset, setInspectAsset] = useState<MediaAsset | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MediaAsset | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Queries & Mutations
  const { data, isLoading, isFetching, refetch } = useGetMediaQuery({
    page: currentPage,
    limit: PAGE_SIZE,
    folder: selectedFolder !== 'ALL' ? selectedFolder : undefined,
    resourceType: selectedResourceType !== 'ALL' ? (selectedResourceType as any) : undefined,
    search: searchQuery.trim() || undefined,
  });

  const [deleteMedia, { isLoading: isDeleting }] = useDeleteMediaMutation();

  const assets = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  // Stats calculation
  const totalStorageBytes = assets.reduce((acc, a) => acc + (a.bytes || a.size || 0), 0);
  const imageCount = assets.filter((a) => a.resourceType === 'image' || !a.resourceType).length;
  const videoCount = assets.filter((a) => a.resourceType === 'video').length;

  // Only assets visible on the current page/filter count as selected.
  const pageAssetIds = new Set(assets.map((a) => a.cloudinaryPublicId || a._id));
  const activeSelected = Array.from(selectedIds).filter((id) => pageAssetIds.has(id));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Copied direct CDN URL to clipboard!');
    } catch {
      showToast('Failed to copy URL.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      const publicId = pendingDelete.cloudinaryPublicId || pendingDelete._id;
      await deleteMedia(publicId).unwrap();
      showToast('Asset deleted successfully.');
      setPendingDelete(null);
      refetch();
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string; error?: { message?: string } } };
      showToast(
        apiErr?.data?.error?.message ||
          apiErr?.data?.message ||
          'Failed to delete asset. It may be in use.'
      );
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (activeSelected.length === assets.length && assets.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = assets.map((a) => a.cloudinaryPublicId || a._id);
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkDelete = async () => {
    if (activeSelected.length === 0) return;
    const inUseCount = assets.filter(
      (a) => activeSelected.includes(a.cloudinaryPublicId || a._id) && (a.referenceCount ?? 0) > 0,
    ).length;
    const warning = inUseCount > 0
      ? `

${inUseCount} of them are currently in use and may break images on the storefront.`
      : '';
    if (!window.confirm(`Delete ${activeSelected.length} selected assets? This cannot be undone.${warning}`)) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of activeSelected) {
      try {
        await deleteMedia(id).unwrap();
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (failCount > 0) {
      showToast(`Deleted ${successCount} assets. Failed to delete ${failCount} assets (they may be in use).`);
    } else {
      showToast(`Successfully deleted ${successCount} assets.`);
    }

    setSelectedIds(new Set());
    refetch();
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="alert"
          className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => refetch()}
        showToast={showToast}
      />

      <AssetDetailModal
        asset={inspectAsset}
        onClose={() => setInspectAsset(null)}
        onCopyUrl={handleCopyUrl}
        onDeleteClick={(a) => setPendingDelete(a)}
      />

      <DeleteDialog
        asset={pendingDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
        isDeleting={isDeleting}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Media Asset Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Centralized Cloudinary media repository for products, banners, lookbooks, and high-res assets.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
            size="sm"
            onClick={() => setIsUploadOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Upload Media
          </AppButton>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Cloud Assets"
          value={total.toLocaleString()}
          changePercentage={0}
          changeText="in media repository"
          icon={Layers}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-600"
        />
        <StatsCard
          title="Images (this page)"
          value={imageCount.toLocaleString()}
          changePercentage={0}
          changeText="catalog & lookbook images"
          icon={ImageIcon}
          iconBgColor="bg-pink-50"
          iconColor="text-accent"
        />
        <StatsCard
          title="Videos (this page)"
          value={videoCount.toLocaleString()}
          changePercentage={0}
          changeText="campaign videos"
          icon={Film}
          iconBgColor="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatsCard
          title="Storage (this page)"
          value={formatBytes(totalStorageBytes)}
          changePercentage={0}
          changeText="optimized CDN delivery"
          icon={HardDrive}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Filters & Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search filename or public ID..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition"
            />
          </div>

          {/* Folder Filter */}
          <div className="w-full sm:w-52">
            <AppDropdown
              options={FOLDER_OPTIONS}
              value={selectedFolder}
              onChange={(v) => {
                setSelectedFolder(String(v));
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Resource Type Filter */}
          <div className="w-full sm:w-48">
            <AppDropdown
              options={RESOURCE_TYPE_OPTIONS}
              value={selectedResourceType}
              onChange={(v) => {
                setSelectedResourceType(String(v));
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {(searchQuery || selectedFolder !== 'ALL' || selectedResourceType !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedFolder('ALL');
              setSelectedResourceType('ALL');
              setCurrentPage(1);
            }}
            className="text-xs text-accent hover:underline font-semibold self-end lg:self-center"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {activeSelected.length > 0 && (
        <div className="flex items-center justify-between bg-ink/10 border border-ink/20 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-accent">
              {activeSelected.length} asset{activeSelected.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex gap-2">
            <AppButton variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Cancel
            </AppButton>
            <AppButton variant="danger" size="sm" onClick={handleBulkDelete} isLoading={isDeleting}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete Selected
            </AppButton>
          </div>
        </div>
      )}

      {/* Media Grid Canvas */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading media library...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-pink-50 flex items-center justify-center text-accent">
              <ImageIcon className="w-8 h-8" />
            </div>
            <p className="font-bold text-slate-800 text-base">No media assets found</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Upload product photos, campaign banners, or lookbook assets to populate your library.
            </p>
            <AppButton
              variant="primary"
              size="sm"
              onClick={() => setIsUploadOpen(true)}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Upload First Asset
            </AppButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <input
                type="checkbox"
                checked={assets.length > 0 && activeSelected.length === assets.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-accent focus:ring-ink cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-500 cursor-pointer" onClick={toggleSelectAll}>
                Select All
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {assets.map((asset) => {
                const assetId = asset.cloudinaryPublicId || asset._id;
                const isSelected = selectedIds.has(assetId);
                
                return (
                  <div
                    key={assetId}
                    className={`group relative bg-slate-50 rounded-2xl border ${isSelected ? 'border-ink ring-1 ring-ink' : 'border-slate-200'} overflow-hidden shadow-xs hover:shadow-md hover:border-ink/40 transition-all flex flex-col justify-between`}
                  >
                {/* Thumbnail / Image Box */}
                <div
                  onClick={() => toggleSelect(assetId)}
                  className="relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                >
                  <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(assetId)}
                      className="w-4 h-4 rounded border-slate-300 text-accent focus:ring-ink cursor-pointer bg-white"
                    />
                  </div>

                  {asset.resourceType === 'image' || (!asset.resourceType && asset.url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) ? (
                    <img
                      src={asset.url}
                      alt={asset.filename || 'asset'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <FileTypeIcon asset={asset} />
                  )}

                  {/* Format tag badge */}
                  {asset.format && (
                    <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white font-mono text-xs uppercase tracking-wider backdrop-blur-xs">
                      {asset.format}
                    </span>
                  )}

                  {/* Reference count badge */}
                  {(asset.referenceCount ?? 0) > 0 && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-amber-500/90 text-white font-sans text-xs font-bold backdrop-blur-xs">
                      {asset.referenceCount} in use
                    </span>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:bg-black/10 [@media(hover:none)]:items-end [@media(hover:none)]:justify-end transition-opacity flex items-center justify-center gap-2 p-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectAsset(asset);
                      }}
                      className="p-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 shadow-sm transition"
                      title="Inspect Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyUrl(asset.url);
                      }}
                      className="p-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 shadow-sm transition"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(asset);
                      }}
                      className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="p-2.5 bg-white border-t border-slate-100 space-y-1">
                  <p
                    className="text-xs font-semibold text-slate-800 truncate"
                    title={asset.filename || asset.cloudinaryPublicId}
                  >
                    {asset.filename || asset.cloudinaryPublicId}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>{formatBytes(asset.bytes || asset.size)}</span>
                    <span>
                      {asset.width && asset.height ? `${asset.width}×${asset.height}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
        )}

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Pagination
              currentPage={currentPage}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="assets"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaLibrary;
