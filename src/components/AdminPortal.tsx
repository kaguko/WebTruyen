import React, { useState, useEffect } from 'react';
import {
  Shield,
  Bot,
  ShoppingBag,
  BookOpen,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Edit,
  ExternalLink,
  RotateCcw,
  Sparkles,
  TrendingUp,
  X,
  Bell,
  Sliders,
  DollarSign,
  Download,
  Upload,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { Story, AdSlot, AdPlacement, Genre, PushNotification } from '../types';
import {
  exportAllUserData,
  importUserData,
} from '../services/storage';
import { api, type CrawlStatus } from '../services/api';
import { DashboardTab } from './DashboardTab';

interface AdminPortalProps {
  stories: Story[];
  ads: AdSlot[];
  onDataChanged: () => void;
  onClose: () => void;
}

export type AdminTab = 'dashboard' | 'stories' | 'crawler' | 'ads_shopee' | 'push' | 'sync';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  stories,
  ads,
  onDataChanged,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Crawler State
  const [selectedStoryId, setSelectedStoryId] = useState<string>(stories[0]?.id || '');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlLimit, setCrawlLimit] = useState(100);
  const [crawlProgress, setCrawlProgress] = useState<{ added: number; total: number }>({ added: 0, total: 0 });
  const [stopping, setStopping] = useState(false);
  const [linkSelector, setLinkSelector] = useState('');
  const [contentSelector, setContentSelector] = useState('');
  const [titleSelector, setTitleSelector] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preview, setPreview] = useState<{ chapterTotal: number; pages: number; firstTitle: string; sample: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewErr, setPreviewErr] = useState('');
  const [crawlerLogs, setCrawlerLogs] = useState<string[]>([
    'Dán link trang truyện nguồn, bấm "Thử trước" để kiểm tra, rồi bấm "Kích Hoạt Cào Ngay".',
  ]);

  // Manual chapter form
  const [chapterStoryId, setChapterStoryId] = useState<string>(stories[0]?.id || '');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [chapterMsg, setChapterMsg] = useState('');

  // Ad / Shopee Management State
  const [adsList, setAdsList] = useState<AdSlot[]>(ads);
  const [editingAd, setEditingAd] = useState<AdSlot | null>(null);
  const [showAdModal, setShowAdModal] = useState(false);

  // New Story State
  const [showAddStoryModal, setShowAddStoryModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGenres, setNewGenres] = useState<Genre[]>(['Tiên Hiệp']);

  // Push Notification State
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushSentSuccess, setPushSentSuccess] = useState(false);
  const [pushError, setPushError] = useState('');
  const [pushSending, setPushSending] = useState(false);

  // Sync token state
  const [syncToken, setSyncToken] = useState('');
  const [importTokenInput, setImportTokenInput] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Keep the selected stories valid when the list changes (e.g. the first story was just added).
  useEffect(() => {
    const first = stories[0]?.id || '';
    setSelectedStoryId((cur) => (stories.some((s) => s.id === cur) ? cur : first));
    setChapterStoryId((cur) => (stories.some((s) => s.id === cur) ? cur : first));
  }, [stories]);

  useEffect(() => {
    if (!selectedStoryId) return;
    api.admin
      .crawlConfig(selectedStoryId)
      .then((cfg) => {
        if (!cfg) return;
        setTargetUrl(cfg.tocUrl);
        setLinkSelector(cfg.linkSelector || '');
        setContentSelector(cfg.contentSelector || '');
        setTitleSelector(cfg.titleSelector || '');
        if (cfg.linkSelector || cfg.contentSelector || cfg.titleSelector) setShowAdvanced(true);
      })
      .catch(() => {});
    // A crawl keeps running on the server after the panel is closed: pick it up again.
    api.admin
      .crawlStatus(selectedStoryId)
      .then((st) => {
        applyCrawlStatus(st);
        setIsCrawling(st.running);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoryId]);

  const applyCrawlStatus = (st: CrawlStatus) => {
    setCrawlProgress({ added: st.added, total: st.total });
    setStopping(!!st.stopRequested && st.running);
    if (st.logs.length === 0 && !st.error) return;
    const lines = st.logs.slice(-300).reverse();
    if (st.error) lines.unshift(`Lỗi: ${st.error}`);
    else if (!st.running) lines.unshift(`Hoàn tất: thêm ${st.added} chương mới.`);
    setCrawlerLogs(lines);
  };

  // Poll progress while a crawl runs.
  useEffect(() => {
    if (!isCrawling || !selectedStoryId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await api.admin.crawlStatus(selectedStoryId);
        if (cancelled) return;
        applyCrawlStatus(st);
        if (!st.running) {
          setIsCrawling(false);
          onDataChanged();
        }
      } catch {
        /* transient network error: keep polling */
      }
    };
    const t = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCrawling, selectedStoryId]);

  const fail = (e: unknown) => alert((e as Error)?.message || 'Thao tác thất bại');

  // Handler: Run crawler
  const handleStartCrawl = async () => {
    if (isCrawling) return;
    if (!selectedStoryId) {
      setCrawlerLogs(['Lỗi: chưa chọn truyện. Hãy tạo truyện ở tab "Quản Lý Truyện" trước.']);
      return;
    }
    if (!targetUrl.trim()) {
      setCrawlerLogs(['Lỗi: chưa nhập link trang mục lục của truyện nguồn.']);
      return;
    }
    setIsCrawling(true);
    setStopping(false);
    setCrawlProgress({ added: 0, total: 0 });
    setCrawlerLogs([`[${new Date().toLocaleTimeString()}] Bắt đầu cào tối đa ${crawlLimit} chương: ${targetUrl}`]);
    try {
      await api.admin.crawl(selectedStoryId, {
        tocUrl: targetUrl,
        linkSelector,
        contentSelector,
        titleSelector: titleSelector || undefined,
        limit: crawlLimit,
      });
    } catch (e) {
      setCrawlerLogs([`Lỗi: ${(e as Error).message}`]);
      setIsCrawling(false);
    }
  };

  const handlePreview = async () => {
    if (!targetUrl.trim()) {
      setPreviewErr('Hãy dán link truyện nguồn trước.');
      return;
    }
    setPreviewing(true);
    setPreview(null);
    setPreviewErr('');
    try {
      setPreview(await api.admin.crawlPreview({ tocUrl: targetUrl, linkSelector, contentSelector }));
    } catch (e) {
      setPreviewErr((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleStopCrawl = async () => {
    if (!selectedStoryId) return;
    setStopping(true);
    try {
      await api.admin.crawlStop(selectedStoryId);
    } catch (e) {
      setStopping(false);
      fail(e);
    }
  };

  useEffect(() => setAdsList(ads), [ads]);

  // Toggle Ad status
  const handleToggleAd = async (adId: string) => {
    const ad = adsList.find((a) => a.id === adId);
    if (!ad) return;
    try {
      await api.admin.updateAd(adId, { ...ad, isEnabled: !ad.isEnabled });
      onDataChanged();
    } catch (e) {
      fail(e);
    }
  };

  // Save edited or new ad
  const handleSaveAd = async (ad: AdSlot) => {
    try {
      if (adsList.some((a) => a.id === ad.id)) await api.admin.updateAd(ad.id, ad);
      else await api.admin.createAd(ad);
      onDataChanged();
      setShowAdModal(false);
      setEditingAd(null);
    } catch (e) {
      fail(e);
    }
  };

  // Delete Ad
  const handleDeleteAd = async (adId: string) => {
    if (!confirm('Xóa quảng cáo này?')) return;
    try {
      await api.admin.deleteAd(adId);
      onDataChanged();
    } catch (e) {
      fail(e);
    }
  };

  // Add new story
  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await api.admin.createStory({
        title: newTitle,
        author: newAuthor,
        cover: newCover,
        description: newDesc,
        genres: newGenres,
      });
      onDataChanged();
      setShowAddStoryModal(false);
      setNewTitle('');
      setNewAuthor('');
      setNewCover('');
      setNewDesc('');
    } catch (err) {
      fail(err);
    }
  };

  const handleDeleteStory = async (story: Story) => {
    if (!confirm(`Xóa truyện "${story.title}" cùng toàn bộ chương và bình luận?`)) return;
    try {
      await api.admin.deleteStory(story.id);
      onDataChanged();
    } catch (err) {
      fail(err);
    }
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterStoryId) return;
    try {
      const ch = await api.admin.addChapter(chapterStoryId, { title: chapterTitle, content: chapterContent });
      setChapterMsg(`✓ Đã thêm chương ${ch.chapterNumber}`);
      setChapterTitle('');
      setChapterContent('');
      onDataChanged();
    } catch (err) {
      setChapterMsg(`❌ ${(err as Error).message}`);
    }
  };

  // Send push notification
  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pushSending) return;
    if (!pushTitle.trim() || !pushMessage.trim()) {
      setPushError(!pushTitle.trim() ? 'Hãy nhập tiêu đề thông báo.' : 'Hãy nhập nội dung thông báo (ô thứ hai).');
      return;
    }
    setPushError('');
    setPushSending(true);
    try {
      await api.admin.push(pushTitle.trim(), pushMessage.trim());
    } catch (err) {
      setPushError((err as Error).message || 'Gửi thất bại');
      return;
    } finally {
      setPushSending(false);
    }
    setPushSentSuccess(true);
    setPushTitle('');
    setPushMessage('');
    setTimeout(() => setPushSentSuccess(false), 3000);
  };

  // Generate sync token
  const handleGenerateSyncToken = () => {
    const data = exportAllUserData();
    const token = btoa(encodeURIComponent(data));
    setSyncToken(token);
  };

  // Import sync token
  const handleImportToken = () => {
    try {
      const decoded = decodeURIComponent(atob(importTokenInput.trim()));
      const success = importUserData(decoded);
      if (success) {
        setImportStatus('✓ Đồng bộ dữ liệu thành công! Khởi động lại dữ liệu ứng dụng.');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setImportStatus('❌ Dữ liệu không hợp lệ.');
      }
    } catch {
      setImportStatus('❌ Mã đồng bộ bị lỗi định dạng.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden text-stone-900">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-700/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg">
                  Bảng Quản Trị Hệ Thống (Admin Control)
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  TruyenFull Live Core
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Quản lý Crawler tự động, Quảng cáo & Affiliate Shopee, Nội dung truyện và Push Notifications
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                await api.admin.logout();
              } finally {
                onClose();
              }
            }}
            className="ml-auto mr-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-stone-200 px-4 sm:px-6 bg-white overflow-x-auto text-xs font-semibold">
          {[
            { id: 'dashboard', label: 'Tổng Quan', icon: LayoutDashboard },
            { id: 'stories', label: 'Quản Lý Truyện', icon: BookOpen },
            { id: 'crawler', label: 'Bộ Thu Thập (Crawler)', icon: Bot },
            { id: 'ads_shopee', label: 'Quảng Cáo & Shopee Aff', icon: ShoppingBag },
            { id: 'push', label: 'Thông Báo Đẩy (Push)', icon: Bell },
            { id: 'sync', label: 'Đồng Bộ & Sao Lưu', icon: RotateCcw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-50/50">
          {activeTab === 'dashboard' && (
            <DashboardTab
              onGoTo={setActiveTab}
              dataVersion={stories.length + ads.length}
            />
          )}

          {/* TAB 1: CRAWLER */}
          {activeTab === 'crawler' && (
            <div className="space-y-6">
              {/* Crawler Configuration Card */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-extrabold text-sm sm:text-base">
                      Thu Thập Chương Mới Từ Website Nguồn
                    </h3>
                  </div>
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
                    Cấu hình được lưu cho quét tự động (CRAWL_INTERVAL_MIN)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-600 block mb-1">
                      Chọn truyện nhận chương mới:
                    </label>
                    <select
                      value={selectedStoryId}
                      onChange={(e) => setSelectedStoryId(e.target.value)}
                      className="w-full p-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    >
                      {stories.length === 0 && <option value="">(Chưa có truyện nào)</option>}
                      {stories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.totalChapters} chương)
                        </option>
                      ))}
                    </select>
                    {stories.length === 0 && (
                      <p className="mt-1.5 text-[11px] text-amber-700">
                        Crawler chỉ thêm chương vào truyện đã có. Hãy vào tab{' '}
                        <button
                          type="button"
                          onClick={() => setActiveTab('stories')}
                          className="underline font-semibold cursor-pointer"
                        >
                          Quản Lý Truyện
                        </button>{' '}
                        để tạo truyện trước.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-600 block mb-1">
                      Link trang mục lục của truyện nguồn:
                    </label>
                    <input
                      type="text"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://nguon-truyen.com/ten-truyen/"
                      className="w-full p-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewing || isCrawling}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 cursor-pointer"
                  >
                    {previewing ? 'Đang kiểm tra...' : 'Thử trước (không lưu gì)'}
                  </button>
                  {previewErr && <p className="mt-2 text-xs text-red-600">{previewErr}</p>}
                  {preview && (
                    <div className="mt-2 text-xs bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-stone-700">
                      <p className="font-semibold text-emerald-700">
                        ✓ Nhận ra {preview.chapterTotal} chương ở trang 1{preview.pages > 1 ? ` (mục lục có ${preview.pages} trang, sẽ tự đọc hết)` : ''}. Chương đầu: {preview.firstTitle}
                      </p>
                      {preview.sample.map((t, i) => (
                        <p key={i} className="mt-1 text-stone-500">{t}</p>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="mt-4 text-xs font-semibold text-stone-500 underline cursor-pointer"
                >
                  {showAdvanced ? 'Ẩn Nâng cao' : 'Nâng cao (chỉ dùng khi "Thử trước" báo lỗi)'}
                </button>
                {showAdvanced && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    {[
                      ['Selector link chương (để trống = tự nhận)', linkSelector, setLinkSelector],
                      ['Selector nội dung chương (để trống = tự nhận)', contentSelector, setContentSelector],
                      ['Selector tiêu đề chương (tùy chọn)', titleSelector, setTitleSelector],
                    ].map(([label, value, setter]) => (
                      <div key={label as string}>
                        <label className="text-xs font-semibold text-stone-600 block mb-1">{label as string}</label>
                        <input
                          type="text"
                          value={value as string}
                          onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                          className="w-full p-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-stone-500">
                  Chỉ cần dán link trang truyện, hệ thống tự tìm danh sách chương và nội dung. Chỉ tải các chương chưa có (chọn số chương mỗi lần, tối đa 1000). Cào chạy nền trên server, có thể đóng bảng này và quay lại xem tiến độ. Chỉ cào nội dung bạn có quyền sử dụng.
                </p>

                <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-end gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 mr-auto">
                    Số chương mỗi lần:
                    <select
                      value={crawlLimit}
                      onChange={(e) => setCrawlLimit(Number(e.target.value))}
                      disabled={isCrawling}
                      className="p-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-500"
                    >
                      {[20, 50, 100, 200, 500, 1000].map((n) => (
                        <option key={n} value={n}>
                          {n === 1000 ? '1000 (tối đa)' : n}
                        </option>
                      ))}
                    </select>
                  </label>
                  {isCrawling && (
                    <button
                      onClick={handleStopCrawl}
                      disabled={stopping}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 cursor-pointer"
                    >
                      {stopping ? 'Đang dừng...' : 'Dừng'}
                    </button>
                  )}
                  <button
                    onClick={handleStartCrawl}
                    disabled={isCrawling}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all cursor-pointer ${
                      isCrawling
                        ? 'bg-stone-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20 hover:scale-102'
                    }`}
                  >
                    <Play className={`w-4 h-4 ${isCrawling ? 'animate-spin' : ''}`} />
                    <span>{isCrawling ? 'Đang Thu Thập Dữ Liệu...' : 'Kích Hoạt Cào Ngay'}</span>
                  </button>
                </div>
              </div>

              {/* Live Crawler Status & Terminal Logs */}
              <div className="bg-stone-950 text-emerald-400 rounded-2xl p-4 sm:p-5 font-mono text-xs border border-stone-800 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3 text-stone-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-bold text-white">Crawler Console & Live Logs</span>
                  </div>
                  <span>
                    {isCrawling
                      ? crawlProgress.total > 0
                        ? `Đang chạy ${crawlProgress.added}/${crawlProgress.total} chương`
                        : 'Đang chạy...'
                      : 'Sẵn sàng'}
                  </span>
                </div>
                {isCrawling && crawlProgress.total > 0 && (
                  <div className="h-1.5 mb-3 rounded-full bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round((crawlProgress.added / crawlProgress.total) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Logs Terminal */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {crawlerLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUẢNG CÁO & SHOPEE AFFILIATE */}
          {activeTab === 'ads_shopee' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-stone-900">
                    Quản Lý Vị Trí Quảng Cáo & Link Affiliate Shopee
                  </h3>
                  <p className="text-xs text-stone-500">
                    Gắn banner sách, phụ kiện đọc sách, flash sale Shopee không làm gián đoạn trải nghiệm người đọc.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingAd({
                      id: `ad-${Date.now()}`,
                      title: '',
                      placement: 'HEADER_BANNER',
                      imageUrl: '',
                      targetUrl: 'https://shopee.vn',
                      affiliateCode: 'AFF_SHOPEE_NEW',
                      isShopee: true,
                      tag: 'Shopee Mall',
                      description: '',
                      isEnabled: true,
                      impressions: 0,
                      clicks: 0,
                    });
                    setShowAdModal(true);
                  }}
                  className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Banner Mới</span>
                </button>
              </div>

              {/* Ads Table / Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adsList.map((ad) => (
                  <div
                    key={ad.id}
                    className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {ad.isShopee ? (
                            <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3" />
                              Shopee Aff
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Sponsor
                            </span>
                          )}
                          <span className="bg-stone-100 text-stone-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            {ad.placement}
                          </span>
                        </div>

                        {/* Toggle On/Off Switch */}
                        <button
                          onClick={() => handleToggleAd(ad.id)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                            ad.isEnabled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          {ad.isEnabled ? 'Đang Chạy' : 'Tạm Dừng'}
                        </button>
                      </div>

                      <div className="flex gap-3 mt-2">
                        {ad.imageUrl && (
                          <img
                            src={ad.imageUrl}
                            alt={ad.title}
                            className="w-16 h-16 object-cover rounded-xl shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-stone-900 line-clamp-2">
                            {ad.title}
                          </h4>
                          <div className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                            {ad.description}
                          </div>
                          {ad.affiliateCode && (
                            <div className="text-[10px] text-orange-600 font-mono mt-1">
                              Mã ref: {ad.affiliateCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                      <div className="flex items-center gap-3 text-[11px]">
                        <span>👀 {ad.impressions.toLocaleString()} views</span>
                        <span>🎯 {ad.clicks.toLocaleString()} clicks</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingAd(ad);
                            setShowAdModal(true);
                          }}
                          className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-600 cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAd(ad.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: QUẢN LÝ TRUYỆN */}
          {activeTab === 'stories' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-stone-900">
                    Danh Sách Truyện Trong Hệ Thống ({stories.length})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Thêm mới, sửa trạng thái (Đang ra / Hoàn thành), kiểm tra số lượng chương.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddStoryModal(true)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Truyện Mới</span>
                </button>
              </div>

              <form onSubmit={handleAddChapter} className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                <h4 className="font-extrabold text-sm">Đăng chương thủ công</h4>
                <select
                  value={chapterStoryId}
                  onChange={(e) => setChapterStoryId(e.target.value)}
                  className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                >
                  {stories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.totalChapters} chương)
                    </option>
                  ))}
                </select>
                <input
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  placeholder="Tiêu đề chương"
                  className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                />
                <textarea
                  value={chapterContent}
                  onChange={(e) => setChapterContent(e.target.value)}
                  placeholder="Nội dung (mỗi đoạn một dòng)"
                  rows={6}
                  className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-600">{chapterMsg}</span>
                  <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer">
                    Đăng chương
                  </button>
                </div>
              </form>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="p-3">Truyện</th>
                      <th className="p-3">Tác giả</th>
                      <th className="p-3">Thể loại</th>
                      <th className="p-3">Số chương</th>
                      <th className="p-3">Trạng thái</th>
                      <th className="p-3 text-right">Lượt xem</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {stories.map((story) => (
                      <tr key={story.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-3 font-semibold text-stone-900 flex items-center gap-2">
                          <img
                            src={story.cover}
                            alt=""
                            className="w-8 h-10 object-cover rounded-md"
                          />
                          <span>{story.title}</span>
                        </td>
                        <td className="p-3 text-stone-600">{story.author}</td>
                        <td className="p-3">
                          <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded text-[10px]">
                            {story.genres[0]}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-emerald-700">
                          {story.totalChapters} c
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              story.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {story.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium text-stone-600">
                          {story.views.toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteStory(story)}
                            className="text-red-600 hover:underline font-semibold cursor-pointer"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: THÔNG BÁO ĐẨY */}
          {activeTab === 'push' && (
            <div className="max-w-xl mx-auto bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-600" />
                  Gửi Thông Báo Đẩy Tức Thì
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  Thông báo sẽ xuất hiện trên thanh chuông của người dùng và thiết bị di động.
                </p>
              </div>

              {pushSentSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Đã phát thông báo đẩy thành công đến toàn bộ độc giả!</span>
                </div>
              )}

              {pushError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">{pushError}</div>
              )}

              <form onSubmit={handleSendPush} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Tiêu đề thông báo:
                  </label>
                  <input
                    type="text"
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    placeholder="Ví dụ: Chương mới: Phàm Nhân Tu Tiên vừa ra mắt!"
                    className="w-full p-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Nội dung thông báo:
                  </label>
                  <textarea
                    value={pushMessage}
                    onChange={(e) => setPushMessage(e.target.value)}
                    placeholder="Mô tả nội dung chương hoặc sự kiện mới..."
                    rows={3}
                    className="w-full p-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pushSending}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  {pushSending ? 'Đang gửi...' : 'Phát Thông Báo Ngay'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: ĐỒNG BỘ & SAO LƯU */}
          {activeTab === 'sync' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Export Token */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                <h4 className="font-extrabold text-sm sm:text-base text-stone-900 mb-2 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600" />
                  Xuất Token Đồng Bộ Đa Thiết Bị
                </h4>
                <p className="text-xs text-stone-500 mb-3">
                  Tạo mã sao lưu tức thì chứa tủ truyện, lịch sử đọc và ghi chú cá nhân để nhập sang máy khác.
                </p>

                <button
                  onClick={handleGenerateSyncToken}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Tạo Mã Token Đồng Bộ
                </button>

                {syncToken && (
                  <div className="mt-3">
                    <textarea
                      readOnly
                      value={syncToken}
                      rows={3}
                      className="w-full p-2 text-[11px] font-mono bg-stone-50 border border-stone-200 rounded-xl select-all"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">
                      Sao chép đoạn mã trên và dán vào máy thứ hai để đồng bộ.
                    </p>
                  </div>
                )}
              </div>

              {/* Import Token */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                <h4 className="font-extrabold text-sm sm:text-base text-stone-900 mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-teal-600" />
                  Nhập Mã Đồng Bộ Từ Thiết Bị Khác
                </h4>

                <textarea
                  value={importTokenInput}
                  onChange={(e) => setImportTokenInput(e.target.value)}
                  placeholder="Dán mã Token đồng bộ vào đây..."
                  rows={3}
                  className="w-full p-2.5 text-xs font-mono bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />

                {importStatus && (
                  <div className="mt-2 text-xs font-semibold text-emerald-700">
                    {importStatus}
                  </div>
                )}

                <button
                  onClick={handleImportToken}
                  className="mt-3 px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Xác Nhận Nhập Dữ Liệu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Edit or Create Ad Banner */}
      {showAdModal && editingAd && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-base">Cấu Hình Banner Quảng Cáo / Shopee</h3>
              <button
                onClick={() => setShowAdModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">
                Tiêu đề quảng cáo:
              </label>
              <input
                type="text"
                value={editingAd.title}
                onChange={(e) => setEditingAd({ ...editingAd, title: e.target.value })}
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">
                Vị trí hiển thị:
              </label>
              <select
                value={editingAd.placement}
                onChange={(e) =>
                  setEditingAd({ ...editingAd, placement: e.target.value as AdPlacement })
                }
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              >
                <option value="HEADER_BANNER">Đầu Trang (Header Banner)</option>
                <option value="SIDEBAR">Cột Phải (Sidebar)</option>
                <option value="IN_READER">Giữa Trang Đọc Truyện (In-Reader)</option>
                <option value="FLOAT_BOTTOM">Góc Dưới Nổi (Float Bottom)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">
                Ảnh minh họa URL:
              </label>
              <input
                type="text"
                value={editingAd.imageUrl}
                onChange={(e) => setEditingAd({ ...editingAd, imageUrl: e.target.value })}
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">
                Đường dẫn Affiliate Shopee (Link Aff):
              </label>
              <input
                type="text"
                value={editingAd.targetUrl}
                onChange={(e) => setEditingAd({ ...editingAd, targetUrl: e.target.value })}
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">
                Tag nhãn (ví dụ: Shopee Mall, Flash Sale -40%):
              </label>
              <input
                type="text"
                value={editingAd.tag || ''}
                onChange={(e) => setEditingAd({ ...editingAd, tag: e.target.value })}
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isShopee"
                checked={editingAd.isShopee}
                onChange={(e) => setEditingAd({ ...editingAd, isShopee: e.target.checked })}
                className="accent-orange-600"
              />
              <label htmlFor="isShopee" className="text-xs font-semibold text-stone-700">
                Đây là link Affiliate Shopee (hiện logo & màu cam Shopee)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSaveAd(editingAd)}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Story */}
      {showAddStoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddStory}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-base">Thêm Truyện Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddStoryModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">Tên truyện:</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ví dụ: Già Thiên"
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">Tác giả:</label>
              <input
                type="text"
                required
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="Thần Đông"
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">Ảnh bìa URL:</label>
              <input
                type="text"
                value={newCover}
                onChange={(e) => setNewCover(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">Giới thiệu ngắn:</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={3}
                placeholder="Tóm tắt cốt truyện..."
                className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddStoryModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
              >
                Thêm Truyện
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
