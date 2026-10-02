import React, { useState } from 'react';
import {
  History,
  Bookmark,
  FileText,
  Download,
  Trash2,
  BookOpen,
  ArrowRight,
  X,
  ExternalLink,
  Copy,
  Check,
  HardDrive,
  FileDown,
} from 'lucide-react';
import { Story, ReadingHistoryItem, BookmarkItem, PersonalNote, OfflineStoryData } from '../types';
import {
  clearReadingHistory,
  deletePersonalNote,
  removeOfflineStory,
} from '../services/storage';
import { Language, translations } from '../services/i18n';

interface UserCabinetsProps {
  initialTab: 'history' | 'bookmarks' | 'notes' | 'offline';
  stories: Story[];
  history: ReadingHistoryItem[];
  bookmarks: BookmarkItem[];
  notes: PersonalNote[];
  offlineStories: Record<string, OfflineStoryData>;
  currentLang: Language;
  onClose: () => void;
  onReadChapter: (story: Story, chapterNumber: number) => void;
  onSelectStory: (story: Story) => void;
  onRefreshData: () => void;
}

export const UserCabinets: React.FC<UserCabinetsProps> = ({
  initialTab,
  stories,
  history,
  bookmarks,
  notes,
  offlineStories,
  currentLang,
  onClose,
  onReadChapter,
  onSelectStory,
  onRefreshData,
}) => {
  const t = translations[currentLang];
  const [activeTab, setActiveTab] = useState<'history' | 'bookmarks' | 'notes' | 'offline'>(
    initialTab
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Match bookmarked stories
  const bookmarkedStories = bookmarks
    .map((b) => stories.find((s) => s.id === b.storyId))
    .filter(Boolean) as Story[];

  const handleClearHistory = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử đọc truyện?')) {
      clearReadingHistory();
      onRefreshData();
    }
  };

  const handleDeleteNote = (id: string) => {
    deletePersonalNote(id);
    onRefreshData();
  };

  const handleCopyQuote = (note: PersonalNote) => {
    navigator.clipboard?.writeText(`"${note.selectedText}" - [${note.storyTitle}, Chương ${note.chapterNumber}]`);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportTxt = (offlineItem: OfflineStoryData) => {
    const content = `TRUYỆN: ${offlineItem.story.title}\nTÁC GIẢ: ${offlineItem.story.author}\nNGUỒN: TruyenFull Live\n\n` +
      offlineItem.chapters.map(c => `=== ${c.title} ===\n\n${c.content.join('\n\n')}\n\n`).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${offlineItem.story.slug}-offline.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden text-stone-900">
        {/* Header with Tabs */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'history', label: t.history, icon: History, count: history.length },
              { id: 'bookmarks', label: t.cabinet, icon: Bookmark, count: bookmarks.length },
              { id: 'notes', label: t.notes, icon: FileText, count: notes.length },
              { id: 'offline', label: t.offline, icon: Download, count: Object.keys(offlineStories).length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-stone-600 hover:bg-stone-200/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden xs:inline">{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isActive ? 'bg-white text-emerald-800' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* TAB: HISTORY */}
          {activeTab === 'history' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-stone-500">
                  Lưu tiến độ đọc và vị trí % cuộn trang mới nhất
                </span>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa tất cả</span>
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="py-16 text-center text-stone-400 text-sm">
                  {t.emptyHistory}
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => {
                    const matchedStory = stories.find((s) => s.id === item.storyId);
                    return (
                      <div
                        key={item.storyId}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200 hover:bg-emerald-50/40 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={item.storyCover}
                            alt={item.storyTitle}
                            className="w-12 h-16 object-cover rounded-xl shadow-xs shrink-0"
                          />
                          <div className="min-w-0">
                            <h4
                              onClick={() => matchedStory && onSelectStory(matchedStory)}
                              className="font-bold text-xs sm:text-sm text-stone-900 hover:text-emerald-700 cursor-pointer truncate"
                            >
                              {item.storyTitle}
                            </h4>
                            <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                              Đang đọc: {item.chapterTitle}
                            </div>
                            <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-3">
                              <span>Tiến độ: {item.scrollPercent}%</span>
                              <span>•</span>
                              <span>{new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (matchedStory) {
                              onReadChapter(matchedStory, item.chapterNumber);
                              onClose();
                            }
                          }}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs shrink-0"
                        >
                          <span>Đọc Tiếp</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: BOOKMARKS */}
          {activeTab === 'bookmarks' && (
            <div>
              <div className="mb-4 text-xs font-semibold text-stone-500">
                Truyện bạn đã theo dõi để nhận thông báo chương mới
              </div>

              {bookmarkedStories.length === 0 ? (
                <div className="py-16 text-center text-stone-400 text-sm">
                  {t.emptyCabinet}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {bookmarkedStories.map((story) => (
                    <div
                      key={story.id}
                      onClick={() => {
                        onSelectStory(story);
                        onClose();
                      }}
                      className="p-3 rounded-2xl bg-stone-50 border border-stone-200 hover:border-emerald-300 transition-all cursor-pointer flex items-center gap-3 group"
                    >
                      <img
                        src={story.cover}
                        alt={story.title}
                        className="w-12 h-16 object-cover rounded-xl shrink-0 group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-emerald-700 truncate">
                          {story.title}
                        </h4>
                        <div className="text-[11px] text-stone-500 mt-0.5 truncate">
                          {story.author}
                        </div>
                        <div className="text-[11px] text-emerald-600 font-medium mt-1">
                          {story.totalChapters} chương
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PERSONAL NOTES */}
          {activeTab === 'notes' && (
            <div>
              <div className="mb-4 text-xs font-semibold text-stone-500">
                Tất cả các đoạn trích tâm đắc và ghi chú cá nhân hóa của bạn
              </div>

              {notes.length === 0 ? (
                <div className="py-16 text-center text-stone-400 text-sm">
                  {t.noNotes}
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-900">
                          {note.storyTitle} - Chương {note.chapterNumber}
                        </span>
                        <span className="text-stone-400">{note.createdAt}</span>
                      </div>

                      <blockquote className="text-xs sm:text-sm italic text-stone-700 bg-white p-3 rounded-xl border-l-4 border-amber-400">
                        "{note.selectedText}"
                      </blockquote>

                      <div className="text-xs font-semibold text-emerald-800">
                        💡 {note.noteText}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                        <button
                          onClick={() => handleCopyQuote(note)}
                          className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 px-2 py-1 rounded-lg cursor-pointer"
                        >
                          {copiedId === note.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Sao chép trích dẫn</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: OFFLINE LIBRARY */}
          {activeTab === 'offline' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  <span>Đọc không cần mạng Internet (IndexedDB & Local Cache)</span>
                </div>
              </div>

              {Object.keys(offlineStories).length === 0 ? (
                <div className="py-16 text-center text-stone-400 text-sm">
                  Chưa có truyện nào được tải về. Vào trang chi tiết truyện và nhấn "Tải Về Máy" để đọc offline!
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.values(offlineStories).map((item) => (
                    <div
                      key={item.story.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-stone-50 border border-stone-200 gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.story.cover}
                          alt={item.story.title}
                          className="w-12 h-16 object-cover rounded-xl shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-stone-900">
                            {item.story.title}
                          </h4>
                          <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                            Đã lưu trữ {item.chapters.length} chương offline
                          </div>
                          <div className="text-[11px] text-stone-400 mt-1">
                            Dung lượng: ~{(item.sizeBytes / 1024).toFixed(1)} KB • Tải: {new Date(item.downloadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleExportTxt(item)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-xl cursor-pointer"
                          title="Xuất file TXT đọc máy đọc sách"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Xuất TXT</span>
                        </button>
                        <button
                          onClick={() => {
                            onReadChapter(item.story, 1);
                            onClose();
                          }}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Đọc Offline
                        </button>
                        <button
                          onClick={() => {
                            removeOfflineStory(item.story.id);
                            onRefreshData();
                          }}
                          className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg cursor-pointer"
                          title="Xóa cache"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
