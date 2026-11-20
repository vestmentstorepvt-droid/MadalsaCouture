// Direct-to-storage uploads (added for the Vercel move; Vercel caps API request
// bodies at 4.5 MB). The browser asks the API for a short-lived upload ticket,
// sends the file straight to Cloudinary (images) or Cloudflare R2 (videos), then
// tells the API which file it uploaded. Returns the same { url, publicId } the
// old POST /api/v1/admin/media returned.

type Ticket =
  | { provider: 'cloudinary'; method: 'POST'; uploadUrl: string; fields: Record<string, string>; resourceType: string; folder: string }
  | { provider: 'r2'; method: 'PUT'; uploadUrl: string; headers: Record<string, string>; key: string; resourceType: string; folder: string };

export type UploadedRef = { provider: 'cloudinary' | 'r2'; publicId?: string; key?: string; resourceType: string };

const apiBase = () => ((process.env.NEXT_PUBLIC_API_BASE_URL as string) || '').replace(/\/+$/, '');

const authHeader = (): Record<string, string> => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Upload failed (${res.status}).`);
  return json?.data as T;
}

/** Send the file to storage with progress, using XHR (fetch has no upload progress). */
function sendToStorage(ticket: Ticket, file: File, onProgress?: (pct: number) => void): Promise<{ public_id?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
        } catch {
          resolve({});
        }
      } else {
        let message = `Upload failed (${xhr.status}). Please try again.`;
        try {
          message = JSON.parse(xhr.responseText)?.error?.message || message;
        } catch {
          /* storage returned XML or text */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try a smaller file or check your connection.'));
    xhr.timeout = 300_000;
    xhr.open(ticket.method, ticket.uploadUrl);
    if (ticket.provider === 'cloudinary') {
      const form = new FormData();
      Object.entries(ticket.fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file);
      xhr.send(form);
    } else {
      Object.entries(ticket.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.send(file);
    }
  });
}

/** Upload one file to storage and get back a reference the API can verify. */
async function uploadToStorage(
  ticketPath: string,
  file: File,
  opts: { folder?: string; tags?: string; onProgress?: (pct: number) => void },
): Promise<{ ref: UploadedRef; folder: string }> {
  const ticket = await postJson<Ticket>(ticketPath, {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    folder: opts.folder,
    tags: opts.tags,
  });
  const result = await sendToStorage(ticket, file, opts.onProgress);
  const ref: UploadedRef =
    ticket.provider === 'cloudinary'
      ? { provider: 'cloudinary', publicId: result.public_id, resourceType: ticket.resourceType }
      : { provider: 'r2', key: ticket.key, resourceType: ticket.resourceType };
  return { ref, folder: ticket.folder };
}

/** Admin media upload: storage + media library entry. Same result as the old upload endpoint. */
export async function uploadMediaFile(
  file: File,
  opts: { folder?: string; tags?: string; onProgress?: (pct: number) => void } = {},
): Promise<{ url: string; publicId: string }> {
  const { ref, folder } = await uploadToStorage('/api/v1/admin/media/upload-url', file, opts);
  const registered = await postJson<{ url: string; publicId: string }>('/api/v1/admin/media/register', { ...ref, folder, tags: opts.tags });
  opts.onProgress?.(100);
  return registered;
}

/** Same, starting from the FormData the existing components build ('file', 'folder', 'tags'). */
export function uploadMediaFormData(formData: FormData, onProgress?: (pct: number) => void) {
  const file = formData.get('file');
  if (!(file instanceof File)) return Promise.reject(new Error('No file was selected.'));
  const folder = (formData.get('folder') as string) || undefined;
  const tags = (formData.get('tags') as string) || undefined;
  return uploadMediaFile(file, { folder, tags, onProgress });
}

/** Review photos/videos: uploaded to storage; the review request then lists them in `mediaUploads`. */
export async function uploadReviewFile(file: File): Promise<UploadedRef> {
  const { ref } = await uploadToStorage('/api/v1/uploads/review-url', file, {});
  return ref;
}

async function sendJson<T>(method: 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Request failed (${res.status}).`);
  return json?.data as T;
}

/** Profile photo: upload to the user's own storage folder, then save it on the account. */
export async function uploadAvatar(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const { ref } = await uploadToStorage('/api/v1/auth/avatar/upload-url', file, { onProgress });
  const saved = await sendJson<{ avatar: string }>('PUT', '/api/v1/auth/avatar', ref);
  onProgress?.(100);
  return saved.avatar;
}

export async function removeAvatar(): Promise<void> {
  await sendJson('DELETE', '/api/v1/auth/avatar');
}
