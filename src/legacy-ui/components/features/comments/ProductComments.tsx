import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, ChevronLeft, ChevronRight, Film, ImagePlus, LogIn, Pen, Play, Quote, Star, Trash2, X } from 'lucide-react';
import type { RootState } from '../../../store';
import {
  type Comment,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useGetCommentsQuery,
} from '../../../services/commentsApi';

interface ProductCommentsProps {
  productId: string;
}

const STARS = [1, 2, 3, 4, 5] as const;
const MAX_FILES = 5;
const MAX_FILE_MB = 25;
const MAX_BODY = 1000;
const PAGE_SIZE = 6;
const STAR_GOLD = 'var(--color-gold-deep)';

const RATING_LABELS: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Loved it' };

/** Same rule as the server: first name + last initial. */
const publicName = (raw?: string | null) => {
  const parts = String(raw || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Customer';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

const initials = (name?: string) => {
  const parts = String(name || '').replace('.', '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

const Stars: React.FC<{ value: number; size?: string }> = ({ value, size = 'h-4 w-4' }) => (
  <span className="flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
    {STARS.map((s) => (
      <Star
        key={s}
        className={size}
        style={s <= value ? { fill: STAR_GOLD, color: STAR_GOLD } : { color: 'var(--color-hairline-strong)' }}
        aria-hidden="true"
      />
    ))}
  </span>
);

const ReviewMedia: React.FC<{ media: NonNullable<Comment['media']> }> = ({ media }) => (
  <div className="mt-4 flex flex-wrap gap-2.5">
    {media.map((m, idx) => (
      <a
        key={idx}
        href={m.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block h-24 w-24 overflow-hidden rounded-xl border border-hairline bg-surface transition-transform hover:scale-[1.03]"
        aria-label={m.type === 'video' ? 'Open review video' : 'Open review photo'}
      >
        {m.type === 'video' ? (
          <>
            <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <Play className="h-6 w-6 fill-white text-white" aria-hidden="true" />
            </span>
          </>
        ) : (
          <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </a>
    ))}
  </div>
);

/**
 * Product reviews. Anyone can read them; writing one needs an account. The author's name comes
 * from their profile (shown as "Priya S."), so the form only asks for stars, words and optional
 * photos. One review per customer per product; posting again updates it.
 */
const ProductComments: React.FC<ProductCommentsProps> = ({ productId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const myId: string | undefined = (user as { _id?: string; id?: string } | null)?._id ?? (user as { id?: string } | null)?.id;

  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useGetCommentsQuery(
    { productId, page, limit: PAGE_SIZE, viewer: isAuthenticated ? myId ?? 'me' : 'guest' },
    { skip: !productId },
  );
  const [createComment] = useCreateCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();

  const comments = data?.comments ?? [];
  const myComment = data?.myComment ?? null;
  const avgRating = data?.avgRating ?? null;
  const ratingCount = data?.ratingCount ?? 0;
  const distribution = data?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalPages = data?.pagination?.totalPages ?? 1;
  const totalReviews = data?.pagination?.total ?? 0;

  // ── Form state ──
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), isVideo: f.type.startsWith('video/'), name: f.name })),
    [files],
  );
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const openForm = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}#product-comments` } });
      return;
    }
    setRating(myComment?.rating ?? 0);
    setBody(myComment?.body ?? '');
    setFiles([]);
    setMediaError(null);
    setSubmitError(null);
    setConfirmDelete(false);
    setIsOpen(true);
  };

  const closeForm = useCallback(() => {
    setIsOpen(false);
    openerRef.current?.focus();
  }, []);

  // Escape closes; the page behind doesn't scroll while the form is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeForm();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [isOpen, closeForm]);

  // Coming back from login with #product-comments: bring the reviews into view.
  useEffect(() => {
    if (location.hash === '#product-comments') {
      document.getElementById('product-comments')?.scrollIntoView({ block: 'start' });
    }
  }, [location.hash]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setMediaError(null);
    const valid: File[] = [];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
        setMediaError('Only photos and videos can be added.');
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
      if (merged.length > MAX_FILES) setMediaError(`You can add up to ${MAX_FILES} files.`);
      return merged.slice(0, MAX_FILES);
    });
  };

  const canPost = rating > 0 && body.trim().length > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createComment({ productId, body: body.trim(), rating, files }).unwrap();
      setNotice(myComment ? 'Your review was updated.' : 'Thank you! Your review is posted.');
      setPage(1);
      closeForm();
    } catch (err: unknown) {
      const e2 = err as { status?: number; data?: { error?: { message?: string }; message?: string }; error?: string };
      if (e2?.status === 401) {
        setSubmitError('Your session has ended. Please log in again to post your review.');
      } else {
        setSubmitError(e2?.data?.error?.message || e2?.data?.message || e2?.error || 'Your review could not be posted. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteComment(productId).unwrap();
      setNotice('Your review was removed.');
      closeForm();
    } catch {
      setSubmitError('Your review could not be removed. Please try again.');
    }
  };

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const shownRating = hoverRating || rating;

  return (
    <section id="product-comments" aria-labelledby="reviews-heading" className="mt-16 scroll-mt-32">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        {/* ── Summary + write ── */}
        <aside className="lg:col-span-4">
          <div className="rounded-2xl border border-hairline bg-white p-6 lg:sticky lg:top-32">
            <h2 id="reviews-heading" className="font-display text-3xl font-medium leading-tight text-ink">
              Customer reviews
            </h2>

            <div className="mt-5 flex items-end gap-4">
              <span className="text-5xl font-semibold leading-none text-ink tabular-nums">
                {avgRating !== null ? avgRating.toFixed(1) : '–'}
              </span>
              <div className="pb-0.5">
                <Stars value={Math.round(avgRating ?? 0)} />
                <p className="mt-1 text-sm text-mute">
                  {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = distribution[s as 1 | 2 | 3 | 4 | 5] ?? 0;
                const pct = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
                return (
                  <div key={s} className="flex items-center gap-2.5 text-sm">
                    <span className="w-8 tabular-nums text-body">{s} ★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-hairline-soft">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STAR_GOLD }} />
                    </div>
                    <span className="w-6 text-right tabular-nums text-mute">{count}</span>
                  </div>
                );
              })}
            </div>

            <div className="my-6 h-px bg-hairline-soft" />

            {isAuthenticated ? (
              <p className="text-sm text-body">
                {myComment ? 'You reviewed this piece. You can edit or remove your review.' : `Posting as ${publicName(user?.name)}.`}
              </p>
            ) : (
              <p className="text-sm text-body">Log in to review this piece. Your name comes from your account.</p>
            )}
            <button
              ref={openerRef}
              id="write-review-btn"
              type="button"
              onClick={openForm}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-ink-hover"
            >
              {isAuthenticated ? <Pen className="h-4 w-4" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
              {!isAuthenticated ? 'Log in to write a review' : myComment ? 'Edit your review' : 'Write a review'}
            </button>
            <p aria-live="polite" className="mt-3 min-h-5 text-sm text-emerald-700">
              {notice}
            </p>
          </div>
        </aside>

        {/* ── List ── */}
        <div className="lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">
              {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
            </h3>
            {totalPages > 1 && (
              <span className="text-sm text-mute">
                Page {page} of {totalPages}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-hairline bg-white px-6" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse border-b border-hairline py-6 last:border-0">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-hairline-soft" />
                    <div className="h-3 w-28 rounded bg-hairline-soft" />
                  </div>
                  <div className="mb-2 h-3 w-full rounded bg-hairline-soft" />
                  <div className="h-3 w-3/4 rounded bg-hairline-soft" />
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-hairline-strong bg-white/60 py-16 text-center">
              <Quote className="mx-auto mb-4 h-8 w-8 rotate-180 text-mute" aria-hidden="true" />
              <p className="text-base font-medium text-ink">No reviews yet</p>
              <p className="mt-1 text-sm text-mute">
                {isAuthenticated ? 'Be the first to review this piece.' : 'Log in and be the first to review this piece.'}
              </p>
            </div>
          ) : (
            <div className={`rounded-2xl border border-hairline bg-white px-6 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              {comments.map((comment) => {
                const isMine = !!myId && comment.user?._id === myId;
                return (
                  <article key={comment._id} className="border-b border-hairline py-6 last:border-0">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          isMine ? 'bg-ink text-white' : 'bg-surface text-body'
                        }`}
                        aria-hidden="true"
                      >
                        {initials(comment.user?.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-base font-medium text-ink">{comment.user?.name || 'Customer'}</span>
                            {isMine && (
                              <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-white">You</span>
                            )}
                            {comment.isVerifiedBuyer && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                                Verified buyer
                              </span>
                            )}
                          </div>
                          <time dateTime={comment.createdAt} className="shrink-0 text-sm text-mute">
                            {formatDate(comment.createdAt)}
                          </time>
                        </div>
                        {comment.rating ? (
                          <div className="mt-1.5">
                            <Stars value={comment.rating} size="h-3.5 w-3.5" />
                          </div>
                        ) : null}
                        <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-body">{comment.body}</p>
                        {comment.media && comment.media.length > 0 && <ReviewMedia media={comment.media} />}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Review pages">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-body transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    p === page ? 'bg-ink text-white' : 'text-body hover:bg-hairline-soft hover:text-ink'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-body transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>

      {/* ── Write / edit form ── */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeForm} aria-hidden="true" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-form-title"
            className="relative max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
          >
            <form onSubmit={submit} className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="review-form-title" className="font-display text-3xl font-medium leading-tight text-ink">
                    {myComment ? 'Edit your review' : 'Write a review'}
                  </h3>
                  <p className="mt-1 text-sm text-mute">Posting as {publicName(user?.name)}</p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-body transition-colors hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Stars */}
              <fieldset className="mt-6">
                <legend className="text-sm font-medium text-ink">Your rating</legend>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center" onMouseLeave={() => setHoverRating(0)}>
                    {STARS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        data-autofocus={s === 1 ? '' : undefined}
                        onClick={() => setRating(s)}
                        onMouseEnter={() => setHoverRating(s)}
                        aria-label={`${s} star${s > 1 ? 's' : ''}: ${RATING_LABELS[s]}`}
                        aria-pressed={rating === s}
                        className="rounded-md p-1 transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star
                          className="h-8 w-8"
                          style={s <= shownRating ? { fill: STAR_GOLD, color: STAR_GOLD } : { color: 'var(--color-hairline-strong)' }}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm font-medium text-ink" aria-live="polite">
                    {shownRating ? RATING_LABELS[shownRating] : ''}
                  </span>
                </div>
              </fieldset>

              {/* Words */}
              <label htmlFor="review-body" className="mt-6 block text-sm font-medium text-ink">
                Your review
              </label>
              <textarea
                id="review-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={MAX_BODY}
                rows={5}
                placeholder="How was the fabric, the fit, the finish?"
                className="mt-2 block w-full resize-y rounded-2xl border border-hairline-strong bg-white px-4 py-3 text-base leading-relaxed text-ink placeholder:text-mute focus:border-ink focus:outline-none"
              />
              <p className="mt-1 text-right text-xs tabular-nums text-mute">
                {body.length}/{MAX_BODY}
              </p>

              {/* Photos */}
              <p className="mt-4 text-sm font-medium text-ink">
                Photos or videos <span className="font-normal text-mute">(optional, up to {MAX_FILES})</span>
              </p>
              {myComment?.media && myComment.media.length > 0 && files.length === 0 && (
                <p className="mt-1 text-xs text-mute">Your earlier photos stay unless you add new ones.</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {previews.map((p, i) => (
                  <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-xl border border-hairline bg-surface">
                    {p.isVideo ? (
                      <video src={p.url} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                      aria-label={`Remove ${p.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      addFiles(e.dataTransfer.files);
                    }}
                    className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-hairline-strong text-mute transition-colors hover:border-ink hover:text-ink"
                  >
                    <span className="flex gap-1">
                      <ImagePlus className="h-5 w-5" aria-hidden="true" />
                      <Film className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs">Add</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              {mediaError && <p className="mt-2 text-sm text-rose-700">{mediaError}</p>}

              {submitError && (
                <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                {myComment ? (
                  <button
                    type="button"
                    onClick={remove}
                    onBlur={() => setConfirmDelete(false)}
                    className="inline-flex h-11 items-center gap-1.5 rounded-full border border-rose-200 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {confirmDelete ? 'Tap again to remove' : 'Remove review'}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={!canPost}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-7 text-sm font-medium text-white transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:bg-hairline-strong disabled:text-mute"
                >
                  {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />}
                  {submitting ? (files.length ? 'Uploading…' : 'Posting…') : myComment ? 'Save changes' : 'Post review'}
                </button>
              </div>
              {!canPost && !submitting && (
                <p className="mt-2 text-right text-xs text-mute">
                  {rating === 0 ? 'Choose a star rating to post.' : body.trim() ? '' : 'Write a few words to post.'}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductComments;
