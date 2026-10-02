import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import * as db from './db';
import {
  checkPassword, issueSession, clearSession, requireAdmin, isAdmin,
  issueUserSession, clearUserSession, getUserId, requireUser,
} from './auth';
import { hashPassword, verifyPassword } from './password';
import { crawlStory, startCrawlJob, getCrawlJob, stopCrawlJob, MAX_CRAWL_LIMIT } from './crawler';
import { renderPage, robots, sitemap } from './seo';
import type { Story, Chapter, AdSlot } from '../src/types';
import { slugify, parseRoute, GENRES, genrePath, storyPath, chapterPath } from '../src/routes';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(express.json({ limit: '2mb' }));
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const str = (v: unknown, max: number, fallback = ''): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : fallback;
const safeUrl = (v: unknown): string => {
  const s = str(v, 2000);
  return /^https?:\/\//i.test(s) ? s : '';
};
const uid = (p: string) => `${p}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const uniqueSlug = (title: string, selfId?: string): string => {
  const base = slugify(title) || 'truyen';
  const taken = new Set(db.listStories().filter((s) => s.id !== selfId).map((s) => s.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
};

// ---------- Public API ----------
const api = express.Router();

api.get('/health', (_req, res) => res.json({ ok: true }));

api.get('/stories', (_req, res) => res.json(db.listStories()));
const int = (v: unknown, def: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(Number(v)) ? Math.floor(Number(v)) : def));
// Chapter list (no content), paginated: ?offset=0&limit=50&q=search
api.get('/stories/:id/chapters', (req, res) => {
  if (!db.getStory(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json(
    db.listChapterMetas(req.params.id, int(req.query.offset, 0, 0, 1e9), int(req.query.limit, 50, 1, 200), str(req.query.q, 100)),
  );
});
// Full content of one chapter
api.get('/stories/:id/chapters/:n', (req, res) => {
  const ch = db.getChapter(req.params.id, Number(req.params.n));
  if (!ch) return res.status(404).json({ error: 'Not found' });
  res.json(ch);
});
// Whole story with content, used for "download for offline reading"
api.get('/stories/:id/download', (req, res) => {
  if (!db.getStory(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json(db.listChapters(req.params.id));
});
api.post('/stories/:id/chapters/:n/view', (req, res) => {
  db.bumpChapterViews(req.params.id, Number(req.params.n));
  res.json({ ok: true });
});
api.get('/ads', (_req, res) => res.json(db.listAds()));
api.post('/ads/:id/click', (req, res) => {
  db.bumpAdClick(req.params.id);
  res.json({ ok: true });
});
api.get('/notifications', (_req, res) => res.json(db.listNotifications()));
api.get('/stories/:id/comments', (req, res) => res.json(db.listComments(req.params.id)));

const commentLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
api.post('/stories/:id/comments', commentLimiter, (req, res) => {
  if (!db.getStory(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const content = str(req.body?.content, 1000);
  if (!content) return res.status(400).json({ error: 'Nội dung trống' });
  const rating = Math.min(5, Math.max(1, Math.round(Number(req.body?.rating) || 5)));
  const comment = {
    id: uid('comment'),
    storyId: req.params.id,
    authorName: str(req.body?.authorName, 40) || 'Độc giả vô danh',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    content,
    rating,
    createdAt: new Date().toISOString(),
    likes: 0,
  };
  db.addComment(comment);
  res.status(201).json(comment);
});

// ---------- Reader accounts ----------
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const publicUser = (u: { id: number; email: string; name: string }) => ({ id: u.id, email: u.email, name: u.name });
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

api.post('/auth/register', authLimiter, async (req, res) => {
  const email = str(req.body?.email, 254).toLowerCase();
  const name = str(req.body?.name, 40) || email.split('@')[0];
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Mật khẩu cần từ 8 ký tự' });
  if (db.findUserByEmail(email)) return res.status(409).json({ error: 'Email này đã được đăng ký' });
  const id = db.createUser(email, name, await hashPassword(password));
  issueUserSession(res, id);
  res.status(201).json({ user: publicUser({ id, email, name }) });
});
api.post('/auth/login', authLimiter, async (req, res) => {
  const email = str(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
  const user = db.findUserByEmail(email);
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, user?.password_hash);
  if (!user || !ok) return res.status(401).json({ error: 'Sai email hoặc mật khẩu' });
  issueUserSession(res, user.id);
  res.json({ user: publicUser(user) });
});
api.post('/auth/logout', (_req, res) => {
  clearUserSession(res);
  res.json({ ok: true });
});
api.get('/auth/me', (req, res) => {
  const id = getUserId(req);
  const user = id ? db.findUserById(id) : undefined;
  res.json({ user: user ? publicUser(user) : null });
});
api.delete('/auth/account', requireUser, async (req, res) => {
  const user = db.findUserById((req as any).userId);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!user || !(await verifyPassword(password, user.password_hash)))
    return res.status(401).json({ error: 'Sai mật khẩu' });
  db.deleteUser(user.id);
  clearUserSession(res);
  res.json({ ok: true });
});

// Per-reader synced data: history, bookmarks, notes, settings (whole-document, last write wins)
api.get('/me/data', requireUser, (req, res) => res.json(db.getUserData((req as any).userId)));
api.put('/me/data/:kind', requireUser, (req, res) => {
  const kind = req.params.kind;
  if (!(db.USER_DATA_KINDS as readonly string[]).includes(kind)) return res.status(404).json({ error: 'Not found' });
  const value = req.body?.data;
  const isList = kind !== 'settings';
  if (isList ? !Array.isArray(value) : typeof value !== 'object' || value === null || Array.isArray(value))
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  if (JSON.stringify(value).length > 1_000_000) return res.status(413).json({ error: 'Dữ liệu quá lớn' });
  db.setUserData((req as any).userId, kind, value);
  res.json({ ok: true });
});

// ---------- Admin API ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
api.post('/admin/login', loginLimiter, (req, res) => {
  if (!checkPassword(str(req.body?.password, 200))) return res.status(401).json({ error: 'Sai mật khẩu' });
  issueSession(res);
  res.json({ ok: true });
});
api.post('/admin/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});
api.get('/admin/me', (req, res) => res.json({ admin: isAdmin(req) }));

const admin = express.Router();
admin.use(requireAdmin);

admin.get('/stats', (_req, res) => res.json(db.getStats()));
admin.delete('/comments/:id', (req, res) => {
  db.deleteComment(req.params.id);
  res.json({ ok: true });
});

admin.post('/stories', (req, res) => {
  const title = str(req.body?.title, 200);
  if (!title) return res.status(400).json({ error: 'Thiếu tên truyện' });
  const story: Story = {
    id: uid('story'),
    title,
    slug: uniqueSlug(title),
    author: str(req.body?.author, 100) || 'Vô Danh',
    cover:
      safeUrl(req.body?.cover) ||
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
    description: str(req.body?.description, 5000) || 'Nội dung truyện đang cập nhật...',
    genres: Array.isArray(req.body?.genres) && req.body.genres.length ? req.body.genres.slice(0, 5) : ['Tiên Hiệp'],
    status: req.body?.status === 'COMPLETED' ? 'COMPLETED' : 'ONGOING',
    rating: { score: 0, count: 0 },
    views: 0,
    totalChapters: 0,
    lastUpdated: new Date().toISOString(),
    isHot: false,
  };
  db.upsertStory(story);
  res.status(201).json(story);
});
admin.put('/stories/:id', (req, res) => {
  const cur = db.getStory(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const next: Story = {
    ...cur,
    title: str(b.title, 200) || cur.title,
    author: str(b.author, 100) || cur.author,
    cover: safeUrl(b.cover) || cur.cover,
    description: b.description !== undefined ? str(b.description, 5000) : cur.description,
    status: b.status === 'COMPLETED' || b.status === 'ONGOING' ? b.status : cur.status,
    isHot: typeof b.isHot === 'boolean' ? b.isHot : cur.isHot,
    genres: Array.isArray(b.genres) && b.genres.length ? b.genres.slice(0, 5) : cur.genres,
  };
  db.upsertStory(next);
  res.json(next);
});
admin.delete('/stories/:id', (req, res) => {
  db.deleteStory(req.params.id);
  res.json({ ok: true });
});

admin.post('/stories/:id/chapters', (req, res) => {
  const story = db.getStory(req.params.id);
  if (!story) return res.status(404).json({ error: 'Not found' });
  const title = str(req.body?.title, 300);
  const paragraphs = str(req.body?.content, 500_000)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!title || paragraphs.length === 0) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });
  const number = Number(req.body?.chapterNumber) || db.chapterCount(story.id) + 1;
  const chapter: Chapter = {
    id: `${story.id}-${number}`,
    storyId: story.id,
    chapterNumber: number,
    title,
    content: paragraphs,
    wordCount: paragraphs.join(' ').split(/\s+/).length,
    publishedAt: new Date().toISOString().split('T')[0],
    views: 0,
  };
  db.upsertChapter(chapter);
  res.status(201).json(chapter);
});
admin.delete('/stories/:id/chapters/:n', (req, res) => {
  db.deleteChapter(req.params.id, Number(req.params.n));
  res.json({ ok: true });
});

const sanitizeAd = (b: any, id: string, prev?: AdSlot): AdSlot => ({
  id,
  title: str(b.title, 200) || prev?.title || 'Quảng cáo',
  placement: ['HEADER_BANNER', 'SIDEBAR', 'IN_READER', 'FLOAT_BOTTOM'].includes(b.placement) ? b.placement : prev?.placement || 'SIDEBAR',
  imageUrl: safeUrl(b.imageUrl) || prev?.imageUrl || '',
  targetUrl: safeUrl(b.targetUrl) || prev?.targetUrl || '',
  affiliateCode: str(b.affiliateCode, 100) || undefined,
  isShopee: Boolean(b.isShopee),
  tag: str(b.tag, 40) || undefined,
  description: str(b.description, 500) || undefined,
  isEnabled: b.isEnabled !== false,
  impressions: prev?.impressions ?? 0,
  clicks: prev?.clicks ?? 0,
});
admin.post('/ads', (req, res) => {
  const ad = sanitizeAd(req.body || {}, uid('ad'));
  db.upsertAd(ad);
  res.status(201).json(ad);
});
admin.put('/ads/:id', (req, res) => {
  const prev = db.listAds().find((a) => a.id === req.params.id);
  if (!prev) return res.status(404).json({ error: 'Not found' });
  const ad = sanitizeAd(req.body || {}, prev.id, prev);
  db.upsertAd(ad);
  res.json(ad);
});
admin.delete('/ads/:id', (req, res) => {
  db.deleteAd(req.params.id);
  res.json({ ok: true });
});

admin.post('/notifications', (req, res) => {
  const title = str(req.body?.title, 200);
  const message = str(req.body?.message, 1000);
  if (!title || !message) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });
  const n = { id: uid('push'), title, message, timestamp: new Date().toISOString(), isRead: false };
  db.addNotification(n);
  res.status(201).json(n);
});

admin.get('/stories/:id/crawl-config', (req, res) => res.json(db.getCrawlConfig(req.params.id) ?? null));
admin.post('/stories/:id/crawl', (req, res) => {
  const b = req.body || {};
  const tocUrl = safeUrl(b.tocUrl);
  if (!tocUrl) return res.status(400).json({ error: 'Link mục lục không hợp lệ' });
  if (!db.getStory(req.params.id)) return res.status(404).json({ error: 'Không tìm thấy truyện' });
  try {
    // Runs in the background; the admin UI polls /crawl-status for progress.
    startCrawlJob(
      req.params.id,
      {
        tocUrl,
        linkSelector: str(b.linkSelector, 300) || 'a',
        contentSelector: str(b.contentSelector, 300) || '#chapter-content',
        titleSelector: str(b.titleSelector, 300) || undefined,
      },
      Math.min(MAX_CRAWL_LIMIT, Math.max(1, Number(b.limit) || 100)),
    );
    res.status(202).json({ started: true });
  } catch (e: any) {
    res.status(409).json({ error: e?.message || 'Crawl lỗi' });
  }
});
admin.get('/stories/:id/crawl-status', (req, res) => {
  const job = getCrawlJob(req.params.id);
  if (!job) return res.json({ running: false, added: 0, total: 0, logs: [] });
  res.json({
    running: job.running,
    stopRequested: job.stopRequested,
    added: job.added,
    total: job.total,
    error: job.error,
    logs: job.logs,
  });
});
admin.post('/stories/:id/crawl-stop', (req, res) => res.json({ stopped: stopCrawlJob(req.params.id) }));

api.use('/admin', admin);
api.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use('/api', api);

// ---------- Static frontend (production) ----------
const dist = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(dist)) {
  app.get('/robots.txt', robots);
  app.get('/sitemap.xml', sitemap);
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (req, res) => renderPage(req, res, dist));
}

// ---------- Optional scheduled crawling ----------
const intervalMin = Number(process.env.CRAWL_INTERVAL_MIN) || 0;
if (intervalMin > 0) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    for (const { storyId, cfg } of db.listCrawlConfigs()) {
      if (getCrawlJob(storyId)?.running) continue; // an admin-started crawl is already on it
      try {
        const r = await crawlStory(storyId, cfg, 100);
        if (r.added) console.log(`[crawler] ${storyId}: +${r.added} chương`);
      } catch (e: any) {
        console.error(`[crawler] ${storyId}:`, e?.message || e);
      }
    }
    running = false;
  }, intervalMin * 60_000);
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err?.status || 500).json({ error: err?.status ? err.message : 'Server error' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Server listening on :${port}`));
