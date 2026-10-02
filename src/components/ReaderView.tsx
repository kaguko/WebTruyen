import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Highlighter,
  Sliders,
  Maximize,
  Minimize,
  FileText,
  X,
  Check,
  Share2,
  List,
  Sparkles,
  RotateCcw,
  MessageSquare,
  Copy,
  Trash2,
} from 'lucide-react';
import {
  Story,
  Chapter,
  ReaderSettings,
  PersonalNote,
  AdSlot,
} from '../types';
import {
  saveReadingHistory,
  loadChapters,
  getPersonalNotes,
  savePersonalNote,
  deletePersonalNote,
  isBookmarked,
  toggleBookmark,
} from '../services/storage';
import { api } from '../services/api';
import { ttsService, TTSState } from '../services/ttsService';
import { Language, translations } from '../services/i18n';
import { AdBanner } from './AdBanner';

interface ReaderViewProps {
  story: Story;
  initialChapterNumber: number;
  readerSettings: ReaderSettings;
  onUpdateSettings: (newSettings: ReaderSettings) => void;
  currentLang: Language;
  ads: AdSlot[];
  onBack: () => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  story,
  initialChapterNumber,
  readerSettings,
  onUpdateSettings,
  currentLang,
  ads,
  onBack,
}) => {
  const t = translations[currentLang];
  const [currentChapterNum, setCurrentChapterNum] = useState(initialChapterNumber);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  
  // UI Panels
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [showChapterSelector, setShowChapterSelector] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  // Auto-scroll
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const autoScrollTimerRef = useRef<number | null>(null);

  // Text-To-Speech
  const [ttsState, setTtsState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentParagraph: 0,
    totalParagraphs: 0,
  });

  // Note creation modal
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [selectedQuote, setSelectedQuote] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [noteColor, setNoteColor] = useState<'yellow' | 'green' | 'blue' | 'pink'>('yellow');
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Notes list for this story
  const [notes, setNotes] = useState<PersonalNote[]>([]);

  // Scroll Progress
  const [scrollPercent, setScrollPercent] = useState(0);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Load chapters
  useEffect(() => {
    let cancelled = false;
    void loadChapters(story.id).then((chapters) => {
      if (!cancelled) setAllChapters(chapters);
    });
    setBookmarked(isBookmarked(story.id));
    setNotes(getPersonalNotes(story.id));
    return () => {
      cancelled = true;
    };
  }, [story.id]);

  // Set active chapter
  useEffect(() => {
    if (allChapters.length === 0) return;
    const found = allChapters.find((c) => c.chapterNumber === currentChapterNum) || allChapters[0];
    setCurrentChapter(found);
    void api.countView(story.id, found.chapterNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Save reading history
    saveReadingHistory({
      storyId: story.id,
      storyTitle: story.title,
      storyCover: story.cover,
      chapterId: found.id,
      chapterNumber: found.chapterNumber,
      chapterTitle: found.title,
      scrollPercent: 0,
      updatedAt: new Date().toISOString(),
    });
  }, [currentChapterNum, allChapters, story]);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const percent = Math.min(100, Math.max(0, Math.round((scrollY / totalHeight) * 100)));
        setScrollPercent(percent);

        // Update history periodically
        if (currentChapter) {
          saveReadingHistory({
            storyId: story.id,
            storyTitle: story.title,
            storyCover: story.cover,
            chapterId: currentChapter.id,
            chapterNumber: currentChapter.chapterNumber,
            chapterTitle: currentChapter.title,
            scrollPercent: percent,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentChapter, story]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft' && currentChapterNum > 1) {
        goToPrevChapter();
      } else if (e.key === 'ArrowRight' && currentChapterNum < allChapters.length) {
        goToNextChapter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentChapterNum, allChapters]);

  // Auto-scroll loop
  useEffect(() => {
    if (isAutoScrolling) {
      const speed = readerSettings.autoScrollSpeed || 2;
      const step = speed * 1.5;
      autoScrollTimerRef.current = window.setInterval(() => {
        window.scrollBy({ top: step, behavior: 'smooth' });
      }, 50);
    } else {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    }
    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [isAutoScrolling, readerSettings.autoScrollSpeed]);

  const toggleAutoScroll = () => {
    setIsAutoScrolling((prev) => !prev);
  };

  const goToPrevChapter = () => {
    if (currentChapterNum > 1) {
      ttsService.stop();
      setCurrentChapterNum(currentChapterNum - 1);
    }
  };

  const goToNextChapter = () => {
    if (currentChapterNum < allChapters.length) {
      ttsService.stop();
      setCurrentChapterNum(currentChapterNum + 1);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Text-To-Speech handlers
  const handleToggleTTS = () => {
    if (!currentChapter) return;
    if (ttsState.isPlaying) {
      if (ttsState.isPaused) {
        ttsService.resume();
      } else {
        ttsService.pause();
      }
    } else {
      ttsService.startReading(
        currentChapter.content,
        0,
        readerSettings.ttsRate,
        (state) => setTtsState(state)
      );
    }
  };

  const handleStopTTS = () => {
    ttsService.stop();
    setTtsState({
      isPlaying: false,
      isPaused: false,
      currentParagraph: 0,
      totalParagraphs: 0,
    });
  };

  // Note creation
  const handleOpenNoteModal = (paraIndex: number, text: string) => {
    setActiveParagraphIndex(paraIndex);
    setSelectedQuote(text.slice(0, 150) + (text.length > 150 ? '...' : ''));
    setNoteInput('');
    setShowNoteModal(true);
  };

  const handleSaveNote = () => {
    if (!currentChapter || activeParagraphIndex === null) return;
    const newNote: PersonalNote = {
      id: `note-${Date.now()}`,
      storyId: story.id,
      storyTitle: story.title,
      chapterId: currentChapter.id,
      chapterNumber: currentChapter.chapterNumber,
      chapterTitle: currentChapter.title,
      paragraphIndex: activeParagraphIndex,
      selectedText: selectedQuote,
      noteText: noteInput.trim() || 'Đoạn trích tâm đắc',
      color: noteColor,
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };
    savePersonalNote(newNote);
    setNotes(getPersonalNotes(story.id));
    setShowNoteModal(false);
  };

  const handleDeleteNote = (noteId: string) => {
    deletePersonalNote(noteId);
    setNotes(getPersonalNotes(story.id));
  };

  const getContainerWidthClass = () => {
    switch (readerSettings.maxWidth) {
      case 'narrow':
        return 'max-w-2xl';
      case 'wide':
        return 'max-w-5xl';
      case 'full':
        return 'max-w-full px-4 sm:px-12';
      case 'standard':
      default:
        return 'max-w-3xl';
    }
  };

  const getFontFamilyClass = () => {
    switch (readerSettings.font) {
      case 'merriweather':
        return 'font-merriweather';
      case 'lora':
        return 'font-lora';
      case 'literata':
        return 'font-literata';
      case 'vietnam':
      default:
        return 'font-vietnam';
    }
  };

  const getThemeClass = () => {
    switch (readerSettings.theme) {
      case 'sepia':
        return 'theme-sepia';
      case 'dark':
        return 'theme-dark';
      case 'oled':
        return 'theme-oled';
      case 'light':
      default:
        return 'theme-light';
    }
  };

  const getHighlightColorClass = (color: string) => {
    switch (color) {
      case 'green':
        return 'hl-green';
      case 'blue':
        return 'hl-blue';
      case 'pink':
        return 'hl-pink';
      case 'yellow':
      default:
        return 'hl-yellow';
    }
  };

  if (!currentChapter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-stone-500">Đang tải nội dung chương...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${getThemeClass()}`}>
      {/* Top Floating Reading Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Back & Story Title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
              title="Quay lại chi tiết truyện"
            >
              <ArrowLeft className="w-5 h-5 text-stone-700 dark:text-stone-300" />
            </button>

            <div className="min-w-0">
              <div className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white truncate">
                {story.title}
              </div>
              <div className="text-[11px] text-stone-500 truncate">
                Chương {currentChapter.chapterNumber}: {currentChapter.title}
              </div>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* TTS Button */}
            <button
              onClick={handleToggleTTS}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                ttsState.isPlaying
                  ? 'bg-emerald-600 text-white animate-pulse'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              title={ttsState.isPlaying ? t.ttsStop : t.ttsPlay}
            >
              {ttsState.isPlaying ? (
                ttsState.isPaused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            {/* Auto-scroll toggle */}
            <button
              onClick={toggleAutoScroll}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                isAutoScrolling
                  ? 'bg-amber-500 text-white'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              title="Tự động cuộn trang"
            >
              <RotateCcw className={`w-4 h-4 ${isAutoScrolling ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline text-[11px]">Cuộn</span>
            </button>

            {/* Chapter Selector Dropdown / Drawer Button */}
            <button
              onClick={() => setShowChapterSelector(!showChapterSelector)}
              className="p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              title="Chọn chương"
            >
              <List className="w-4 h-4" />
            </button>

            {/* Notes Drawer Button */}
            <button
              onClick={() => setShowNotesDrawer(!showNotesDrawer)}
              className="relative p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              title="Ghi chú & Trích dẫn"
            >
              <FileText className="w-4 h-4" />
              {notes.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
              )}
            </button>

            {/* Bookmark button */}
            <button
              onClick={() => {
                const s = toggleBookmark(story.id);
                setBookmarked(s);
              }}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                bookmarked
                  ? 'text-amber-500'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              title="Lưu truyện"
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-amber-500' : ''}`} />
            </button>

            {/* Reader Settings Drawer Toggle */}
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className="p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              title={t.settings}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="hidden sm:flex p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Reading Progress Bar (Thin line at top) */}
        <div className="w-full h-1 bg-stone-200/50 dark:bg-stone-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-150"
            style={{ width: `${scrollPercent}%` }}
          />
        </div>
      </header>

      {/* TTS Active Audio Player floating widget */}
      {ttsState.isPlaying && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-stone-900 text-white rounded-full px-5 py-2.5 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold">
              Đoạn {ttsState.currentParagraph + 1}/{ttsState.totalParagraphs}
            </span>
          </div>

          <button
            onClick={() => (ttsState.isPaused ? ttsService.resume() : ttsService.pause())}
            className="p-1 rounded-full bg-stone-800 hover:bg-stone-700 cursor-pointer"
          >
            {ttsState.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={handleStopTTS}
            className="p-1 text-stone-400 hover:text-white cursor-pointer"
            title="Dừng đọc"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Chapter Content Container */}
      <main
        ref={contentContainerRef}
        className={`${getContainerWidthClass()} mx-auto px-4 sm:px-8 py-8 sm:py-12 transition-all`}
      >
        {/* Chapter Header */}
        <div className="text-center pb-8 border-b border-stone-200/60 dark:border-stone-800 mb-8">
          <h2 className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold mb-2">
            {story.title}
          </h2>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
            {currentChapter.title}
          </h1>
          <div className="text-xs text-stone-400 mt-2 flex items-center justify-center gap-3">
            <span>{currentChapter.wordCount.toLocaleString()} từ</span>
            <span>•</span>
            <span>Cập nhật: {currentChapter.publishedAt}</span>
          </div>
        </div>

        {/* Text Paragraphs */}
        <div
          className={`${getFontFamilyClass()} space-y-6 ${
            readerSettings.align === 'justify' ? 'text-justify' : 'text-left'
          }`}
          style={{
            fontSize: `${readerSettings.fontSize}px`,
            lineHeight: readerSettings.lineHeight,
          }}
        >
          {currentChapter.content.map((paragraph, index) => {
            // Find if this paragraph has personal notes
            const paragraphNote = notes.find(
              (n) => n.chapterId === currentChapter.id && n.paragraphIndex === index
            );

            const isReadingInTTS =
              ttsState.isPlaying && ttsState.currentParagraph === index;

            return (
              <div
                key={index}
                className={`relative group rounded-xl p-2 -mx-2 transition-colors ${
                  isReadingInTTS
                    ? 'bg-emerald-500/10 dark:bg-emerald-400/10 ring-1 ring-emerald-500/40'
                    : 'hover:bg-stone-500/5'
                }`}
              >
                {/* Note marker or text */}
                <p>
                  {paragraphNote ? (
                    <span className={getHighlightColorClass(paragraphNote.color)}>
                      {paragraph}
                    </span>
                  ) : (
                    paragraph
                  )}
                </p>

                {/* Attached note preview */}
                {paragraphNote && (
                  <div className="mt-2 text-xs italic bg-amber-100/70 dark:bg-stone-800 text-stone-800 dark:text-stone-300 p-2 rounded-lg border-l-4 border-amber-500 flex items-center justify-between">
                    <span>💡 {paragraphNote.noteText}</span>
                    <button
                      onClick={() => handleDeleteNote(paragraphNote.id)}
                      className="text-stone-400 hover:text-red-500 ml-2"
                      title="Xóa ghi chú"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Quick Add Note / Quote Action Button on hover */}
                <button
                  onClick={() => handleOpenNoteModal(index, paragraph)}
                  className="absolute -right-3 top-2 opacity-0 group-hover:opacity-100 p-1.5 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg shadow-md border border-stone-200 dark:border-stone-700 transition-all cursor-pointer hover:text-amber-500"
                  title="Ghi chú đoạn này"
                >
                  <Highlighter className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* In-reader Ad / Shopee Affiliate banner */}
        <AdBanner placement="IN_READER" ads={ads} />

        {/* End of Chapter Navigation Controls */}
        <div className="mt-12 pt-8 border-t border-stone-200/60 dark:border-stone-800 flex items-center justify-between gap-3">
          <button
            onClick={goToPrevChapter}
            disabled={currentChapterNum <= 1}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
              currentChapterNum <= 1
                ? 'opacity-40 cursor-not-allowed bg-stone-200 dark:bg-stone-800 text-stone-400'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t.prevChapter}</span>
          </button>

          <button
            onClick={() => setShowChapterSelector(true)}
            className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-300 hover:underline px-3 py-2 cursor-pointer"
          >
            Chương {currentChapter.chapterNumber} / {allChapters.length}
          </button>

          <button
            onClick={goToNextChapter}
            disabled={currentChapterNum >= allChapters.length}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition-all ${
              currentChapterNum >= allChapters.length
                ? 'opacity-40 cursor-not-allowed bg-stone-200 dark:bg-stone-800 text-stone-400'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
            }`}
          >
            <span>{t.nextChapter}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Reader Settings Drawer */}
      {showSettingsDrawer && (
        <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 shadow-2xl p-5 z-50 overflow-y-auto animate-in slide-in-from-right duration-200 text-stone-900 dark:text-white">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              {t.settings}
            </h3>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-6 mt-4">
            {/* Reading Theme */}
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                {t.theme}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'light', label: t.themeLight, bg: 'bg-[#fdfdfd]', text: 'text-stone-900', border: 'border-stone-300' },
                  { id: 'sepia', label: t.themeSepia, bg: 'bg-[#f6edd9]', text: 'text-[#382c1e]', border: 'border-amber-300' },
                  { id: 'dark', label: t.themeDark, bg: 'bg-[#1e2430]', text: 'text-slate-100', border: 'border-slate-700' },
                  { id: 'oled', label: t.themeOled, bg: 'bg-[#0b0c10]', text: 'text-[#c5c6c7]', border: 'border-stone-800' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => onUpdateSettings({ ...readerSettings, theme: th.id as any })}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${th.bg} ${th.text} ${
                      readerSettings.theme === th.id
                        ? 'ring-2 ring-emerald-500 font-bold shadow-sm'
                        : th.border
                    }`}
                  >
                    <span>{th.label}</span>
                    {readerSettings.theme === th.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                {t.font}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'vietnam', label: 'Be Vietnam Pro', fontClass: 'font-vietnam' },
                  { id: 'lora', label: 'Lora Serif', fontClass: 'font-lora' },
                  { id: 'merriweather', label: 'Merriweather', fontClass: 'font-merriweather' },
                  { id: 'literata', label: 'Literata Book', fontClass: 'font-literata' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onUpdateSettings({ ...readerSettings, font: f.id as any })}
                    className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${f.fontClass} ${
                      readerSettings.font === f.id
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
                <span>{t.fontSize}</span>
                <span className="font-bold text-stone-900 dark:text-white">
                  {readerSettings.fontSize}px
                </span>
              </div>
              <input
                type="range"
                min={14}
                max={32}
                step={1}
                value={readerSettings.fontSize}
                onChange={(e) =>
                  onUpdateSettings({ ...readerSettings, fontSize: Number(e.target.value) })
                }
                className="w-full accent-emerald-600"
              />
            </div>

            {/* Line Height */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
                <span>{t.lineHeight}</span>
                <span className="font-bold text-stone-900 dark:text-white">
                  {readerSettings.lineHeight}
                </span>
              </div>
              <div className="flex gap-2">
                {[1.4, 1.6, 1.8, 2.0].map((lh) => (
                  <button
                    key={lh}
                    onClick={() => onUpdateSettings({ ...readerSettings, lineHeight: lh })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      readerSettings.lineHeight === lh
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {lh}
                  </button>
                ))}
              </div>
            </div>

            {/* Container Width */}
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                {t.readingWidth}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'narrow', label: 'Hẹp' },
                  { id: 'standard', label: 'Chuẩn' },
                  { id: 'wide', label: 'Rộng' },
                  { id: 'full', label: 'Tối đa' },
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => onUpdateSettings({ ...readerSettings, maxWidth: w.id as any })}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      readerSettings.maxWidth === w.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Alignment */}
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                Căn lề
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onUpdateSettings({ ...readerSettings, align: 'left' })}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    readerSettings.align === 'left'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  Căn trái
                </button>
                <button
                  onClick={() => onUpdateSettings({ ...readerSettings, align: 'justify' })}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    readerSettings.align === 'justify'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  Căn đều 2 bên
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Selection Drawer */}
      {showChapterSelector && (
        <div className="fixed inset-y-0 left-0 w-80 sm:w-96 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 shadow-2xl p-5 z-50 overflow-y-auto animate-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white">
              {t.chaptersList} ({allChapters.length})
            </h3>
            <button
              onClick={() => setShowChapterSelector(false)}
              className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-1">
            {allChapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => {
                  setCurrentChapterNum(ch.chapterNumber);
                  setShowChapterSelector(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center justify-between ${
                  ch.chapterNumber === currentChapterNum
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <span className="truncate">{ch.title}</span>
                {ch.chapterNumber === currentChapterNum && <Check className="w-4 h-4 shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Personal Notes & Quotes Drawer */}
      {showNotesDrawer && (
        <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 shadow-2xl p-5 z-50 overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              {t.yourNotes} ({notes.length})
            </h3>
            <button
              onClick={() => setShowNotesDrawer(false)}
              className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {notes.length === 0 ? (
              <div className="text-center py-10 text-stone-400 text-xs sm:text-sm">
                {t.noNotes}
              </div>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>Chương {n.chapterNumber}</span>
                    <span>{n.createdAt}</span>
                  </div>

                  <p className="text-xs italic text-stone-600 dark:text-stone-300 border-l-2 border-amber-400 pl-2 line-clamp-3">
                    "{n.selectedText}"
                  </p>

                  <div className="text-xs font-semibold text-stone-900 dark:text-white">
                    💡 {n.noteText}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleDeleteNote(n.id)}
                      className="text-stone-400 hover:text-red-500 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 text-stone-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-4">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Highlighter className="w-4 h-4 text-amber-500" />
                {t.addNote} & Đánh Dấu
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs italic text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800 p-3 rounded-xl border border-stone-200 dark:border-stone-700 line-clamp-3 mb-4">
              "{selectedQuote}"
            </p>

            <div className="mb-4">
              <label className="text-xs font-semibold text-stone-500 block mb-2">
                Chọn màu tô sáng:
              </label>
              <div className="flex gap-2">
                {(['yellow', 'green', 'blue', 'pink'] as const).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNoteColor(col)}
                    className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                      col === 'yellow'
                        ? 'bg-yellow-300'
                        : col === 'green'
                        ? 'bg-green-300'
                        : col === 'blue'
                        ? 'bg-sky-300'
                        : 'bg-pink-300'
                    } ${noteColor === col ? 'border-emerald-600 scale-110 shadow-sm' : 'border-transparent'}`}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-stone-500 block mb-1">
                Ghi chú của bạn (cảm nghĩ, suy đoán, nhân vật):
              </label>
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Ví dụ: Đoạn này main bắt đầu ngộ đạo, tâm đắc nhất câu này..."
                rows={3}
                className="w-full p-3 text-xs sm:text-sm bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm"
              >
                {t.saveNote}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
