import {
  Story,
  Chapter,
  ChapterMeta,
  ChapterPage,
  ReadingHistoryItem,
  BookmarkItem,
  PersonalNote,
  StoryComment,
  AdSlot,
  PushNotification,
  ReaderSettings,
  OfflineStoryData,
} from '../types';
import { api } from './api';

const STORAGE_KEYS = {
  STORIES: 'tf_stories_v1',
  CHAPTERS: 'tf_chapters_v1',
  HISTORY: 'tf_history_v1',
  BOOKMARKS: 'tf_bookmarks_v1',
  NOTES: 'tf_notes_v1',
  NOTIFICATIONS: 'tf_read_notifications_v1',
  READER_SETTINGS: 'tf_reader_settings_v1',
  OFFLINE_STORIES: 'tf_offline_stories_v1',
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: 'sepia',
  font: 'lora',
  fontSize: 18,
  lineHeight: 1.8,
  maxWidth: 'standard',
  align: 'justify',
  readingMode: 'scroll',
  autoScrollSpeed: 0,
  ttsRate: 1.0,
  ttsVoiceIndex: 0,
};

// --- Shared content (served by the backend; cached locally for offline use) ---
const readCache = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeCache = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded: cache is best-effort */
  }
};

export const loadStories = async (): Promise<Story[]> => {
  try {
    const stories = await api.stories();
    writeCache(STORAGE_KEYS.STORIES, stories);
    return stories;
  } catch {
    return readCache<Story[]>(STORAGE_KEYS.STORIES, []);
  }
};

export const loadAds = async (): Promise<AdSlot[]> => {
  try {
    return await api.ads();
  } catch {
    return [];
  }
};

// Notifications come from the server; "read" state is per-reader and kept locally.
const getReadNotificationIds = (): string[] => readCache<string[]>(STORAGE_KEYS.NOTIFICATIONS, []);

export const loadNotifications = async (): Promise<PushNotification[]> => {
  try {
    const read = new Set(getReadNotificationIds());
    return (await api.notifications()).map((n) => ({ ...n, isRead: read.has(n.id) }));
  } catch {
    return [];
  }
};

export const markNotificationsAsRead = (notifications: PushNotification[]) => {
  const ids = new Set([...getReadNotificationIds(), ...notifications.map((n) => n.id)]);
  writeCache(STORAGE_KEYS.NOTIFICATIONS, [...ids].slice(-200));
};

const toMeta = ({ content: _content, ...meta }: Chapter): ChapterMeta => meta;

/** One page of the chapter list; falls back to the offline copy when the network is unavailable. */
export const loadChapterPage = async (storyId: string, offset = 0, limit = 50, q = ''): Promise<ChapterPage> => {
  try {
    return await api.chapterPage(storyId, offset, limit, q);
  } catch {
    const needle = q.trim().toLowerCase();
    const all = (getOfflineStories()[storyId]?.chapters ?? []).filter(
      (c) => !needle || c.title.toLowerCase().includes(needle) || String(c.chapterNumber) === needle,
    );
    return { items: all.slice(offset, offset + limit).map(toMeta), total: all.length };
  }
};

/** A single chapter with content; falls back to the offline copy. Returns null if it doesn't exist. */
export const loadChapter = async (storyId: string, n: number): Promise<Chapter | null> => {
  try {
    return await api.chapter(storyId, n);
  } catch {
    return getOfflineStories()[storyId]?.chapters.find((c) => c.chapterNumber === n) ?? null;
  }
};

export const trackAdClick = (adId: string) => {
  void api.adClick(adId);
};

// --- Account sync (history, bookmarks, notes, settings) ---
// Anonymous readers use localStorage only. Once signed in, every change is also pushed to the server
// (debounced); a per-kind "dirty" flag survives reloads/offline so unsent changes are never overwritten.
type SyncKind = 'history' | 'bookmarks' | 'notes' | 'settings';
const SYNC_KINDS: SyncKind[] = ['history', 'bookmarks', 'notes', 'settings'];
const SYNC_KEY: Record<SyncKind, string> = {
  history: STORAGE_KEYS.HISTORY,
  bookmarks: STORAGE_KEYS.BOOKMARKS,
  notes: STORAGE_KEYS.NOTES,
  settings: STORAGE_KEYS.READER_SETTINGS,
};
const DIRTY_KEY = 'tf_sync_dirty_v1';
let syncEnabled = false;
const syncTimers: Partial<Record<SyncKind, number>> = {};

const getDirty = (): SyncKind[] => readCache<SyncKind[]>(DIRTY_KEY, []);
const setDirty = (kinds: SyncKind[]) => writeCache(DIRTY_KEY, kinds);
const localValue = (kind: SyncKind): unknown => {
  if (kind === 'settings') return getReaderSettings();
  return readCache<unknown[]>(SYNC_KEY[kind], []);
};

const pushKind = async (kind: SyncKind) => {
  try {
    await api.auth.putData(kind, localValue(kind));
    setDirty(getDirty().filter((k) => k !== kind));
  } catch {
    /* stays dirty; retried on next load or change */
  }
};

export const setSyncEnabled = (enabled: boolean) => {
  syncEnabled = enabled;
};

function markDirty(kind: SyncKind) {
  if (!syncEnabled) return;
  setDirty([...new Set([...getDirty(), kind])]);
  window.clearTimeout(syncTimers[kind]);
  syncTimers[kind] = window.setTimeout(() => void pushKind(kind), 800);
}

/** Await delivery of all unsent changes (used before sign-out). */
export const pushDirty = async () => {
  if (!syncEnabled) return;
  for (const kind of SYNC_KINDS) {
    window.clearTimeout(syncTimers[kind]);
    delete syncTimers[kind];
  }
  await Promise.all(getDirty().map(pushKind));
};

/** Send pending changes immediately (call when the tab is being hidden/closed). */
export const flushSync = () => {
  if (!syncEnabled) return;
  for (const kind of SYNC_KINDS) {
    if (syncTimers[kind] !== undefined) {
      window.clearTimeout(syncTimers[kind]);
      delete syncTimers[kind];
      try {
        void fetch(`/api/me/data/${kind}`, {
          method: 'PUT',
          credentials: 'same-origin',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: localValue(kind) }),
        });
      } catch {
        /* ignore */
      }
    }
  }
};

const mergeLists = {
  history: (server: ReadingHistoryItem[], local: ReadingHistoryItem[]) => {
    const map = new Map<string, ReadingHistoryItem>();
    for (const h of [...server, ...local]) {
      const cur = map.get(h.storyId);
      if (!cur || h.updatedAt > cur.updatedAt) map.set(h.storyId, h);
    }
    return [...map.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 50);
  },
  bookmarks: (server: BookmarkItem[], local: BookmarkItem[]) => {
    const map = new Map(server.map((b) => [b.storyId, b]));
    local.forEach((b) => map.has(b.storyId) || map.set(b.storyId, b));
    return [...map.values()];
  },
  notes: (server: PersonalNote[], local: PersonalNote[]) => {
    const ids = new Set(server.map((n) => n.id));
    return [...local.filter((n) => !ids.has(n.id)), ...server];
  },
};

/**
 * Called after sign-in/registration (merge = true: combine this device's anonymous data with the account)
 * and on app load while signed in (merge = false: the server copy wins unless local changes are unsent).
 */
export const syncFromServer = async (merge: boolean) => {
  const server = await api.auth.getData();
  const dirty = new Set(getDirty());
  for (const kind of SYNC_KINDS) {
    const remote = server[kind];
    if (kind === 'settings') {
      const hasRemote = remote && Object.keys(remote as object).length > 0;
      if (hasRemote && (merge || !dirty.has(kind))) writeCache(SYNC_KEY[kind], remote);
    } else if (Array.isArray(remote)) {
      if (merge) writeCache(SYNC_KEY[kind], mergeLists[kind](remote as any, localValue(kind) as any));
      else if (!dirty.has(kind)) writeCache(SYNC_KEY[kind], remote);
    }
    if (merge || dirty.has(kind) || remote === undefined) await pushKind(kind);
  }
};

/** Remove account-bound data from this browser (used on sign-out so the next person on a shared device starts clean). */
export const clearLocalUserData = () => {
  SYNC_KINDS.forEach((k) => localStorage.removeItem(SYNC_KEY[k]));
  localStorage.removeItem(DIRTY_KEY);
};

// --- Reading History ---
export const getReadingHistory = (): ReadingHistoryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveReadingHistory = (item: ReadingHistoryItem) => {
  try {
    const history = getReadingHistory().filter((h) => h.storyId !== item.storyId);
    history.unshift(item);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 50)));
    markDirty('history');
  } catch (err) {
    console.error('Error saving reading history:', err);
  }
};

export const clearReadingHistory = () => {
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
  markDirty('history');
};

// --- Bookmarks (Tủ Truyện) ---
export const getBookmarks = (): BookmarkItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const toggleBookmark = (storyId: string): boolean => {
  const bookmarks = getBookmarks();
  const exists = bookmarks.find((b) => b.storyId === storyId);
  if (exists) {
    const filtered = bookmarks.filter((b) => b.storyId !== storyId);
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(filtered));
    markDirty('bookmarks');
    return false;
  } else {
    bookmarks.push({ storyId, category: 'reading', addedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    markDirty('bookmarks');
    return true;
  }
};

export const isBookmarked = (storyId: string): boolean => {
  return getBookmarks().some((b) => b.storyId === storyId);
};

// --- Personal Notes & Highlights ---
export const getPersonalNotes = (storyId?: string): PersonalNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
    const notes: PersonalNote[] = raw ? JSON.parse(raw) : [];
    if (storyId) {
      return notes.filter((n) => n.storyId === storyId);
    }
    return notes;
  } catch {
    return [];
  }
};

export const savePersonalNote = (note: PersonalNote) => {
  const notes = getPersonalNotes();
  notes.unshift(note);
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  markDirty('notes');
};

export const deletePersonalNote = (id: string) => {
  const notes = getPersonalNotes().filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  markDirty('notes');
};

// --- Offline Stories Storage ---
export const getOfflineStories = (): Record<string, OfflineStoryData> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_STORIES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveStoryOffline = (story: Story, chapters: Chapter[]) => {
  try {
    const offlineData = getOfflineStories();
    const dataSize = JSON.stringify({ story, chapters }).length;
    offlineData[story.id] = {
      story,
      chapters,
      downloadedAt: new Date().toISOString(),
      sizeBytes: dataSize,
    };
    localStorage.setItem(STORAGE_KEYS.OFFLINE_STORIES, JSON.stringify(offlineData));
  } catch (err) {
    console.error('Error saving story offline:', err);
  }
};

export const removeOfflineStory = (storyId: string) => {
  const offlineData = getOfflineStories();
  delete offlineData[storyId];
  localStorage.setItem(STORAGE_KEYS.OFFLINE_STORIES, JSON.stringify(offlineData));
};

export const isStoryOffline = (storyId: string): boolean => {
  const offlineData = getOfflineStories();
  return Boolean(offlineData[storyId]);
};

// --- Reader Settings ---
export const getReaderSettings = (): ReaderSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.READER_SETTINGS);
    return raw ? { ...DEFAULT_READER_SETTINGS, ...JSON.parse(raw) } : DEFAULT_READER_SETTINGS;
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
};

export const saveReaderSettings = (settings: ReaderSettings) => {
  localStorage.setItem(STORAGE_KEYS.READER_SETTINGS, JSON.stringify(settings));
  markDirty('settings');
};

// --- Backup & Cross-Device Sync ---
export const exportAllUserData = () => {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    history: getReadingHistory(),
    bookmarks: getBookmarks(),
    notes: getPersonalNotes(),
    settings: getReaderSettings(),
  };
  return JSON.stringify(data, null, 2);
};

export const importUserData = (jsonString: string): boolean => {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.history) localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(parsed.history));
    if (parsed.bookmarks) localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(parsed.bookmarks));
    if (parsed.notes) localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(parsed.notes));
    if (parsed.settings) localStorage.setItem(STORAGE_KEYS.READER_SETTINGS, JSON.stringify(parsed.settings));
    SYNC_KINDS.forEach(markDirty);
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
};
