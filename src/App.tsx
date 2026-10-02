/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Story,
  Chapter,
  AdSlot,
  ReadingHistoryItem,
  BookmarkItem,
  PersonalNote,
  OfflineStoryData,
  ReaderSettings,
  PushNotification,
  Genre,
} from './types';
import {
  loadStories,
  loadAds,
  loadNotifications,
  getReadingHistory,
  getBookmarks,
  getPersonalNotes,
  getOfflineStories,
  getReaderSettings,
  saveReaderSettings,
  setSyncEnabled,
  syncFromServer,
  flushSync,
  pushDirty,
  clearLocalUserData,
} from './services/storage';
import { parseRoute, storyPath, chapterPath, genrePath } from './routes';
import { Language, translations } from './services/i18n';
import { Navbar } from './components/Navbar';
import { HotCarousel } from './components/HotCarousel';
import { StoryCard } from './components/StoryCard';
import { RankingSidebar } from './components/RankingSidebar';
import { StoryDetail } from './components/StoryDetail';
import { ReaderView } from './components/ReaderView';
import { AccountModal } from './components/AccountModal';
import { api, AccountUser } from './services/api';
import { AdminGate } from './components/AdminGate';
const AdminPortal = lazy(() => import('./components/AdminPortal').then((m) => ({ default: m.AdminPortal })));
import { UserCabinets } from './components/UserCabinets';
import { AdBanner } from './components/AdBanner';
import { Footer } from './components/Footer';
import {
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  WifiOff,
  Filter,
  X,
  Compass,
  TrendingUp,
  Layers,
} from 'lucide-react';

export default function App() {
  // Global Data States
  const [stories, setStories] = useState<Story[]>([]);
  const [ads, setAds] = useState<AdSlot[]>([]);
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [personalNotes, setPersonalNotes] = useState<PersonalNote[]>([]);
  const [offlineStories, setOfflineStories] = useState<Record<string, OfflineStoryData>>({});
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(getReaderSettings());
  const [currentLang, setCurrentLang] = useState<Language>('vi');

  // Navigation & View States
  const [currentView, setCurrentView] = useState<'home' | 'detail' | 'reader'>('home');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [activeChapterNumber, setActiveChapterNumber] = useState<number>(1);

  // Filters
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [rankingFilter, setRankingFilter] = useState<string | null>(null);

  // Modals
  const [isCabinetOpen, setIsCabinetOpen] = useState(false);
  const [cabinetInitialTab, setCabinetInitialTab] = useState<'history' | 'bookmarks' | 'notes' | 'offline'>('history');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);

  // Offline network status
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const t = translations[currentLang];

  // ---- Reader account ----
  const signedIn = async (u: AccountUser, merge: boolean) => {
    setSyncEnabled(true);
    setUser(u);
    try {
      await syncFromServer(merge);
    } catch {
      /* offline: keep local data, will retry on next load */
    }
    refreshStorageData();
  };

  useEffect(() => {
    api.auth
      .me()
      .then(({ user: u }) => u && signedIn(u, false))
      .catch(() => {});
    const onHide = () => document.visibilityState === 'hidden' && flushSync();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Refresh all state from local storage
  const refreshStorageData = () => {
    void loadStories().then(setStories);
    void loadAds().then(setAds);
    void loadNotifications().then(setNotifications);
    setHistory(getReadingHistory());
    setBookmarks(getBookmarks());
    setPersonalNotes(getPersonalNotes());
    setOfflineStories(getOfflineStories());
    setReaderSettings(getReaderSettings());
  };

  useEffect(() => {
    refreshStorageData();

    // Online / Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ---- URL routing (History API) ----
  const [routeReady, setRouteReady] = useState(false);

  const applyRoute = (list: Story[]) => {
    const route = parseRoute(window.location.pathname);
    const story = 'slug' in route ? list.find((s) => s.slug === route.slug) : undefined;
    if (route.type === 'chapter' && story) {
      setSelectedStory(story);
      setActiveChapterNumber(route.n);
      setCurrentView('reader');
    } else if (route.type === 'story' && story) {
      setSelectedStory(story);
      setCurrentView('detail');
    } else {
      setCurrentView('home');
      setSelectedGenre(route.type === 'genre' ? (route.genre as Genre) : null);
      if (route.type !== 'home' && route.type !== 'genre') window.history.replaceState(null, '', '/');
    }
    setRankingFilter(null);
  };

  // Resolve the initial URL once stories have loaded; handle back/forward afterwards.
  useEffect(() => {
    if (routeReady || stories.length === 0) return;
    applyRoute(stories);
    setRouteReady(true);
  }, [stories, routeReady]);

  useEffect(() => {
    const onPop = () => applyRoute(stories);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [stories]);

  const desiredPath =
    currentView === 'reader' && selectedStory
      ? chapterPath(selectedStory.slug, activeChapterNumber)
      : currentView === 'detail' && selectedStory
        ? storyPath(selectedStory.slug)
        : selectedGenre
          ? genrePath(selectedGenre)
          : '/';

  useEffect(() => {
    if (!routeReady) return;
    if (window.location.pathname !== desiredPath) window.history.pushState(null, '', desiredPath);
    const base = 'TruyenFull Live';
    document.title =
      currentView === 'reader' && selectedStory
        ? `${selectedStory.title} - Chương ${activeChapterNumber} | ${base}`
        : currentView === 'detail' && selectedStory
          ? `${selectedStory.title} | ${base}`
          : selectedGenre
            ? `Truyện ${selectedGenre} | ${base}`
            : `${base} - Đọc Truyện Online Tối Ưu, Cập Nhật Nhanh`;
  }, [desiredPath, routeReady]);

  const handleUpdateReaderSettings = (newSettings: ReaderSettings) => {
    setReaderSettings(newSettings);
    saveReaderSettings(newSettings);
  };

  // Navigations
  const handleSelectStory = (story: Story) => {
    setSelectedStory(story);
    setCurrentView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReadChapter = (story: Story, chapterNum: number) => {
    setSelectedStory(story);
    setActiveChapterNumber(chapterNum);
    setCurrentView('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setCurrentView('home');
    setSelectedGenre(null);
    setRankingFilter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filtered stories on Home
  const filteredStories = stories.filter((s) => {
    if (selectedGenre && !s.genres.includes(selectedGenre)) {
      return false;
    }
    if (rankingFilter === 'hot' && !s.isHot) {
      return false;
    }
    if (rankingFilter === 'completed' && s.status !== 'COMPLETED') {
      return false;
    }
    return true;
  });

  // Recommended stories based on read history
  const historyGenres = new Set(
    history
      .map((h) => stories.find((s) => s.id === h.storyId)?.genres[0])
      .filter(Boolean) as string[]
  );

  const recommendedStories = stories
    .filter((s) => historyGenres.has(s.genres[0]) || s.rating.score >= 4.8)
    .slice(0, 4);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 font-vietnam selection:bg-emerald-200">
      {/* Offline Status Warning Bar */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>
            Bạn đang ngoại tuyến (Offline). Các truyện và chương đã tải về máy vẫn có thể đọc bình thường không cần mạng!
          </span>
        </div>
      )}

      {/* Global Navbar */}
      {currentView !== 'reader' && (
        <Navbar
          currentLang={currentLang}
          onLanguageChange={setCurrentLang}
          stories={stories}
          onSelectStory={handleSelectStory}
          onOpenHistory={() => {
            setCabinetInitialTab('history');
            setIsCabinetOpen(true);
          }}
          onOpenBookmarks={() => {
            setCabinetInitialTab('bookmarks');
            setIsCabinetOpen(true);
          }}
          onOpenNotes={() => {
            setCabinetInitialTab('notes');
            setIsCabinetOpen(true);
          }}
          onOpenOffline={() => {
            setCabinetInitialTab('offline');
            setIsCabinetOpen(true);
          }}
          onOpenAccount={() => setIsAccountOpen(true)}
          accountName={user?.name}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onFilterGenre={(genre) => {
            setSelectedGenre(genre);
            setCurrentView('home');
          }}
          onFilterRanking={(rankType) => {
            setRankingFilter(rankType);
            setCurrentView('home');
          }}
          onGoHome={handleGoHome}
          historyCount={history.length}
          bookmarkCount={bookmarks.length}
          notifications={notifications}
          onNotificationClick={(notif) => {
            if (notif.storyId) {
              const matched = stories.find((s) => s.id === notif.storyId);
              if (matched) {
                if (notif.linkChapterNumber) {
                  handleReadChapter(matched, notif.linkChapterNumber);
                } else {
                  handleSelectStory(matched);
                }
              }
            }
          }}
        />
      )}

      {/* VIEW: READER */}
      {currentView === 'reader' && selectedStory && (
        <ReaderView
          story={selectedStory}
          initialChapterNumber={activeChapterNumber}
          onChapterChange={setActiveChapterNumber}
          readerSettings={readerSettings}
          onUpdateSettings={handleUpdateReaderSettings}
          currentLang={currentLang}
          ads={ads}
          onBack={() => {
            setCurrentView('detail');
            refreshStorageData();
          }}
        />
      )}

      {/* VIEW: STORY DETAIL */}
      {currentView === 'detail' && selectedStory && (
        <StoryDetail
          story={selectedStory}
          currentLang={currentLang}
          ads={ads}
          onBack={handleGoHome}
          onReadChapter={handleReadChapter}
          onSelectGenre={(genre) => {
            setSelectedGenre(genre as Genre);
            setCurrentView('home');
          }}
        />
      )}

      {/* VIEW: HOME PAGE */}
      {currentView === 'home' && (
        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 w-full animate-in fade-in duration-200">
          {/* Active Filter Pill */}
          {(selectedGenre || rankingFilter) && (
            <div className="mb-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-2xl">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-900">
                <Filter className="w-4 h-4 text-emerald-700" />
                <span>
                  Đang lọc theo:{' '}
                  <strong>
                    {selectedGenre ? `Thể loại "${selectedGenre}"` : `Bảng xếp hạng "${rankingFilter}"`}
                  </strong>{' '}
                  ({filteredStories.length} truyện)
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedGenre(null);
                  setRankingFilter(null);
                }}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 bg-white px-2.5 py-1 rounded-lg border border-stone-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          )}

          {/* Featured Hero Carousel (Only shown when not in specific filter) */}
          {!selectedGenre && !rankingFilter && (
            <HotCarousel
              stories={stories}
              onSelectStory={handleSelectStory}
              onReadFromStart={(story) => handleReadChapter(story, 1)}
            />
          )}

          {/* Shopee Affiliate Deals Banner */}
          <AdBanner placement="HEADER_BANNER" ads={ads} />

          {/* Main 2-Column Content: Left Stories Grid, Right Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mt-6">
            {/* Left Content Column (2 cols wide on desktop) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Section 1: Hot Stories Grid */}
              <section>
                <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-red-500" />
                    <h2 className="font-extrabold text-base sm:text-lg text-stone-900">
                      {selectedGenre ? `Truyện ${selectedGenre} Hot` : t.hotStories}
                    </h2>
                  </div>
                  <span className="text-xs text-stone-500 font-medium">
                    {filteredStories.length} đầu truyện
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {filteredStories.slice(0, 8).map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      onClick={() => handleSelectStory(story)}
                    />
                  ))}
                </div>
              </section>

              {/* Section 2: Latest Chapters List */}
              <section className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-600" />
                    <h2 className="font-extrabold text-base sm:text-lg text-stone-900">
                      {t.latestUpdated}
                    </h2>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                    Crawler Auto-Sync
                  </span>
                </div>

                <div className="divide-y divide-stone-100">
                  {stories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      variant="list"
                      onClick={() => handleSelectStory(story)}
                    />
                  ))}
                </div>
              </section>

              {/* Section 3: Recommended For You (Personalized based on reading history) */}
              {recommendedStories.length > 0 && (
                <section>
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <h2 className="font-extrabold text-base sm:text-lg text-stone-900">
                        {t.recommendedForYou}
                      </h2>
                    </div>
                    <span className="text-xs text-stone-400">Dựa theo sở thích của bạn</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {recommendedStories.map((story) => (
                      <StoryCard
                        key={story.id}
                        story={story}
                        onClick={() => handleSelectStory(story)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right Sidebar Column */}
            <div className="space-y-6">
              {/* Leaderboard Ranking Widget */}
              <RankingSidebar
                stories={stories}
                onSelectStory={handleSelectStory}
              />

              {/* Shopee Deals Sidebar Ad */}
              <AdBanner placement="SIDEBAR" ads={ads} />

              {/* Fast Genre Cloud */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                <div className="flex items-center gap-2 pb-3 border-b border-stone-100 mb-3">
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-extrabold text-sm uppercase tracking-wide text-stone-900">
                    Khám Phá Thể Loại
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
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
                  ].map((genre) => (
                    <button
                      key={genre}
                      onClick={() => {
                        setSelectedGenre(genre as Genre);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                        selectedGenre === genre
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-stone-100 hover:bg-emerald-50 hover:text-emerald-700 text-stone-700'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating Bottom Ad (Shopee or Special Promo) */}
          <AdBanner placement="FLOAT_BOTTOM" ads={ads} />
        </main>
      )}

      {/* User Cabinets Modal (History, Bookmarks, Notes, Offline) */}
      {isCabinetOpen && (
        <UserCabinets
          initialTab={cabinetInitialTab}
          stories={stories}
          history={history}
          bookmarks={bookmarks}
          notes={personalNotes}
          offlineStories={offlineStories}
          currentLang={currentLang}
          onClose={() => {
            setIsCabinetOpen(false);
            refreshStorageData();
          }}
          onReadChapter={handleReadChapter}
          onSelectStory={handleSelectStory}
          onRefreshData={refreshStorageData}
        />
      )}

      {isAccountOpen && (
        <AccountModal
          user={user}
          onClose={() => setIsAccountOpen(false)}
          onAuthenticated={async (u) => {
            await signedIn(u, true);
            setIsAccountOpen(false);
          }}
          onLogout={async () => {
            await pushDirty();
            await api.auth.logout();
            setSyncEnabled(false);
            clearLocalUserData();
            setUser(null);
            refreshStorageData();
            setIsAccountOpen(false);
          }}
          onDeleted={async () => {
            setSyncEnabled(false);
            clearLocalUserData();
            setUser(null);
            refreshStorageData();
            setIsAccountOpen(false);
          }}
        />
      )}

      {/* Admin Portal Modal (Crawler, Ads Shopee, Stories, Push Notifications) */}
      {isAdminOpen && (
        <AdminGate onClose={() => setIsAdminOpen(false)}>
        <Suspense fallback={null}>
        <AdminPortal
          stories={stories}
          ads={ads}
          onDataChanged={refreshStorageData}
          onClose={() => {
            setIsAdminOpen(false);
            refreshStorageData();
          }}
        />
        </Suspense>
        </AdminGate>
      )}

      {/* Footer */}
      {currentView !== 'reader' && (
        <Footer
          onSelectGenre={(genre) => {
            setSelectedGenre(genre);
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenAdmin={() => setIsAdminOpen(true)}
        />
      )}
    </div>
  );
}
