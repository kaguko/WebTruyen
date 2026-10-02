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
import { INITIAL_STORIES, INITIAL_CHAPTERS, INITIAL_ADS } from '../data/mockStories';

const STORAGE_KEYS = {
  STORIES: 'tf_stories_v1',
  CHAPTERS: 'tf_chapters_v1',
  HISTORY: 'tf_history_v1',
  BOOKMARKS: 'tf_bookmarks_v1',
  NOTES: 'tf_notes_v1',
  COMMENTS: 'tf_comments_v1',
  ADS: 'tf_ads_v1',
  NOTIFICATIONS: 'tf_notifications_v1',
  READER_SETTINGS: 'tf_reader_settings_v1',
  OFFLINE_STORIES: 'tf_offline_stories_v1',
  CRAWLER_LOGS: 'tf_crawler_logs_v1',
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

// --- Stories & Chapters ---
export const getStoredStories = (): Story[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STORIES, JSON.stringify(INITIAL_STORIES));
      return INITIAL_STORIES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_STORIES;
  }
};

export const saveStoredStories = (stories: Story[]) => {
  localStorage.setItem(STORAGE_KEYS.STORIES, JSON.stringify(stories));
};

export const getStoredChapters = (storyId: string): Chapter[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAPTERS);
    const allChapters: Record<string, Chapter[]> = raw ? JSON.parse(raw) : INITIAL_CHAPTERS;
    return allChapters[storyId] || INITIAL_CHAPTERS[storyId] || [];
  } catch {
    return INITIAL_CHAPTERS[storyId] || [];
  }
};

export const saveChapter = (storyId: string, newChapter: Chapter) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAPTERS);
    const allChapters: Record<string, Chapter[]> = raw ? JSON.parse(raw) : { ...INITIAL_CHAPTERS };
    const currentList = allChapters[storyId] || [];
    
    // Check if chapter already exists, update or append
    const existingIndex = currentList.findIndex((c) => c.chapterNumber === newChapter.chapterNumber);
    if (existingIndex >= 0) {
      currentList[existingIndex] = newChapter;
    } else {
      currentList.push(newChapter);
    }
    currentList.sort((a, b) => a.chapterNumber - b.chapterNumber);
    allChapters[storyId] = currentList;
    localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(allChapters));

    // Update story totalChapters and lastUpdated
    const stories = getStoredStories();
    const storyIdx = stories.findIndex((s) => s.id === storyId);
    if (storyIdx >= 0) {
      stories[storyIdx].totalChapters = currentList.length;
      stories[storyIdx].lastUpdated = 'Vừa xong';
      saveStoredStories(stories);
    }
  } catch (err) {
    console.error('Error saving chapter:', err);
  }
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

// --- Comments & Ratings ---
export const getStoryComments = (storyId: string): StoryComment[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMMENTS);
    const allComments: Record<string, StoryComment[]> = raw ? JSON.parse(raw) : {};
    return allComments[storyId] || [
      {
        id: 'c-1',
        storyId,
        authorName: 'Đạo Hữu Tu Chân',
        authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        content: 'Bộ này đọc bánh cuốn thực sự! Main cẩn thận không trang bức bừa bãi, cơ trí tuyệt vời.',
        rating: 5,
        createdAt: 'Hôm qua',
        likes: 24,
      },
      {
        id: 'c-2',
        storyId,
        authorName: 'Mọt Sách Đêm Khuya',
        authorAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
        content: 'Tốc độ cập nhật chương trên TruyenFull Live nhanh thật, vừa ra chương mới 10 phút trước đã có!',
        rating: 5,
        createdAt: '3 giờ trước',
        likes: 12,
      },
    ];
  } catch {
    return [];
  }
};

export const addStoryComment = (comment: StoryComment) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMMENTS);
    const allComments: Record<string, StoryComment[]> = raw ? JSON.parse(raw) : {};
    const list = allComments[comment.storyId] || [];
    list.unshift(comment);
    allComments[comment.storyId] = list;
    localStorage.setItem(STORAGE_KEYS.COMMENTS, JSON.stringify(allComments));
  } catch (err) {
    console.error('Error adding comment:', err);
  }
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

// --- Ads & Shopee Affiliate ---
export const getStoredAds = (): AdSlot[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ADS, JSON.stringify(INITIAL_ADS));
      return INITIAL_ADS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_ADS;
  }
};

export const saveStoredAds = (ads: AdSlot[]) => {
  localStorage.setItem(STORAGE_KEYS.ADS, JSON.stringify(ads));
};

export const trackAdClick = (adId: string) => {
  const ads = getStoredAds();
  const ad = ads.find((a) => a.id === adId);
  if (ad) {
    ad.clicks += 1;
    saveStoredAds(ads);
  }
};

// --- Push Notifications ---
export const getNotifications = (): PushNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return raw
      ? JSON.parse(raw)
      : [
          {
            id: 'notif-1',
            storyId: 'pham-nhan-tu-tien',
            title: 'Chương mới: Phàm Nhân Tu Tiên',
            message: 'Chương 3: Thần Thủ Cốc & Bí bình lục dịch vừa được cập nhật!',
            timestamp: '15 phút trước',
            isRead: false,
            linkChapterNumber: 3,
          },
          {
            id: 'notif-2',
            storyId: 'van-co-de-nhat-than',
            title: 'Hệ thống Crawler tự động',
            message: 'Đã hoàn tất kiểm tra và đồng bộ hóa 5 đầu truyện hot.',
            timestamp: '1 giờ trước',
            isRead: false,
          },
        ];
  } catch {
    return [];
  }
};

export const addNotification = (notif: PushNotification) => {
  const notifications = getNotifications();
  notifications.unshift(notif);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications.slice(0, 30)));
};

export const markNotificationsAsRead = () => {
  const notifications = getNotifications().map((n) => ({ ...n, isRead: true }));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
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
