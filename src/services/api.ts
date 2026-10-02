import { Story, Chapter, ChapterPage, AdSlot, PushNotification, StoryComment } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let message = `Lỗi ${res.status}`;
    try {
      message = (await res.json()).error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}
const send = <T>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  stories: () => request<Story[]>('/stories'),
  chapterPage: (storyId: string, offset = 0, limit = 50, q = '') =>
    request<ChapterPage>(`/stories/${storyId}/chapters?offset=${offset}&limit=${limit}&q=${encodeURIComponent(q)}`),
  chapter: (storyId: string, n: number) => request<Chapter>(`/stories/${storyId}/chapters/${n}`),
  download: (storyId: string) => request<Chapter[]>(`/stories/${storyId}/download`),
  countView: (storyId: string, n: number) => send('POST', `/stories/${storyId}/chapters/${n}/view`).catch(() => {}),
  ads: () => request<AdSlot[]>('/ads'),
  adClick: (id: string) => send('POST', `/ads/${id}/click`).catch(() => {}),
  notifications: () => request<PushNotification[]>('/notifications'),
  comments: (storyId: string) => request<StoryComment[]>(`/stories/${storyId}/comments`),
  addComment: (storyId: string, body: { content: string; rating: number; authorName?: string }) =>
    send<StoryComment>('POST', `/stories/${storyId}/comments`, body),

  admin: {
    me: () => request<{ admin: boolean }>('/admin/me'),
    login: (password: string) => send<{ ok: true }>('POST', '/admin/login', { password }),
    logout: () => send('POST', '/admin/logout'),
    createStory: (b: Partial<Story>) => send<Story>('POST', '/admin/stories', b),
    updateStory: (id: string, b: Partial<Story>) => send<Story>('PUT', `/admin/stories/${id}`, b),
    deleteStory: (id: string) => send('DELETE', `/admin/stories/${id}`),
    addChapter: (id: string, b: { title: string; content: string; chapterNumber?: number }) =>
      send<Chapter>('POST', `/admin/stories/${id}/chapters`, b),
    createAd: (b: Partial<AdSlot>) => send<AdSlot>('POST', '/admin/ads', b),
    updateAd: (id: string, b: Partial<AdSlot>) => send<AdSlot>('PUT', `/admin/ads/${id}`, b),
    deleteAd: (id: string) => send('DELETE', `/admin/ads/${id}`),
    push: (title: string, message: string) => send('POST', '/admin/notifications', { title, message }),
    crawlConfig: (id: string) =>
      request<{ tocUrl: string; linkSelector: string; contentSelector: string; titleSelector?: string } | null>(
        `/admin/stories/${id}/crawl-config`,
      ),
    crawl: (
      id: string,
      b: { tocUrl: string; linkSelector: string; contentSelector: string; titleSelector?: string; limit?: number },
    ) => send<{ added: number; logs: string[] }>('POST', `/admin/stories/${id}/crawl`, b),
  },
};
