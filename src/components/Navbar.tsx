import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Bookmark,
  History,
  Download,
  Bell,
  Settings,
  Shield,
  Layers,
  TrendingUp,
  X,
  FileText,
  ChevronDown,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { Story, Genre, PushNotification } from '../types';
import { Language, translations } from '../services/i18n';
import { markNotificationsAsRead } from '../services/storage';

interface NavbarProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  stories: Story[];
  onSelectStory: (story: Story) => void;
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  onOpenNotes: () => void;
  onOpenOffline: () => void;
  onOpenSync: () => void;
  onOpenAdmin: () => void;
  onFilterGenre: (genre: Genre) => void;
  onFilterRanking: (rankType: string) => void;
  onGoHome: () => void;
  historyCount: number;
  bookmarkCount: number;
  notifications: PushNotification[];
  onNotificationClick: (notif: PushNotification) => void;
}

const ALL_GENRES: Genre[] = [
  'Tiên Hiệp',
  'Kiếm Hiệp',
  'Huyền Huyễn',
  'Ngôn Tình',
  'Đô Thị',
  'Khoa Huyễn',
  'Võng Du',
  'Dị Năng',
  'Linh Dị',
  'Trọng Sinh',
  'Xuyên Không',
  'Hệ Thống',
];

export const Navbar: React.FC<NavbarProps> = ({
  currentLang,
  onLanguageChange,
  stories,
  onSelectStory,
  onOpenHistory,
  onOpenBookmarks,
  onOpenNotes,
  onOpenOffline,
  onOpenSync,
  onOpenAdmin,
  onFilterGenre,
  onFilterRanking,
  onGoHome,
  historyCount,
  bookmarkCount,
  notifications,
  onNotificationClick,
}) => {
  const t = translations[currentLang];
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isGenreOpen, setIsGenreOpen] = useState(false);
  const [isRankOpen, setIsRankOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const searchResults = searchQuery.trim()
    ? stories.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={onGoHome}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="hidden xs:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl tracking-tight text-stone-900 group-hover:text-emerald-700 transition-colors">
                    TruyenFull
                  </span>
                  <span className="bg-emerald-600 text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider animate-pulse">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 hidden sm:block line-clamp-1">
                  {t.tagline}
                </p>
              </div>
            </button>

            {/* Desktop Menus */}
            <div className="hidden md:flex items-center gap-1 ml-4 text-sm font-medium">
              {/* Thể loại Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setIsGenreOpen(!isGenreOpen);
                    setIsRankOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-stone-700 hover:text-emerald-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>{t.genres}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isGenreOpen ? 'rotate-180' : ''}`} />
                </button>

                {isGenreOpen && (
                  <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-stone-200 p-3 grid grid-cols-2 gap-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {ALL_GENRES.map((g) => (
                      <button
                        key={g}
                        onClick={() => {
                          onFilterGenre(g);
                          setIsGenreOpen(false);
                        }}
                        className="text-left text-xs px-2.5 py-2 rounded-md hover:bg-emerald-50 hover:text-emerald-700 font-medium text-stone-700 transition-colors cursor-pointer"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bảng Xếp Hạng Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setIsRankOpen(!isRankOpen);
                    setIsGenreOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-stone-700 hover:text-emerald-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span>{t.ranking}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isRankOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRankOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-stone-200 p-2 z-50 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      onClick={() => {
                        onFilterRanking('hot');
                        setIsRankOpen(false);
                      }}
                      className="text-left text-xs px-3 py-2 rounded-md hover:bg-emerald-50 hover:text-emerald-700 font-medium text-stone-700 cursor-pointer"
                    >
                      🔥 {t.hotStories}
                    </button>
                    <button
                      onClick={() => {
                        onFilterRanking('topDaily');
                        setIsRankOpen(false);
                      }}
                      className="text-left text-xs px-3 py-2 rounded-md hover:bg-emerald-50 hover:text-emerald-700 font-medium text-stone-700 cursor-pointer"
                    >
                      ⭐ {t.topDaily}
                    </button>
                    <button
                      onClick={() => {
                        onFilterRanking('completed');
                        setIsRankOpen(false);
                      }}
                      className="text-left text-xs px-3 py-2 rounded-md hover:bg-emerald-50 hover:text-emerald-700 font-medium text-stone-700 cursor-pointer"
                    >
                      ✅ {t.completedStories}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div ref={searchRef} className="relative flex-1 max-w-md mx-2 sm:mx-4">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-stone-100 hover:bg-stone-100/80 focus:bg-white text-stone-900 placeholder:text-stone-400 text-xs sm:text-sm pl-10 pr-8 py-2 rounded-full border border-transparent focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-stone-400 hover:text-stone-600 p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Autocomplete Results */}
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
                <div className="p-2 border-b border-stone-100 text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-3">
                  Kết quả tìm kiếm ({searchResults.length})
                </div>
                {searchResults.length === 0 ? (
                  <div className="p-6 text-center text-sm text-stone-500">
                    Không tìm thấy truyện phù hợp với "{searchQuery}"
                  </div>
                ) : (
                  searchResults.slice(0, 6).map((story) => (
                    <button
                      key={story.id}
                      onClick={() => {
                        onSelectStory(story);
                        setIsSearchFocused(false);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-emerald-50/70 text-left transition-colors cursor-pointer border-b border-stone-50 last:border-0"
                    >
                      <img
                        src={story.cover}
                        alt={story.title}
                        className="w-10 h-14 object-cover rounded-md shadow-xs shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs sm:text-sm text-stone-900 truncate">
                          {story.title}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                          <span>{story.author}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-medium">
                            {story.totalChapters} {t.chaptersCount}
                          </span>
                        </div>
                        <div className="flex gap-1 mt-1">
                          {story.genres.slice(0, 2).map((g) => (
                            <span
                              key={g}
                              className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Action Icons & Utilities */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Lịch sử đọc */}
            <button
              onClick={onOpenHistory}
              title={t.history}
              className="relative p-2 text-stone-600 hover:text-emerald-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <History className="w-5 h-5" />
              {historyCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full"></span>
              )}
            </button>

            {/* Tủ truyện (Bookmarks) */}
            <button
              onClick={onOpenBookmarks}
              title={t.cabinet}
              className="relative p-2 text-stone-600 hover:text-emerald-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <Bookmark className="w-5 h-5" />
              {bookmarkCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {bookmarkCount}
                </span>
              )}
            </button>

            {/* Ghi chú cá nhân */}
            <button
              onClick={onOpenNotes}
              title={t.notes}
              className="hidden lg:flex p-2 text-stone-600 hover:text-emerald-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-5 h-5" />
            </button>

            {/* Đọc Offline */}
            <button
              onClick={onOpenOffline}
              title={t.offline}
              className="hidden sm:flex p-2 text-stone-600 hover:text-emerald-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* Push Notifications Dropdown */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  if (!isNotifOpen && unreadCount > 0) {
                    markNotificationsAsRead();
                  }
                }}
                title={t.notifications}
                className="relative p-2 text-stone-600 hover:text-emerald-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-stone-200 p-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                    <span className="font-bold text-xs sm:text-sm text-stone-900">
                      {t.notifications}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-medium">
                      Tự động cập nhật
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-stone-400">
                        {t.noNotifications}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            onNotificationClick(n);
                            setIsNotifOpen(false);
                          }}
                          className={`p-2.5 rounded-xl cursor-pointer transition-colors border ${
                            !n.isRead
                              ? 'bg-emerald-50/70 border-emerald-100'
                              : 'bg-stone-50/70 border-stone-100 hover:bg-stone-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-xs text-stone-900">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-stone-400 shrink-0">
                              {n.timestamp}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <button
              onClick={() => onLanguageChange(currentLang === 'vi' ? 'en' : 'vi')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              title="Chuyển ngôn ngữ / Switch language"
            >
              <Globe className="w-3.5 h-3.5 text-stone-500" />
              <span>{currentLang === 'vi' ? 'VI' : 'EN'}</span>
            </button>

            {/* Admin Portal Button */}
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs transition-colors cursor-pointer"
              title="Trang quản trị & Cấu hình Crawler / Ads Shopee"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.admin}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
