export type Genre =
  | 'Tiên Hiệp'
  | 'Kiếm Hiệp'
  | 'Huyền Huyễn'
  | 'Ngôn Tình'
  | 'Đô Thị'
  | 'Khoa Huyễn'
  | 'Võng Du'
  | 'Dị Năng'
  | 'Linh Dị'
  | 'Trọng Sinh'
  | 'Xuyên Không'
  | 'Hệ Thống'
  | 'Mạt Thế'
  | 'Cổ Đại';

export type StoryStatus = 'ONGOING' | 'COMPLETED';

export interface Chapter {
  id: string;
  storyId: string;
  chapterNumber: number;
  title: string;
  content: string[]; // array of paragraphs for clean reading & note highlighting
  wordCount: number;
  publishedAt: string;
  views: number;
}

export interface Story {
  id: string;
  title: string;
  slug: string;
  author: string;
  cover: string;
  description: string;
  genres: Genre[];
  status: StoryStatus;
  rating: {
    score: number;
    count: number;
  };
  views: number;
  totalChapters: number;
  lastUpdated: string;
  sourceUrl?: string;
  isHot?: boolean;
  isTrending?: boolean;
  recommendedReason?: string;
}

export interface ReadingHistoryItem {
  storyId: string;
  storyTitle: string;
  storyCover: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  scrollPercent: number;
  updatedAt: string;
}

export type BookmarkCategory = 'reading' | 'favorite' | 'read_later' | 'completed';

export interface BookmarkItem {
  storyId: string;
  category: BookmarkCategory;
  addedAt: string;
}

export interface PersonalNote {
  id: string;
  storyId: string;
  storyTitle: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  paragraphIndex: number;
  selectedText: string;
  noteText: string;
  color: 'yellow' | 'green' | 'blue' | 'pink';
  createdAt: string;
}

export interface StoryComment {
  id: string;
  storyId: string;
  chapterId?: string;
  chapterNumber?: number;
  authorName: string;
  authorAvatar: string;
  content: string;
  rating?: number;
  createdAt: string;
  likes: number;
  replies?: StoryComment[];
}

export interface CrawlerJob {
  id: string;
  sourceUrl: string;
  storyTitle: string;
  status: 'IDLE' | 'CRAWLING' | 'SUCCESS' | 'FAILED';
  chaptersCrawled: number;
  totalFound: number;
  startedAt: string;
  completedAt?: string;
  logs: string[];
}

export type AdPlacement = 'HEADER_BANNER' | 'SIDEBAR' | 'IN_READER' | 'FLOAT_BOTTOM';

export interface AdSlot {
  id: string;
  title: string;
  placement: AdPlacement;
  imageUrl: string;
  targetUrl: string;
  affiliateCode?: string;
  isShopee: boolean;
  tag?: string;
  description?: string;
  isEnabled: boolean;
  impressions: number;
  clicks: number;
}

export interface PushNotification {
  id: string;
  storyId?: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  linkChapterNumber?: number;
}

export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'oled';
export type ReaderFont = 'vietnam' | 'merriweather' | 'lora' | 'literata';
export type ReaderWidth = 'narrow' | 'standard' | 'wide' | 'full';

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSize: number; // 14 to 32
  lineHeight: number; // 1.4 to 2.2
  maxWidth: ReaderWidth;
  align: 'left' | 'justify';
  readingMode: 'scroll' | 'paginated';
  autoScrollSpeed: number; // 0 is off, 1-5
  ttsRate: number;
  ttsVoiceIndex: number;
}

export interface OfflineStoryData {
  story: Story;
  chapters: Chapter[];
  downloadedAt: string;
  sizeBytes: number;
}
