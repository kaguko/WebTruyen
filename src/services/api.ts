import { Story, Chapter, ChapterPage, AdSlot, PushNotification, StoryComment } from '../types';

export interface AdminStats {
  totals: { stories: number; chapters: number; comments: number; users: number };
  viewsToday: number;
  views7d: number;
  viewsByDay: { day: string; views: number }[];
  commentsToday: number;
  newUsersToday: number;
  topStories: { id: string; title: string; views: number; totalChapters: number }[];
  crawlRuns: { storyId: string; storyTitle: string; at: number; ok: boolean; added: number; message: string }[];
  crawlConfigured: number;
  crawlIntervalMin: number;
  activeAds: { id: string; title: string; placement: string; isShopee: boolean; clicks: number }[];
  recentComments: (StoryComment & { storyTitle: string })[];
}

export interface AccountUser {
  id: number;
  email: string;
  name: string;
}

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

export interface CrawlStatus {
  running: boolean;
  stopRequested?: boolean;
  added: number;
  total: number;
  error?: string;
  logs: string[];
}

export const api = {
  stories: () => request<Story[]>('/stories'),
  chapterPage: (storyId: string, offset = 0, limit = 50, q = '') =>
    request<ChapterPage>(`/stories/${storyId}/chapters?offset=${offset}&limit=${limit}&q=${encodeURIComponent(q)}`),
  chapter: (storyId: string, n: number) => request<Chapter>(`/stories/${storyId}/chapters/${n}`),
  download: (storyId: string) => request<Chapter[]>(`/stories/${storyId}/download`),
  countView: (storyId: string, n: number) => send('POST', `/stories/${storyId}/chapters/${n}/view`).catch(() => {}),
  genres: () => request<string[]>('/genres'),
  ads: () => request<AdSlot[]>('/ads'),
  adView: (id: string) => send('POST', `/ads/${id}/view`).catch(() => {}),
  adClick: (id: string) => send('POST', `/ads/${id}/click`).catch(() => {}),
  notifications: () => request<PushNotification[]>('/notifications'),
  comments: (storyId: string) => request<StoryComment[]>(`/stories/${storyId}/comments`),
  addComment: (storyId: string, body: { content: string; rating: number; authorName?: string }) =>
    send<StoryComment>('POST', `/stories/${storyId}/comments`, body),

  auth: {
    me: () => request<{ user: AccountUser | null }>('/auth/me'),
    register: (b: { email: string; password: string; name?: string }) =>
      send<{ user: AccountUser }>('POST', '/auth/register', b),
    login: (b: { email: string; password: string }) => send<{ user: AccountUser }>('POST', '/auth/login', b),
    logout: () => send('POST', '/auth/logout'),
    deleteAccount: (password: string) => send('DELETE', '/auth/account', { password }),
    getData: () => request<Record<string, unknown>>('/me/data'),
    putData: (kind: string, data: unknown) => send('PUT', `/me/data/${kind}`, { data }),
  },

  admin: {
    me: () => request<{ admin: boolean }>('/admin/me'),
    stats: () => request<AdminStats>('/admin/stats'),
    deleteComment: (id: string) => send('DELETE', `/admin/comments/${id}`),
    login: (password: string) => send<{ ok: true }>('POST', '/admin/login', { password }),
    logout: () => send('POST', '/admin/logout'),
    addGenre: (name: string) => send<string[]>('POST', '/admin/genres', { name }),
    renameGenre: (from: string, to: string) => send<string[]>('POST', '/admin/genres/rename', { from, to }),
    deleteGenre: (name: string) => send<string[]>('POST', '/admin/genres/delete', { name }),
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
      request<{ tocUrl: string; linkSelector?: string; contentSelector?: string; titleSelector?: string } | null>(
        `/admin/stories/${id}/crawl-config`,
      ),
    crawl: (
      id: string,
      b: { tocUrl: string; linkSelector?: string; contentSelector?: string; titleSelector?: string; limit?: number },
    ) => send<{ started: boolean }>('POST', `/admin/stories/${id}/crawl`, b),
    crawlPreview: (b: { tocUrl: string; linkSelector?: string; contentSelector?: string }) =>
      send<{ chapterTotal: number; pages: number; firstTitle: string; sample: string[]; paragraphs: number }>('POST', '/admin/crawl-preview', b),
    crawlStatus: (id: string) =>
      request<CrawlStatus>(`/admin/stories/${id}/crawl-status`),
    crawlStop: (id: string) => send<{ stopped: boolean }>('POST', `/admin/stories/${id}/crawl-stop`),
  },
};
