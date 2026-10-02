import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Eye, MessageSquare, Trash2, Users } from 'lucide-react';
import { api, AdminStats } from '../services/api';
import { formatTime } from '../services/format';
import type { AdminTab } from './AdminPortal';

const fmt = (n: number) => n.toLocaleString('vi-VN');

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({ icon, label, value, sub }) => (
  <div className="bg-white rounded-2xl border border-stone-200 p-4">
    <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
      {icon}
      <span>{label}</span>
    </div>
    <div className="mt-1 text-2xl font-extrabold text-stone-900">{value}</div>
    {sub && <div className="text-[11px] text-stone-500 mt-0.5">{sub}</div>}
  </div>
);

const Card: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="bg-white rounded-2xl border border-stone-200 p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-extrabold text-sm">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

export const DashboardTab: React.FC<{ onGoTo: (tab: AdminTab) => void; dataVersion: number }> = ({ onGoTo, dataVersion }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    api.admin
      .stats()
      .then((s) => {
        setStats(s);
        setError('');
      })
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    void load();
  }, [dataVersion]);

  if (error) return <p className="text-sm text-red-600">Không tải được số liệu: {error}</p>;
  if (!stats) return <p className="text-sm text-stone-500">Đang tải số liệu...</p>;

  const maxDay = Math.max(1, ...stats.viewsByDay.map((d) => d.views));
  const lastRun = stats.crawlRuns[0];
  const failedRecently = stats.crawlRuns.some((r) => !r.ok);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<BookOpen className="w-4 h-4" />} label="Truyện / Chương" value={`${fmt(stats.totals.stories)} / ${fmt(stats.totals.chapters)}`} />
        <Stat icon={<Eye className="w-4 h-4" />} label="Lượt xem hôm nay" value={fmt(stats.viewsToday)} sub={`${fmt(stats.views7d)} trong 7 ngày`} />
        <Stat icon={<MessageSquare className="w-4 h-4" />} label="Bình luận hôm nay" value={fmt(stats.commentsToday)} sub={`Tổng ${fmt(stats.totals.comments)}`} />
        <Stat icon={<Users className="w-4 h-4" />} label="Độc giả đã đăng ký" value={fmt(stats.totals.users)} sub={`+${fmt(stats.newUsersToday)} hôm nay`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Lượt xem 7 ngày qua">
          <div className="flex items-end gap-2 h-28">
            {stats.viewsByDay.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[10px] text-stone-500">{d.views}</span>
                <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${Math.max(3, (d.views / maxDay) * 80)}%` }} />
                <span className="text-[10px] text-stone-400">{d.day.slice(8)}/{d.day.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Top 5 truyện xem nhiều">
          {stats.topStories.length === 0 ? (
            <p className="text-xs text-stone-500">Chưa có truyện.</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {stats.topStories.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="truncate"><b className="text-stone-400 mr-2">{i + 1}</b>{s.title}</span>
                  <span className="text-xs text-stone-500 shrink-0">{fmt(s.views)} lượt · {s.totalChapters} chương</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card
          title="Trạng thái crawler"
          action={
            <button onClick={() => onGoTo('crawler')} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">
              Mở crawler
            </button>
          }
        >
          <p className="text-xs text-stone-500 mb-2">
            {stats.crawlConfigured} truyện đã cấu hình nguồn ·{' '}
            {stats.crawlIntervalMin > 0 ? `tự quét mỗi ${stats.crawlIntervalMin} phút` : 'chưa bật tự quét (CRAWL_INTERVAL_MIN)'}
          </p>
          {!lastRun ? (
            <p className="text-xs text-stone-500">Chưa có lần chạy nào.</p>
          ) : (
            <>
              {failedRecently && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Có lần chạy lỗi gần đây
                </p>
              )}
              <ul className="space-y-1.5">
                {stats.crawlRuns.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                    <span className="min-w-0">
                      <b>{r.storyTitle}</b> <span className="text-stone-400">· {formatTime(new Date(r.at).toISOString())}</span>
                      <span className={`block truncate ${r.ok ? 'text-stone-500' : 'text-red-600'}`}>{r.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card
          title={`Quảng cáo đang bật (${stats.activeAds.length})`}
          action={
            <button onClick={() => onGoTo('ads_shopee')} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">
              Quản lý
            </button>
          }
        >
          {stats.activeAds.length === 0 ? (
            <p className="text-xs text-stone-500">Không có quảng cáo nào đang chạy.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {stats.activeAds.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{a.title} <span className="text-stone-400">· {a.placement}{a.isShopee ? ' · Shopee' : ''}</span></span>
                  <span className="text-stone-500 shrink-0">{fmt(a.clicks)} click</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Bình luận mới nhất">
        {stats.recentComments.length === 0 ? (
          <p className="text-xs text-stone-500">Chưa có bình luận.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {stats.recentComments.map((c) => (
              <li key={c.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0 text-xs">
                  <div className="text-stone-500">
                    <b className="text-stone-800">{c.authorName}</b> trong <i>{c.storyTitle}</i> · {formatTime(c.createdAt)}
                  </div>
                  <p className="text-stone-800 break-words">{c.content}</p>
                </div>
                <button
                  title="Xóa bình luận"
                  onClick={async () => {
                    if (!confirm('Xóa bình luận này?')) return;
                    await api.admin.deleteComment(c.id).catch((e) => alert((e as Error).message));
                    void load();
                  }}
                  className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
