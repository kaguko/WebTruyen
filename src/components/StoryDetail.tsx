import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Bookmark,
  Download,
  Star,
  CheckCircle,
  Eye,
  Calendar,
  Share2,
  ArrowLeft,
  Search,
  MessageSquare,
  ThumbsUp,
  Send,
  Sparkles,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { Story, Chapter, StoryComment, AdSlot } from '../types';
import {
  loadChapters,
  getReadingHistory,
  isBookmarked,
  toggleBookmark,
  isStoryOffline,
  saveStoryOffline,
  removeOfflineStory,
} from '../services/storage';
import { api } from '../services/api';
import { formatTime } from '../services/format';
import { Language, translations } from '../services/i18n';
import { AdBanner } from './AdBanner';

interface StoryDetailProps {
  story: Story;
  currentLang: Language;
  ads: AdSlot[];
  onBack: () => void;
  onReadChapter: (story: Story, chapterNumber: number) => void;
  onSelectGenre: (genre: string) => void;
}

export const StoryDetail: React.FC<StoryDetailProps> = ({
  story,
  currentLang,
  ads,
  onBack,
  onReadChapter,
  onSelectGenre,
}) => {
  const t = translations[currentLang];
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [bookmarked, setBookmarked] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'synopsis' | 'chapters' | 'comments'>('synopsis');
  const [chapterSearch, setChapterSearch] = useState('');
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentRating, setNewCommentRating] = useState(5);
  const [copiedLink, setCopiedLink] = useState(false);

  // Check reading history for "Continue Reading"
  const history = getReadingHistory();
  const historyItem = history.find((h) => h.storyId === story.id);

  useEffect(() => {
    let cancelled = false;
    void loadChapters(story.id).then((list) => {
      if (!cancelled) setChapters(list);
    });
    setBookmarked(isBookmarked(story.id));
    setIsOffline(isStoryOffline(story.id));
    api.comments(story.id).then((c) => !cancelled && setComments(c)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [story.id]);

  const handleToggleBookmark = () => {
    const newState = toggleBookmark(story.id);
    setBookmarked(newState);
  };

  const handleDownloadOffline = async () => {
    if (isOffline) {
      removeOfflineStory(story.id);
      setIsOffline(false);
      return;
    }

    setDownloading(true);
    setDownloadProgress(20);

    // Simulate downloading chapters in batches
    await new Promise((r) => setTimeout(r, 400));
    setDownloadProgress(60);
    await new Promise((r) => setTimeout(r, 400));
    setDownloadProgress(100);

    saveStoryOffline(story, chapters);
    setIsOffline(true);
    setDownloading(false);
    setDownloadProgress(0);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      const created = await api.addComment(story.id, { content: newCommentText.trim(), rating: newCommentRating });
      setComments([created, ...comments]);
      setNewCommentText('');
    } catch (err: any) {
      alert(err?.message || 'Không gửi được bình luận');
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const filteredChapters = chapterSearch.trim()
    ? chapters.filter(
        (c) =>
          c.title.toLowerCase().includes(chapterSearch.toLowerCase()) ||
          c.chapterNumber.toString().includes(chapterSearch.trim())
      )
    : chapters;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 animate-in fade-in duration-300">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-600 hover:text-emerald-700 p-2 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.home}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-emerald-700 bg-stone-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{copiedLink ? 'Đã sao chép liên kết!' : 'Chia sẻ'}</span>
        </button>
      </div>

      {/* Main Info Box */}
      <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Cover Image */}
          <div className="w-44 sm:w-56 aspect-[3/4] shrink-0 mx-auto md:mx-0 rounded-2xl overflow-hidden shadow-xl border border-stone-100 relative">
            <img
              src={story.cover}
              alt={story.title}
              className="w-full h-full object-cover"
            />
            {story.status === 'COMPLETED' && (
              <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                FULL
              </span>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    story.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {story.status === 'COMPLETED' ? t.completed : t.ongoing}
                </span>

                {story.isHot && (
                  <span className="bg-red-100 text-red-700 font-bold text-xs px-2.5 py-0.5 rounded-full">
                    🔥 Thịnh hành
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
                {story.title}
              </h1>

              <div className="text-xs sm:text-sm text-stone-600 mt-2 space-y-1">
                <div>
                  <span className="text-stone-400">{t.author}:</span>{' '}
                  <strong className="text-stone-800 font-semibold">{story.author}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400">{t.rating}:</span>
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{story.rating.score.toFixed(1)} / 5</span>
                    <span className="text-stone-400 font-normal text-xs">
                      ({story.rating.count.toLocaleString()} đánh giá)
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-stone-400">{t.views}:</span>{' '}
                  <span className="font-semibold">{story.views.toLocaleString()}</span> lượt xem
                </div>
              </div>

              {/* Genres list */}
              <div className="flex flex-wrap gap-1.5 my-3">
                {story.genres.map((g) => (
                  <button
                    key={g}
                    onClick={() => onSelectGenre(g)}
                    className="text-xs font-medium bg-stone-100 hover:bg-emerald-50 hover:text-emerald-700 text-stone-700 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-2.5">
              {/* Read from Start */}
              <button
                onClick={() => onReadChapter(story, 1)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 transition-all cursor-pointer hover:scale-102"
              >
                <BookOpen className="w-4 h-4" />
                <span>{t.readFromBeginning}</span>
              </button>

              {/* Continue Reading if history exists */}
              {historyItem && (
                <button
                  onClick={() => onReadChapter(story, historyItem.chapterNumber)}
                  className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md shadow-teal-800/20 transition-all cursor-pointer"
                >
                  <span>{t.continueReading} Ch {historyItem.chapterNumber}</span>
                </button>
              )}

              {/* Save to Cabinet */}
              <button
                onClick={handleToggleBookmark}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border ${
                  bookmarked
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                <span>{bookmarked ? t.inCabinet : t.addToCabinet}</span>
              </button>

              {/* Offline Download button */}
              <button
                onClick={handleDownloadOffline}
                disabled={downloading}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border ${
                  isOffline
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {downloading
                    ? `${t.downloading} ${downloadProgress}%`
                    : isOffline
                    ? `✓ ${t.downloaded}`
                    : t.downloadOffline}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shopee Affiliate Sponsor Banner */}
      <AdBanner placement="HEADER_BANNER" ads={ads} />

      {/* Tabs */}
      <div className="mt-8 bg-white rounded-3xl border border-stone-200 p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-4 border-b border-stone-200 pb-3">
          <button
            onClick={() => setActiveTab('synopsis')}
            className={`font-bold text-sm sm:text-base pb-2 transition-colors relative cursor-pointer ${
              activeTab === 'synopsis'
                ? 'text-emerald-700 font-extrabold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.synopsis}
            {activeTab === 'synopsis' && (
              <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('chapters')}
            className={`font-bold text-sm sm:text-base pb-2 transition-colors relative cursor-pointer ${
              activeTab === 'chapters'
                ? 'text-emerald-700 font-extrabold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.chaptersList} ({chapters.length})
            {activeTab === 'chapters' && (
              <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`font-bold text-sm sm:text-base pb-2 transition-colors relative cursor-pointer ${
              activeTab === 'comments'
                ? 'text-emerald-700 font-extrabold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.comments} ({comments.length})
            {activeTab === 'comments' && (
              <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Synopsis */}
        {activeTab === 'synopsis' && (
          <div className="pt-5 text-stone-700 text-sm sm:text-base leading-relaxed space-y-3 font-serif">
            <p>{story.description}</p>
            {story.recommendedReason && (
              <div className="mt-4 p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 font-sans">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-emerald-900">
                  <strong>Nhận xét từ TruyenFull Live:</strong> {story.recommendedReason}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Chapters List */}
        {activeTab === 'chapters' && (
          <div className="pt-4">
            <div className="relative mb-4 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                placeholder="Tìm số chương hoặc tên chương..."
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-stone-100 rounded-xl border border-stone-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {filteredChapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => onReadChapter(story, ch.chapterNumber)}
                  className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-emerald-50 hover:text-emerald-800 text-left transition-colors cursor-pointer border border-stone-100 group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-xs sm:text-sm text-stone-900 group-hover:text-emerald-700 truncate">
                      {ch.title}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      {ch.wordCount.toLocaleString()} chữ
                    </div>
                  </div>
                  <BookOpen className="w-4 h-4 text-stone-300 group-hover:text-emerald-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Comments & Ratings */}
        {activeTab === 'comments' && (
          <div className="pt-4 space-y-6">
            {/* Form */}
            <form onSubmit={handlePostComment} className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs sm:text-sm text-stone-900">
                  Để lại bình luận & đánh giá
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewCommentRating(star)}
                      className="cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= newCommentRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-stone-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={t.leaveComment}
                rows={3}
                className="w-full p-3 text-xs sm:text-sm bg-white rounded-xl border border-stone-200 focus:outline-none focus:border-emerald-500 resize-none"
              />

              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t.postComment}</span>
                </button>
              </div>
            </form>

            {/* List */}
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={c.authorAvatar}
                        alt={c.authorName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-bold text-xs text-stone-900">{c.authorName}</div>
                        <div className="text-[10px] text-stone-400">{formatTime(c.createdAt)}</div>
                      </div>
                    </div>

                    {c.rating && (
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: c.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-stone-700 mt-2.5 leading-relaxed">
                    {c.content}
                  </p>

                  <div className="flex items-center gap-4 mt-3 text-stone-400 text-xs">
                    <button className="flex items-center gap-1 hover:text-emerald-700 cursor-pointer">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{c.likes}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
