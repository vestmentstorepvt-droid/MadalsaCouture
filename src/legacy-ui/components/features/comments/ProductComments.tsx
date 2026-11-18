import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import {
  useGetCommentsQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
} from '../../../services/commentsApi';
import { Star, Send, Trash2, ChevronLeft, ChevronRight, MessageSquare, Quote, X, Pen, ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, User as UserIcon, Mail, Film, BadgeCheck, Play } from 'lucide-react';

interface ProductCommentsProps {
  productId: string;
}

const STARS = [1, 2, 3, 4, 5];
const MAX_FILES = 5;
const MAX_FILE_MB = 25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GUEST_KEY = 'madalsa_review_guest';

type ModalStep = 'rating' | 'message' | 'details' | 'media' | 'publish';

const STEP_LABELS: Record<ModalStep, string> = {
  rating: 'Rating',
  message: 'Message',
  details: 'Details',
  media: 'Media',
  publish: 'Publish',
};

const ProductComments: React.FC<ProductCommentsProps> = ({ productId }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [page, setPage] = useState(1);
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Guest details (remembered locally so returning guests don't retype)
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [detailsTouched, setDetailsTouched] = useState(false);

  // Optional media
  const [files, setFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), isVideo: f.type.startsWith('video/'), name: f.name })),
    [files]
  );
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null');
      if (saved?.name) setGuestName(saved.name);
      if (saved?.email) setGuestEmail(saved.email);
    } catch { /* ignore */ }
  }, []);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('rating');

  const steps: ModalStep[] = isAuthenticated
    ? ['rating', 'message', 'media', 'publish']
    : ['rating', 'message', 'details', 'media', 'publish'];
  const goNext = () => {
    const i = steps.indexOf(modalStep);
    if (i < steps.length - 1) setModalStep(steps[i + 1]);
  };
  const goPrev = () => {
    const i = steps.indexOf(modalStep);
    if (i > 0) setModalStep(steps[i - 1]);
  };

  const nameValid = guestName.trim().length >= 2;
  const emailValid = EMAIL_RE.test(guestEmail.trim());
  const displayName = isAuthenticated ? user?.name || 'User' : guestName.trim();
  const displayEmail = isAuthenticated ? user?.email || '' : guestEmail.trim();

  const handleFilesSelected = (list: FileList | null) => {
    if (!list) return;
    setMediaError(null);
    const incoming = Array.from(list);
    const valid: File[] = [];
    for (const f of incoming) {
      if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
        setMediaError('Only images and videos are allowed.');
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setMediaError(`Each file must be under ${MAX_FILE_MB} MB.`);
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => {
      const merged = [...prev, ...valid];
      if (merged.length > MAX_FILES) setMediaError(`You can upload up to ${MAX_FILES} files.`);
      return merged.slice(0, MAX_FILES);
    });
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const { data, isLoading, isFetching } = useGetCommentsQuery(
    { productId, page, limit: 6 },
    { skip: !productId }
  );

  const [createComment] = useCreateCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();

  const comments = data?.comments ?? [];
  const avgRating: number | null = data?.avgRating ?? null;
  const ratingCount = data?.ratingCount ?? 0;
  const distribution = data?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const totalComments = pagination?.total ?? 0;

  const myId: string | undefined = (user as any)?._id ?? (user as any)?.id;

  const userComment = useMemo(() => {
    if (!myId) return null;
    return comments.find((c) => c.user?._id === myId);
  }, [comments, myId]);

  // Pre-fill form if user already has a comment
  useEffect(() => {
    if (userComment) {
      setBody(userComment.body || '');
      setRating(userComment.rating || 0);
    }
  }, [userComment]);

  const openModal = useCallback(() => {
    setSubmitError(null);
    setSubmitSuccess(false);
    setModalStep('rating');
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSubmitError(null);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) closeModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, closeModal]);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await createComment({
        productId,
        body: body.trim(),
        rating: rating > 0 ? rating : null,
        ...(isAuthenticated ? {} : { name: guestName.trim(), email: guestEmail.trim() }),
        files,
      }).unwrap();
      if (!isAuthenticated) {
        localStorage.setItem(GUEST_KEY, JSON.stringify({ name: guestName.trim(), email: guestEmail.trim() }));
      }
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        closeModal();
        setBody('');
        setRating(0);
        setFiles([]);
        setPage(1);
      }, 1500);
    } catch (err: any) {
      setSubmitError(
        err?.data?.error?.message || err?.data?.message || 'Failed to post. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Remove your feedback?')) return;
    try {
      await deleteComment(productId).unwrap();
      setBody('');
      setRating(0);
      closeModal();
    } catch {
      // silent
    }
  };

  const handleNextFromMessage = () => goNext();

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      }).format(d);
    } catch {
      return '';
    }
  };

  const renderStarsStatic = (value: number, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
    return STARS.map((s) => (
      <Star
        key={s}
        className={`${sizeClass} ${s <= value ? 'fill-[#D4AF37] text-[#D4AF37]' : 'fill-none text-stone-300'}`}
      />
    ));
  };

  const renderStarsInteractive = (size: 'md' | 'lg' = 'md') => {
    const sizeClass = size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';
    return STARS.map((s) => {
      const active = s <= (hoverRating || rating);
      return (
        <button
          key={s}
          type="button"
          onClick={() => setRating(s === rating ? 0 : s)}
          onMouseEnter={() => setHoverRating(s)}
          className="group/star rounded-md p-1 cursor-pointer transition-transform duration-150 ease-out hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
          aria-label={`${s} star`}
          aria-pressed={rating === s}
        >
          <Star
            className={`${sizeClass} transition-colors duration-200 ease-out ${active
              ? 'fill-[#D4AF37] text-[#D4AF37]'
              : 'fill-none text-stone-300 group-hover/star:text-[#D4AF37]/60'
              }`}
          />
        </button>
      );
    });
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const getRatingLabel = (r: number) => {
    if (r >= 5) return 'Exceptional';
    if (r >= 4) return 'Excellent';
    if (r >= 3) return 'Good';
    if (r >= 2) return 'Fair';
    return 'Poor';
  };

  // ── Step indicators ──
  const stepIndex = Math.max(0, steps.indexOf(modalStep));

  return (
    <section id="product-comments" className="mt-16">
      {/* ── Decorative divider ── */}
      <div className="relative flex items-center justify-center py-6">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />
        <div className="relative z-10 flex items-center gap-2 bg-[#FAF7F2] px-6">
          <MessageSquare className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-[18px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Reviews & Feedback</span>
          <MessageSquare className="h-4 w-4 text-[#D4AF37] scale-x-[-1]" />
        </div>
      </div>


      {/* ── Floating Review Modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal card */}
          <div
            className="relative w-full max-w-md rounded-2xl border border-[#E2D9CC] bg-white shadow-2xl overflow-hidden"
            style={{ animation: 'slideUp 0.3s ease-out' }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-all hover:bg-stone-200 hover:text-stone-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal header */}
            <div className="bg-gradient-to-r from-[#2D211A] to-[#3D2C24] px-6 py-5">
              <h3 className="text-[15px] font-semibold text-[#FAF7F2] tracking-wide">
                {userComment ? 'Update Your Review' : 'Share Your Experience'}
              </h3>
              <p className="text-[11px] text-[#D4AF37]/70 tracking-wider uppercase mt-1">
                Step {stepIndex + 1} of {steps.length}
              </p>

              {/* Step indicators */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {steps.map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${i <= stepIndex
                        ? 'bg-[#D4AF37] text-[#2D211A] shadow-sm'
                        : 'bg-white/10 text-white/40'
                        }`}
                    >
                      {i + 1}
                    </div>
                    <span className={`text-[10px] tracking-wider transition-colors ${i <= stepIndex ? 'text-[#D4AF37]' : 'text-white/30'}`}>
                      {STEP_LABELS[s]}
                    </span>
                    {i < steps.length - 1 && <div className={`h-px w-3 transition-colors ${i < stepIndex ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal body — step content */}
            <div className="p-6" style={{ minHeight: '200px' }}>

              {/* ── Step 1: Rating ── */}
              {modalStep === 'rating' && (
                <div className="flex flex-col items-center gap-6" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[#2D211A] mb-1">How would you rate this product?</p>
                    <p className="text-[11px] text-stone-400 tracking-wide">Tap a star to select your rating</p>
                  </div>

                  <div
                    className="flex items-center gap-1.5"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {renderStarsInteractive('lg')}
                  </div>

                  <div className="flex min-h-7 items-center justify-center text-center">
                    <span
                      className={`text-lg font-bold text-[#D4AF37] transition-opacity duration-200 ${
                        hoverRating || rating ? 'opacity-100' : 'opacity-0'
                      }`}
                      aria-live="polite"
                    >
                      {getRatingLabel(hoverRating || rating || 1)}
                    </span>
                  </div>

                  <div className="flex w-full justify-end pt-2">
                    <button
                      type="button"
                      disabled={rating === 0}
                      onClick={() => setModalStep('message')}
                      className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-200 ${rating === 0
                        ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        : 'bg-[#2D211A] text-[#FAF7F2] hover:bg-[#3D2C24] hover:shadow-lg active:scale-[0.98]'
                        }`}
                    >
                      Next
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Message ── */}
              {modalStep === 'message' && (
                <div className="flex flex-col gap-5" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  <div>
                    <p className="text-[13px] font-semibold text-[#2D211A] mb-1">Write your review</p>
                    <p className="text-[11px] text-stone-400 tracking-wide">Tell others what you loved (or didn't) about this piece</p>
                  </div>

                  {/* Show selected rating */}
                  <div className="flex items-center gap-2 text-[11px] text-stone-500">
                    <span className="font-semibold uppercase tracking-wider">Your rating:</span>
                    <div className="flex items-center gap-0.5">
                      {renderStarsStatic(rating, 'sm')}
                    </div>
                    <span className="font-semibold text-[#D4AF37]">{getRatingLabel(rating)}</span>
                  </div>

                  <div className="relative">
                    <textarea
                      id="review-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Share your thoughts — the craftsmanship, the feel, the fit…"
                      maxLength={1000}
                      rows={4}
                      className="w-full resize-none rounded-xl border border-[#E2D9CC] bg-[#FDFBF7] px-4 py-3 text-[14px] text-[#2D211A] placeholder:text-stone-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none transition-all leading-relaxed"
                      autoFocus
                    />
                    <span className="absolute bottom-3 right-4 text-[10px] text-stone-400">
                      {body.length}/1000
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setModalStep('rating')}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-stone-600 border border-stone-300 hover:bg-stone-50 transition-all"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Previous
                    </button>

                    <button
                      type="button"
                      disabled={!body.trim()}
                      onClick={handleNextFromMessage}
                      className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-200 ${!body.trim()
                        ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        : 'bg-[#2D211A] text-[#FAF7F2] hover:bg-[#3D2C24] hover:shadow-lg active:scale-[0.98]'
                        }`}
                    >
                      Continue
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: Guest details ── */}
              {modalStep === 'details' && (
                <div className="flex flex-col gap-5" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  <div>
                    <p className="text-[13px] font-semibold text-[#2D211A] mb-1">Tell us about you</p>
                    <p className="text-[11px] text-stone-400 tracking-wide">No sign-up needed — your review will be posted with this name</p>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Your Name</span>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <input
                        id="review-guest-name"
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        maxLength={60}
                        autoFocus
                        className="w-full rounded-xl border border-[#E2D9CC] bg-[#FDFBF7] pl-10 pr-4 py-3 text-[14px] text-[#2D211A] placeholder:text-stone-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none transition-all"
                      />
                    </div>
                    {detailsTouched && !nameValid && (
                      <span className="text-[11px] text-rose-600">Please enter at least 2 characters.</span>
                    )}
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Email Address</span>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                      <input
                        id="review-guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-[#E2D9CC] bg-[#FDFBF7] pl-10 pr-4 py-3 text-[14px] text-[#2D211A] placeholder:text-stone-400 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 focus:outline-none transition-all"
                      />
                    </div>
                    {detailsTouched && !emailValid && (
                      <span className="text-[11px] text-rose-600">Please enter a valid email.</span>
                    )}
                    <span className="text-[10px] text-stone-400">Your email won't be shown publicly.</span>
                  </label>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={goPrev}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-stone-600 border border-stone-300 hover:bg-stone-50 transition-all"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Previous
                    </button>
                    <button
                      id="review-details-continue"
                      type="button"
                      onClick={() => {
                        setDetailsTouched(true);
                        if (nameValid && emailValid) goNext();
                      }}
                      className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase bg-[#2D211A] text-[#FAF7F2] hover:bg-[#3D2C24] hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                    >
                      Continue
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: Media (optional) ── */}
              {modalStep === 'media' && (
                <div className="flex flex-col gap-5" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  <div>
                    <p className="text-[13px] font-semibold text-[#2D211A] mb-1">
                      Add photos or videos <span className="text-stone-400 font-normal">(optional)</span>
                    </p>
                    <p className="text-[11px] text-stone-400 tracking-wide">
                      Up to {MAX_FILES} files, {MAX_FILE_MB} MB each
                    </p>
                  </div>

                  {files.length < MAX_FILES && (
                    <label
                      htmlFor="review-media-input"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); handleFilesSelected(e.dataTransfer.files); }}
                      className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E2D9CC] bg-[#FDFBF7] px-4 py-7 text-center transition-all hover:border-[#D4AF37] hover:bg-[#FAF5EA]"
                    >
                      <div className="flex items-center gap-2 text-[#D4AF37]">
                        <ImagePlus className="h-6 w-6 transition-transform group-hover:scale-110" />
                        <Film className="h-6 w-6 transition-transform group-hover:scale-110" />
                      </div>
                      <span className="text-[12px] font-semibold text-[#2D211A]">Click or drop files here</span>
                      <span className="text-[10px] text-stone-400">JPG, PNG, WEBP, MP4, MOV…</span>
                      <input
                        id="review-media-input"
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }}
                      />
                    </label>
                  )}

                  {previews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {previews.map((p, i) => (
                        <div key={p.url} className="group/thumb relative aspect-square overflow-hidden rounded-lg border border-[#E2D9CC] bg-stone-100">
                          {p.isVideo ? (
                            <video src={p.url} className="h-full w-full object-cover" muted />
                          ) : (
                            <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                          )}
                          {p.isVideo && (
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Video</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition hover:bg-rose-600"
                            aria-label="Remove file"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {mediaError && (
                    <p className="text-[12px] text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{mediaError}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={goPrev}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-stone-600 border border-stone-300 hover:bg-stone-50 transition-all"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Previous
                    </button>
                    <button
                      id="review-media-continue"
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase bg-[#2D211A] text-[#FAF7F2] hover:bg-[#3D2C24] hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                    >
                      {files.length > 0 ? 'Continue' : 'Skip'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Publish ── */}
              {modalStep === 'publish' && (
                <div className="flex flex-col gap-5" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  {submitSuccess ? (
                    <div className="flex flex-col items-center gap-4 py-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                      </div>
                      <p className="text-[15px] font-semibold text-emerald-700">Published successfully!</p>
                      <p className="text-[12px] text-stone-500">Thank you for sharing your experience</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-[13px] font-semibold text-[#2D211A] mb-1">Review Summary</p>
                        <p className="text-[11px] text-stone-400 tracking-wide">Review your feedback before publishing</p>
                      </div>

                      {/* User info card */}
                      <div className="flex items-center gap-3 rounded-xl border border-[#E2D9CC] bg-[#FDFBF7] px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#A88B50] text-white text-[13px] font-bold shadow-sm">
                          {getInitials(displayName)}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#2D211A]">{displayName}</p>
                          <p className="text-[11px] text-stone-400">{displayEmail}</p>
                        </div>
                        {isAuthenticated && (
                          <div className="ml-auto flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Signed in</span>
                          </div>
                        )}
                      </div>

                      {/* Rating preview */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Rating:</span>
                        <div className="flex items-center gap-0.5">
                          {renderStarsStatic(rating, 'md')}
                        </div>
                        <span className="text-[11px] font-semibold text-[#D4AF37]">{getRatingLabel(rating)}</span>
                      </div>

                      {/* Message preview */}
                      <div className="rounded-xl border border-[#E2D9CC] bg-[#FDFBF7] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2">Your Review:</p>
                        <p className="text-[13.5px] leading-relaxed text-[#4A4039] whitespace-pre-wrap">{body}</p>
                      </div>

                      {previews.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {previews.map((p) => (
                            <div key={p.url} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#E2D9CC]">
                              {p.isVideo ? (
                                <video src={p.url} className="h-full w-full object-cover" muted />
                              ) : (
                                <img src={p.url} alt="" className="h-full w-full object-cover" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {submitError && (
                        <p className="text-[12px] text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{submitError}</p>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={goPrev}
                          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-stone-600 border border-stone-300 hover:bg-stone-50 transition-all"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Previous
                        </button>

                        <div className="flex items-center gap-2">
                          {userComment && (
                            <button
                              type="button"
                              onClick={handleDelete}
                              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[11px] font-medium text-rose-600 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleSubmit}
                            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-200 ${submitting
                              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-[#2D211A] to-[#3D2C24] text-[#FAF7F2] hover:shadow-lg active:scale-[0.98]'
                              }`}
                          >
                            {submitting ? (
                              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            {submitting ? (files.length > 0 ? 'Uploading…' : 'Publishing…') : userComment ? 'Update' : 'Publish'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ── Reviews layout: summary sidebar + list ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Sidebar */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 rounded-2xl border border-[#E2D9CC] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl text-[#2D211A] tracking-wide leading-tight">
              What Our Customers Say
            </h2>
            <p className="text-[12px] text-stone-500 mt-1 tracking-wide">
              Real experiences from those who chose Madalsa
            </p>

            <div className="mt-6 flex items-end gap-4">
              <span className="text-5xl font-bold text-[#2D211A] leading-none">
                {avgRating !== null ? avgRating.toFixed(1) : '–'}
              </span>
              <div className="pb-0.5">
                <div className="flex items-center gap-0.5">
                  {renderStarsStatic(Math.round(avgRating ?? 0), 'md')}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  {avgRating !== null && (
                    <span className="font-semibold text-[#D4AF37] mr-1">{getRatingLabel(avgRating)} ·</span>
                  )}
                  {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                </p>
              </div>
            </div>

            {/* Star breakdown */}
            <div className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = distribution[s as 1 | 2 | 3 | 4 | 5] ?? 0;
                const pct = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
                return (
                  <div key={s} className="flex items-center gap-2.5 text-[11px]">
                    <span className="flex w-7 items-center gap-0.5 font-semibold text-stone-600">
                      {s}<Star className="h-3 w-3 fill-[#D4AF37] text-[#D4AF37]" />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#C49A2C] transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-stone-400">{count}</span>
                  </div>
                );
              })}
            </div>

            <div className="my-6 h-px bg-[#E2D9CC]" />

            <p className="text-[13px] font-semibold text-[#2D211A]">Share your thoughts</p>
            <p className="text-[11px] text-stone-500 mt-1">
              {userComment
                ? "You've already reviewed this piece. Update or remove it anytime."
                : 'No sign-up needed — add photos or videos too.'}
            </p>
            <button
              id="write-review-btn"
              type="button"
              onClick={openModal}
              className="group mt-4 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#2D211A] to-[#3D2C24] px-6 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#FAF7F2] shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.01] active:scale-[0.98]"
            >
              <Pen className="h-4 w-4 text-[#D4AF37] transition-transform group-hover:rotate-[-15deg]" />
              {userComment ? 'Update Your Review' : 'Write a Review'}
            </button>
          </div>
        </aside>

        {/* Review list */}
        <div className="lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#2D211A]">
              {totalComments} {totalComments === 1 ? 'Review' : 'Reviews'}
            </h3>
            {totalPages > 1 && (
              <span className="text-[11px] text-stone-400">Page {page} of {totalPages}</span>
            )}
          </div>

      {/* ── Comments List (always visible — no auth required) ── */}
      {isLoading ? (
        <div className="rounded-2xl border border-[#E2D9CC]/80 bg-white px-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="py-6 border-b border-[#E2D9CC]/60 last:border-0 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-stone-200" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-stone-200 rounded mb-2" />
                  <div className="h-2.5 w-16 bg-stone-100 rounded" />
                </div>
              </div>
              <div className="h-3 w-full bg-stone-100 rounded mb-2" />
              <div className="h-3 w-3/4 bg-stone-100 rounded" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300/60 bg-white/50 py-16 text-center">
          <Quote className="h-8 w-8 text-[#D4AF37]/30 mx-auto mb-4 rotate-180" />
          <p className="font-serif text-lg text-stone-500 italic tracking-wide">
            No reviews yet — be the first to share your experience
          </p>
          <p className="text-[12px] text-stone-400 mt-2 tracking-wider">
            Your opinion matters to our community
          </p>
        </div>
      ) : (
        <div
          className="transition-opacity duration-300"
          style={{ opacity: isFetching ? 0.5 : 1 }}
        >
          <div className="rounded-2xl border border-[#E2D9CC]/80 bg-white px-6 shadow-sm">
            {comments.map((comment) => {
              const isOwnComment = !!myId && comment.user?._id === myId;

              return (
                <article
                  key={comment._id}
                  className="group relative py-6 border-b border-[#E2D9CC]/70 last:border-0"
                  style={{ animation: 'fadeIn 0.3s ease-out' }}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold tracking-wide shrink-0 ${isOwnComment
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#A88B50] text-white shadow-sm'
                        : 'bg-gradient-to-br from-[#F0ECE5] to-[#E5DFD3] text-[#8B7E6E]'
                        }`}
                    >
                      {getInitials(comment.user?.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + badges + date */}
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="text-[14px] font-semibold text-[#2D211A] truncate">
                            {comment.user?.name || 'Anonymous'}
                          </span>
                          {isOwnComment ? (
                            <span className="inline-flex items-center rounded-full bg-[#D4AF37]/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.15em] text-[#B8962E] uppercase ring-1 ring-[#D4AF37]/25">
                              You
                            </span>
                          ) : !comment.isGuest && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                              <BadgeCheck className="h-3.5 w-3.5" />
                              Member
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-400 shrink-0">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>

                      {/* Stars */}
                      {comment.rating ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex items-center gap-0.5">{renderStarsStatic(comment.rating)}</div>
                          <span className="text-[11px] font-semibold text-[#B8962E]">{getRatingLabel(comment.rating)}</span>
                        </div>
                      ) : null}

                      {/* Comment body */}
                      <p className="mt-3 text-[14px] leading-[1.75] text-[#4A4039] whitespace-pre-wrap break-words">
                        {comment.body}
                      </p>

                      {/* Attached media */}
                      {comment.media && comment.media.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          {comment.media.map((m, idx) => (
                            <a
                              key={idx}
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative block h-24 w-24 overflow-hidden rounded-xl border border-[#E2D9CC] bg-stone-100 transition hover:ring-2 hover:ring-[#D4AF37]/50 hover:scale-[1.03]"
                            >
                              {m.type === 'video' ? (
                                <>
                                  <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                                    <Play className="h-6 w-6 fill-white text-white" />
                                  </span>
                                </>
                              ) : (
                                <img src={m.url} alt="Review attachment" loading="lazy" className="h-full w-full object-cover" />
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-8 mt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2D9CC] bg-white text-stone-500 transition-all hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[#E2D9CC] disabled:hover:text-stone-500"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold transition-all ${p === page
                ? 'bg-[#2D211A] text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-100 hover:text-[#2D211A]'
                }`}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2D9CC] bg-white text-stone-500 transition-all hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[#E2D9CC] disabled:hover:text-stone-500"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

        </div>
      </div>
    </section>
  );
};

export default ProductComments;
