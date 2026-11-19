import React, { useRef, useState, useCallback } from 'react';
import {
  Upload,
  X,
  Star,
  Image as ImageIcon,
  AlertCircle,
  FolderTree,
  ImagePlus,
} from 'lucide-react';
import { useUploadMediaMutation } from '../../../services/mediaApi';

export interface ProductImageItem {
  url: string;
  altText?: string;
  role?: 'primary' | 'gallery' | 'hover' | 'sizeChart' | 'lifestyle' | 'back' | 'side' | 'closeup';
  sortOrder?: number;
}

interface MultiImageUploaderProps {
  images: ProductImageItem[];
  onChange: (images: ProductImageItem[]) => void;
  folder?: string;
  tags?: string;
  maxFiles?: number;
}

const IMAGE_ROLE_OPTIONS = [
  { label: 'Primary (Main Cover)', value: 'primary' },
  { label: 'Gallery Photo', value: 'gallery' },
  { label: 'Hover Preview', value: 'hover' },
  { label: 'Lifestyle / Model', value: 'lifestyle' },
  { label: 'Back View', value: 'back' },
  { label: 'Side View', value: 'side' },
  { label: 'Detail / Close-up', value: 'closeup' },
  { label: 'Size Chart', value: 'sizeChart' },
];

export const MultiImageUploader: React.FC<MultiImageUploaderProps> = ({
  images = [],
  onChange,
  folder = 'Madalsa/products',
  tags,
  maxFiles = 10,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadMedia] = useUploadMediaMutation();

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setUploadError(null);
      setIsUploading(true);

      const newItems: ProductImageItem[] = [...images];
      let count = 0;
      const totalFiles = files.length;
      const allowedCount = Math.min(totalFiles, maxFiles - images.length);

      if (allowedCount <= 0) {
        setUploadError(`Maximum ${maxFiles} images allowed.`);
        setIsUploading(false);
        return;
      }

      for (let i = 0; i < allowedCount; i++) {
        const file = files[i];

        if (!file.type.startsWith('image/')) {
          setUploadError(`Skipped "${file.name}": not an image file.`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          setUploadError(`Skipped "${file.name}": exceeds 10 MB limit.`);
          continue;
        }

        count++;
        setUploadProgress(`Uploading ${count} of ${Math.min(totalFiles, allowedCount)} images to ${folder}...`);

        const formData = new FormData();
        formData.append('file', file);
        if (folder) formData.append('folder', folder);
        if (tags) formData.append('tags', tags);

        try {
          const result = await uploadMedia(formData).unwrap();
          if (result.url) {
            const isFirstImage = newItems.length === 0;
            newItems.push({
              url: result.url,
              altText: file.name.replace(/\.[^/.]+$/, ''),
              role: isFirstImage ? 'primary' : 'gallery',
              sortOrder: newItems.length,
            });
          }
        } catch (err: any) {
          console.error('Failed to upload image:', file.name, err);
          const errorMsg =
            err?.data?.error?.message ||
            err?.data?.message ||
            err?.message ||
            'Upload failed. Please check file size or network connection.';
          setUploadError(`Failed to upload "${file.name}": ${errorMsg}`);
        }
      }

      setIsUploading(false);
      setUploadProgress('');
      onChange(newItems);

      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [images, folder, tags, maxFiles, uploadMedia, onChange]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading && images.length < maxFiles) setIsDragging(true);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await processFiles(files);
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, idx) => idx !== index);
    if (updated.length > 0 && !updated.some((img) => img.role === 'primary')) {
      updated[0].role = 'primary';
    }
    onChange(updated);
  };

  const handleSetPrimary = (index: number) => {
    const updated = images.map((img, idx) => ({
      ...img,
      role: idx === index ? ('primary' as const) : img.role === 'primary' ? ('gallery' as const) : img.role,
    }));
    onChange(updated);
  };

  // When changing role via dropdown: if new role is 'primary', clear it from all others first
  const handleUpdateRole = (index: number, newRole: string) => {
    const updated = images.map((img, idx) => {
      if (idx === index) {
        return { ...img, role: newRole as ProductImageItem['role'] };
      }
      // If another image was primary and this one is now becoming primary, demote it to gallery
      if (newRole === 'primary' && img.role === 'primary') {
        return { ...img, role: 'gallery' as const };
      }
      return img;
    });
    onChange(updated);
  };

  const handleUpdateField = (
    index: number,
    field: keyof ProductImageItem,
    value: string
  ) => {
    const updated = [...images];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const canAddMore = images.length < maxFiles && !isUploading;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-semibold text-slate-700 block">
            Product Images & Gallery ({images.length}/{maxFiles})
          </label>
          <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
            <FolderTree className="w-3.5 h-3.5 text-accent" />
            Folder: <strong className="text-slate-700">{folder}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAddMore}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 text-accent hover:bg-pink-100 text-xs font-semibold transition disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {isUploading ? 'Uploading...' : 'Add Images'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploadProgress && (
        <div className="p-2.5 rounded-xl bg-pink-50/70 border border-pink-200 text-accent text-xs font-medium flex items-center gap-2 animate-pulse">
          <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin shrink-0" />
          <span>{uploadProgress}</span>
        </div>
      )}

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* ── Empty State / Full-area Dropzone ── */}
      {images.length === 0 ? (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => canAddMore && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && canAddMore && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-ink bg-rose-50/60 scale-[1.01] shadow-md'
              : 'border-slate-200 hover:border-ink hover:bg-pink-50/20'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
              isDragging ? 'bg-ink/10 border-2 border-ink border-dashed' : 'bg-pink-50'
            } text-accent`}
          >
            {isDragging ? (
              <ImagePlus className="w-7 h-7 animate-bounce" />
            ) : (
              <ImageIcon className="w-7 h-7" />
            )}
          </div>
          <div>
            {isDragging ? (
              <p className="text-sm font-bold text-accent">Drop your images here!</p>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-800">
                  <span className="text-accent">Click to upload</span> or drag & drop images
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Front cover, back view, close-ups, model shoots · PNG, JPG, WebP up to 10 MB
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  You can drop multiple files at once (max {maxFiles})
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Image Gallery Cards + trailing drop zone ── */
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`space-y-3 relative p-4 -m-4 rounded-xl transition-all ${
            isDragging ? 'bg-pink-50/50 ring-2 ring-inset ring-ink border border-dashed border-ink' : ''
          }`}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
              <div className="flex flex-col items-center gap-2">
                <ImagePlus className="w-10 h-10 text-accent animate-bounce" />
                <span className="text-sm font-bold text-accent">Drop images here to add</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, idx) => {
              const isPrimary = img.role === 'primary';

              return (
                <div
                  key={idx}
                  className={`relative rounded-xl border overflow-hidden bg-slate-50 flex flex-col justify-between transition-all ${
                    isPrimary
                      ? 'border-ink ring-2 ring-ink/20 shadow-xs'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Thumbnail Preview */}
                  <div className="relative aspect-square bg-slate-100 overflow-hidden flex items-center justify-center group">
                    <img
                      src={img.url}
                      alt={img.altText || `Product Image ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Primary Badge */}
                    {isPrimary && (
                      <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-ink text-white text-xs font-bold uppercase tracking-wider shadow-xs flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" /> Primary
                      </span>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white transition"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    {/* Set Primary Action */}
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(idx)}
                        className="absolute bottom-1.5 inset-x-1.5 py-1 rounded-md bg-black/60 hover:bg-ink text-white text-xs font-semibold transition text-center opacity-0 group-hover:opacity-100 backdrop-blur-xs"
                      >
                        Make Primary
                      </button>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="p-2 bg-white space-y-1.5 border-t border-slate-100">
                    <select
                      value={img.role || 'gallery'}
                      onChange={(e) => handleUpdateRole(idx, e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ink"
                    >
                      {IMAGE_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={img.altText || ''}
                      onChange={(e) => handleUpdateField(idx, 'altText', e.target.value)}
                      placeholder="Alt text / description"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ink"
                    />
                  </div>
                </div>
              );
            })}

            {/* ── Add More Tile ── */}
            {canAddMore && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-xl border-2 border-dashed aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-ink bg-rose-50/60 scale-[1.02]'
                    : 'border-slate-200 hover:border-ink hover:bg-pink-50/20'
                }`}
              >
                {isDragging ? (
                  <ImagePlus className="w-7 h-7 text-accent animate-bounce" />
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-accent" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500 text-center px-2">
                      Add more or drop here
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Drag over hint bar */}
          {isDragging && (
            <div className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-ink bg-rose-50/40 flex items-center justify-center gap-2 text-accent text-sm font-semibold animate-pulse">
              <ImagePlus className="w-4 h-4" />
              Drop images to add them
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiImageUploader;
