import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, ImagePlus, Film } from 'lucide-react';
import { uploadMediaFormData } from '../../../services/directUpload';

interface ImageUploaderProps {
  imageUrl: string;
  onUploaded: (url: string) => void;
  onClear: () => void;
  label?: string;
  hint?: string;
  folder?: string;
  tags?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  acceptType?: 'image' | 'video' | 'any';
  maxSizeBytes?: number;
  maxVideoDimensions?: { width: number; height: number; aspectRatio?: number };
}

const getVideoDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const { videoWidth: width, videoHeight: height } = video;
      cleanup();
      if (!width || !height) {
        reject(new Error('Video dimensions could not be read.'));
        return;
      }
      resolve({ width, height });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Video details could not be read. Please use an MP4 video.'));
    };
    video.src = objectUrl;
  });

// Uploads go straight to storage (see services/directUpload.ts); the API only
// signs and registers the file. Same promise contract as before: resolves to the URL.
function uploadWithXhr(
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<string> {
  return uploadMediaFormData(formData, onProgress).then((r) => {
    if (!r.url) throw new Error('Upload succeeded but no URL was returned.');
    return r.url;
  });
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  imageUrl,
  onUploaded,
  onClear,
  label = 'Media File',
  hint,
  folder,
  tags,
  aspectRatio = 'auto',
  acceptType = 'image',
  maxSizeBytes,
  maxVideoDimensions,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const defaultHint = acceptType === 'video'
    ? 'MP4, MOV, WebM · Max 20 MB'
    : acceptType === 'any'
    ? 'Images or Videos · Max 20 MB'
    : 'PNG, JPG, WebP · Max 10 MB';
  const displayHint = hint || defaultHint;

  const processFile = useCallback(
    async (file: File) => {
      setUploadError(null);

      if (acceptType === 'image' && !file.type.startsWith('image/')) {
        setUploadError('Only image files are accepted.');
        return;
      }
      if (acceptType === 'video' && !file.type.startsWith('video/')) {
        setUploadError('Only video files are accepted.');
        return;
      }
      if (acceptType === 'any' && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setUploadError('Only image and video files are accepted.');
        return;
      }

      const maxSize = maxSizeBytes ?? (acceptType === 'video' || acceptType === 'any' ? 20 * 1024 * 1024 : 10 * 1024 * 1024);
      if (file.size > maxSize) {
        setUploadError(`File too large. Maximum allowed size is ${Math.floor(maxSize / (1024 * 1024))} MB.`);
        return;
      }

      if (acceptType === 'video' && maxVideoDimensions) {
        try {
          const dimensions = await getVideoDimensions(file);
          const ratio = dimensions.width / dimensions.height;
          const ratioMismatch = maxVideoDimensions.aspectRatio !== undefined
            && Math.abs(ratio - maxVideoDimensions.aspectRatio) > 0.02;
          if (dimensions.width > maxVideoDimensions.width || dimensions.height > maxVideoDimensions.height || ratioMismatch) {
            setUploadError(`Video must be portrait 2:3 ratio (e.g. 720 × 1080 px) and no larger than ${maxVideoDimensions.width} × ${maxVideoDimensions.height} px.`);
            return;
          }
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : 'Video details could not be read.');
          return;
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      if (folder) formData.append('folder', folder);
      if (tags) formData.append('tags', tags);

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const url = await uploadWithXhr(formData, setUploadProgress);
        onUploaded(url);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [acceptType, folder, tags, maxSizeBytes, maxVideoDimensions, onUploaded]
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'portrait'
      ? 'aspect-[2/3]'
      : 'min-h-32';

  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}

      {imageUrl ? (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center transition-all ${aspectClass} ${
            isDragging ? 'ring-2 ring-inset ring-[#E85D88] opacity-80' : ''
          }`}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm">
              <ImagePlus className="w-8 h-8 text-[#E85D88] animate-bounce" />
            </div>
          )}
          {/\.(mp4|mov|webm|ogg|m4v)($|\?)/i.test(imageUrl) || acceptType === 'video' ? (
            <video
              src={imageUrl}
              className="max-h-full max-w-full object-contain"
              controls
              muted
              playsInline
            />
          ) : (
            <img
              src={imageUrl}
              alt="Uploaded preview"
              className="max-h-full max-w-full object-contain"
            />
          )}
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-slate-600 hover:text-rose-500 transition-colors"
            aria-label="Remove media"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-black/50 py-1.5 text-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-white/90 hover:text-white underline"
            >
              Replace media
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && !isUploading && fileInputRef.current?.click()}
          aria-label={`Upload ${label}`}
          className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${aspectClass} ${
            isUploading
              ? 'border-slate-200 bg-slate-50 cursor-wait'
              : isDragging
              ? 'border-[#E85D88] bg-rose-50/60 scale-[1.01] shadow-md cursor-copy'
              : 'border-slate-200 hover:border-[#E85D88] hover:bg-rose-50/30 cursor-pointer'
          }`}
        >
          {isUploading ? (
            <>
              <div className="w-6 h-6 border-2 border-[#E85D88] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500">
                {uploadProgress !== null && uploadProgress < 99
                  ? `Uploading ${uploadProgress}%…`
                  : 'Processing…'}
              </span>
              {uploadProgress !== null && uploadProgress < 99 && (
                <div className="w-32 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#E85D88] h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </>
          ) : isDragging ? (
            <>
              <div className="w-12 h-12 rounded-full bg-[#E85D88]/10 border-2 border-[#E85D88] border-dashed flex items-center justify-center animate-bounce">
                {acceptType === 'video' ? (
                  <Film className="w-6 h-6 text-[#E85D88]" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-[#E85D88]" />
                )}
              </div>
              <p className="text-sm font-semibold text-[#E85D88]">
                {acceptType === 'video' ? 'Drop video here' : 'Drop image here'}
              </p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                {acceptType === 'video' ? (
                  <Film className="w-5 h-5 text-[#E85D88]" />
                ) : (
                  <Upload className="w-5 h-5 text-[#E85D88]" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">
                  <span className="text-[#E85D88] font-semibold">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{displayHint}</p>
                {folder && (
                  <p className="text-[10px] text-slate-400 font-mono mt-1">📁 {folder}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={
          acceptType === 'image'
            ? 'image/*'
            : acceptType === 'video'
            ? 'video/*'
            : 'image/*,video/*'
        }
        className="hidden"
        onChange={handleFile}
        aria-label={`Upload ${label}`}
      />

      {uploadError && <p className="text-xs text-rose-500 mt-1">⚠️ {uploadError}</p>}
    </div>
  );
};

export default ImageUploader;
