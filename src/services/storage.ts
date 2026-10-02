import {
  Story,
  Chapter,
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

/** Chapters from the server; falls back to the offline copy when the network is unavailable. */
export const loadChapters = async (storyId: string): Promise<Chapter[]> => {
  try {
    return await api.chapters(storyId);
  } catch {
    return getOfflineStories()[storyId]?.chapters ?? [];
  }
};

export const trackAdClick = (adId: string) => {
  void api.adClick(adId);
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
  } catch (err) {
    console.error('Error saving reading history:', err);
  }
};

export const clearReadingHistory = () => {
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
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
    return false;
  } else {
    bookmarks.push({ storyId, category: 'reading', addedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
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
};

export const deletePersonalNote = (id: string) => {
  const notes = getPersonalNotes().filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
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
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
};
