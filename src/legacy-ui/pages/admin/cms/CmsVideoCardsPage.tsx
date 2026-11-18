import React, { useState } from 'react';
import { AlertCircle, Film, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import ImageUploader from '../../../components/ui/upload/ImageUploader';
import { AppButton } from '../../../components/ui/button/AppButton';
import {
  useCreateVideoCardMutation,
  useDeleteVideoCardMutation,
  useGetVideoCardsQuery,
  useUpdateVideoCardMutation,
} from '../../../services/cmsAdminApi';
import type { CmsVideoCard, CmsVideoCardInput } from '../../../services/cmsAdminApi';
import { toDatetimeLocal } from '../../../utils/dateTime';

interface VideoCardForm {
  title: string;
  description: string;
  videoUrl: string;
  posterUrl: string;
  linkUrl: string;
  buttonText: string;
  displayOrder: string;
  status: 'active' | 'inactive';
  startsAt: string;
  endsAt: string;
}

const EMPTY_FORM: VideoCardForm = {
  title: '',
  description: '',
  videoUrl: '',
  posterUrl: '',
  linkUrl: '',
  buttonText: '',
  displayOrder: '0',
  status: 'inactive',
  startsAt: '',
  endsAt: '',
};

function toForm(card?: CmsVideoCard): VideoCardForm {
  if (!card) return EMPTY_FORM;
  return {
    title: card.title,
    description: card.description ?? '',
    videoUrl: card.videoUrl,
    posterUrl: card.posterUrl,
    linkUrl: card.linkUrl ?? '',
    buttonText: card.buttonText ?? '',
    displayOrder: String(card.displayOrder ?? 0),
    status: card.status,
    startsAt: toDatetimeLocal(card.startsAt),
    endsAt: toDatetimeLocal(card.endsAt),
  };
}

function toPayload(form: VideoCardForm): CmsVideoCardInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    videoUrl: form.videoUrl.trim(),
    posterUrl: form.posterUrl.trim(),
    linkUrl: form.linkUrl.trim(),
    buttonText: form.buttonText.trim(),
    displayOrder: Number(form.displayOrder) || 0,
    status: form.status,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
  };
}

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-[#E85D88] focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20';

const VideoCardEditor: React.FC<{
  initial: VideoCardForm;
  title: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (form: VideoCardForm) => Promise<void>;
}> = ({ initial, title, isSaving, onClose, onSave }) => {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof VideoCardForm>(field: K, value: VideoCardForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5 sm:px-7">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">Manage this video card independently from other homepage sections.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor" className="rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88]">Close</button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <ImageUploader
                imageUrl={form.videoUrl}
                onUploaded={(url) => set('videoUrl', url)}
                onClear={() => set('videoUrl', '')}
                label="Video file"
                hint="MP4 (H.264), portrait 2:3 ratio, up to 720 × 1080 px, maximum 20 MB."
                folder="Madalsa/homepage-video-cards"
                tags="homepage, video-card"
                aspectRatio="portrait"
                acceptType="video"
                maxSizeBytes={20 * 1024 * 1024}
                maxVideoDimensions={{ width: 720, height: 1080, aspectRatio: 2 / 3 }}
              />
              <label htmlFor="video-card-url" className="mt-3 block text-xs font-semibold text-slate-700">Or paste a video URL</label>
              <input id="video-card-url" type="url" value={form.videoUrl} onChange={(event) => set('videoUrl', event.target.value)} className={`${INPUT} mt-1`} placeholder="https://…" />
              <p className="mt-1 text-[11px] text-slate-500">Pasted URLs skip validation — make sure they are portrait 2:3 ratio and under 20 MB.</p>
            </div>
            <div>
              <ImageUploader
                imageUrl={form.posterUrl}
                onUploaded={(url) => set('posterUrl', url)}
                onClear={() => set('posterUrl', '')}
                label="Poster / thumbnail image"
                hint="Shown before the video plays. Portrait 2:3 ratio recommended."
                folder="Madalsa/homepage-video-cards"
                tags="homepage, video-card, poster"
                aspectRatio="portrait"
                acceptType="image"
              />
              <label htmlFor="video-card-poster-url" className="mt-3 block text-xs font-semibold text-slate-700">Or paste a poster image URL</label>
              <input id="video-card-poster-url" type="url" value={form.posterUrl} onChange={(event) => set('posterUrl', event.target.value)} className={`${INPUT} mt-1`} placeholder="https://…" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="video-card-title" className="mb-1 block text-xs font-semibold text-slate-700">Card title *</label>
              <input id="video-card-title" required maxLength={120} value={form.title} onChange={(event) => set('title', event.target.value)} className={INPUT} placeholder="e.g. Behind the collection" />
            </div>
            <div>
              <label htmlFor="video-card-order" className="mb-1 block text-xs font-semibold text-slate-700">Display position</label>
              <input id="video-card-order" type="number" min="0" value={form.displayOrder} onChange={(event) => set('displayOrder', event.target.value)} className={INPUT} />
              <p className="mt-1 text-[11px] text-slate-500">Lower numbers appear first.</p>
            </div>
          </div>

          <div>
            <label htmlFor="video-card-description" className="mb-1 block text-xs font-semibold text-slate-700">Short description (optional)</label>
            <textarea id="video-card-description" maxLength={500} rows={3} value={form.description} onChange={(event) => set('description', event.target.value)} className={`${INPUT} resize-y`} placeholder="Add a short line about this video." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="video-card-link" className="mb-1 block text-xs font-semibold text-slate-700">Product page URL for Add To Cart</label>
              <input id="video-card-link" type="text" value={form.linkUrl} onChange={(event) => set('linkUrl', event.target.value)} className={INPUT} placeholder="/product/product-slug" />
              <p className="mt-1 text-[11px] text-slate-500">The button opens this product page so shoppers can choose a size and add it to their cart.</p>
            </div>
            <div>
              <label htmlFor="video-card-button" className="mb-1 block text-xs font-semibold text-slate-700">Button text (optional)</label>
              <input id="video-card-button" maxLength={60} value={form.buttonText} onChange={(event) => set('buttonText', event.target.value)} className={INPUT} placeholder="Add To Cart" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="video-card-starts" className="mb-1 block text-xs font-semibold text-slate-700">Start showing (optional)</label>
              <input id="video-card-starts" type="datetime-local" value={form.startsAt} onChange={(event) => set('startsAt', event.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="video-card-ends" className="mb-1 block text-xs font-semibold text-slate-700">Stop showing (optional)</label>
              <input id="video-card-ends" type="datetime-local" value={form.endsAt} onChange={(event) => set('endsAt', event.target.value)} className={INPUT} />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input type="checkbox" checked={form.status === 'active'} onChange={(event) => set('status', event.target.checked ? 'active' : 'inactive')} className="mt-0.5 h-4 w-4 accent-[#E85D88]" />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Show this card on the homepage</span>
              <span className="mt-1 block text-xs text-slate-500">Turn it off to hide it without deleting the video.</span>
            </span>
          </label>

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
            <button type="button" onClick={onClose} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88]">Cancel</button>
            <AppButton type="submit" variant="primary" isLoading={isSaving} disabled={!form.videoUrl.trim() || !form.posterUrl.trim()}>
              Save video card
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CmsVideoCardsPage: React.FC = () => {
  const { data: cards = [], isLoading, isError, refetch } = useGetVideoCardsQuery();
  const [createCard, { isLoading: isCreating }] = useCreateVideoCardMutation();
  const [updateCard, { isLoading: isUpdating }] = useUpdateVideoCardMutation();
  const [deleteCard] = useDeleteVideoCardMutation();
  const [editor, setEditor] = useState<null | { mode: 'create' } | { mode: 'edit'; card: CmsVideoCard }>(null);
  const [deleteTarget, setDeleteTarget] = useState<CmsVideoCard | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);

  React.useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const save = async (form: VideoCardForm) => {
    const payload = toPayload(form);
    if (!payload.title || !payload.videoUrl || !payload.posterUrl) {
      setNotice({ message: 'Add a title, video and poster image before saving.', error: true });
      return;
    }
    try {
      if (editor?.mode === 'edit') {
        await updateCard({ id: editor.card._id, body: payload }).unwrap();
        setNotice({ message: 'Video card updated.', error: false });
      } else {
        await createCard(payload).unwrap();
        setNotice({ message: 'Video card added.', error: false });
      }
      setEditor(null);
    } catch {
      setNotice({ message: 'Could not save this video card. Please try again.', error: true });
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCard(deleteTarget._id).unwrap();
      setNotice({ message: 'Video card removed from the homepage.', error: false });
    } catch {
      setNotice({ message: 'Could not remove this video card. Please try again.', error: true });
    } finally {
      setDeleteTarget(null);
    }
  };

  const sortedCards = [...cards].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  return (
    <main className="min-h-screen space-y-6 bg-[#FAFAFC] p-4 text-slate-800 sm:p-6">
      {notice && (
        <div role="status" aria-live="polite" className={`fixed right-4 top-4 z-[60] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${notice.error ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          {notice.message}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification" className="ml-3 opacity-80 hover:opacity-100">×</button>
        </div>
      )}

      {editor && (
        <VideoCardEditor
          title={editor.mode === 'create' ? 'Add homepage video' : 'Edit homepage video'}
          initial={editor.mode === 'create' ? EMPTY_FORM : toForm(editor.card)}
          isSaving={isCreating || isUpdating}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-video-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="delete-video-title" className="text-lg font-bold text-slate-900">Remove this video card?</h2>
            <p className="mt-2 text-sm text-slate-600">“{deleteTarget.title}” will be hidden from the homepage. You can’t undo this action.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <AppButton type="button" variant="danger" onClick={remove}>Remove</AppButton>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-[#C54870]">
            <Film className="h-3.5 w-3.5" /> Homepage content
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Video cards</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Add and manage homepage videos separately from hero banners, collections and products.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => refetch()} aria-label="Refresh video cards" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88]">
            <RefreshCw className="h-4 w-4" />
          </button>
          <AppButton type="button" variant="primary" onClick={() => setEditor({ mode: 'create' })}>
            <Plus className="mr-1.5 h-4 w-4" /> Add video
          </AppButton>
        </div>
      </header>

      <section aria-label="Homepage video cards" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="aspect-[2/3] animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        ) : isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-14 text-center">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="text-sm font-semibold text-rose-700">Could not load video cards.</p>
            <AppButton type="button" variant="outline" onClick={() => refetch()}>Try again</AppButton>
          </div>
        ) : sortedCards.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-[#C54870]"><Film className="h-7 w-7" /></div>
            <h2 className="mt-4 text-base font-bold text-slate-800">No videos added yet</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">Add a video and a poster image. Shoppers see the poster first and can tap to play.</p>
            <AppButton type="button" variant="primary" className="mt-5" onClick={() => setEditor({ mode: 'create' })}>
              <Plus className="mr-1.5 h-4 w-4" /> Add your first video
            </AppButton>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedCards.map((card) => (
              <article key={card._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative aspect-[2/3] bg-slate-100">
                  <img src={card.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${card.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {card.status === 'active' ? 'Visible' : 'Hidden'}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-slate-900">{card.title}</h2>
                      {card.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.description}</p>}
                    </div>
                    <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">Order {card.displayOrder ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="truncate text-[11px] text-slate-500">{card.linkUrl || 'No destination link'}</span>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => setEditor({ mode: 'edit', card })} aria-label={`Edit ${card.title}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D88]">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(card)} aria-label={`Remove ${card.title}`} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-100 px-2.5 text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default CmsVideoCardsPage;
