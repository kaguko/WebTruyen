import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { Story, Chapter, AdSlot, PushNotification, StoryComment } from '../src/types';
import { GENRES } from '../src/routes';
import { INITIAL_STORIES, INITIAL_CHAPTERS, INITIAL_ADS } from '../src/data/mockStories';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'truyen.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, position INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS chapters (
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (story_id, number)
  );
  CREATE TABLE IF NOT EXISTS ads (id TEXT PRIMARY KEY, position INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, kind)
  );
  CREATE TABLE IF NOT EXISTS daily_views (day TEXT PRIMARY KEY, views INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS crawl_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    story_title TEXT NOT NULL,
    at INTEGER NOT NULL,
    ok INTEGER NOT NULL,
    added INTEGER NOT NULL,
    message TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS crawl_config (story_id TEXT PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE, data TEXT NOT NULL);
`);

const parse = <T>(rows: Array<{ data: string }>): T[] => rows.map((r) => JSON.parse(r.data) as T);

// ---- Stories ----
export const listStories = (): Story[] =>
  parse<Story>(db.prepare('SELECT data FROM stories ORDER BY position DESC').all() as any);
export const getStory = (id: string): Story | undefined => {
  const row = db.prepare('SELECT data FROM stories WHERE id = ?').get(id) as any;
  return row ? JSON.parse(row.data) : undefined;
};
export const upsertStory = (s: Story) => {
  const existing = db.prepare('SELECT position FROM stories WHERE id = ?').get(s.id) as any;
  const position = existing
    ? existing.position
    : ((db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM stories').get() as any).m + 1);
  // ON CONFLICT (not REPLACE): REPLACE deletes the row and would cascade-delete its chapters/comments.
  db.prepare(
    'INSERT INTO stories (id, position, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
  ).run(
    s.id,
    position,
    JSON.stringify(s),
  );
};
export const deleteStory = (id: string) => {
  db.prepare('DELETE FROM stories WHERE id = ?').run(id);
};

// ---- Chapters ----
export const listChapters = (storyId: string): Chapter[] =>
  parse<Chapter>(
    db.prepare('SELECT data FROM chapters WHERE story_id = ? ORDER BY number').all(storyId) as any,
  );
export const getChapter = (storyId: string, number: number): Chapter | undefined => {
  const row = db.prepare('SELECT data FROM chapters WHERE story_id = ? AND number = ?').get(storyId, number) as any;
  return row ? JSON.parse(row.data) : undefined;
};
/** Paginated chapter list without the (large) content field; optional search by title or chapter number. */
export const listChapterMetas = (storyId: string, offset: number, limit: number, q = '') => {
  const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  const where = q ? "AND (json_extract(data, '$.title') LIKE ? ESCAPE '\\' OR CAST(number AS TEXT) = ?)" : '';
  const args: (string | number)[] = q ? [storyId, like, q] : [storyId];
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM chapters WHERE story_id = ? ${where}`).get(...args) as any).n;
  const rows = db
    .prepare(
      `SELECT json_remove(data, '$.content') AS data FROM chapters WHERE story_id = ? ${where}
       ORDER BY number LIMIT ? OFFSET ?`,
    )
    .all(...args, limit, offset) as any[];
  return { items: parse<Omit<Chapter, 'content'>>(rows), total };
};
export const upsertChapter = (c: Chapter) => {
  db.prepare('INSERT OR REPLACE INTO chapters (story_id, number, data) VALUES (?, ?, ?)').run(
    c.storyId,
    c.chapterNumber,
    JSON.stringify(c),
  );
  const count = (db.prepare('SELECT COUNT(*) AS n FROM chapters WHERE story_id = ?').get(c.storyId) as any).n;
  const story = getStory(c.storyId);
  if (story) {
    upsertStory({ ...story, totalChapters: count, lastUpdated: new Date().toISOString() });
  }
};
export const deleteChapter = (storyId: string, number: number) => {
  db.prepare('DELETE FROM chapters WHERE story_id = ? AND number = ?').run(storyId, number);
  const story = getStory(storyId);
  if (story) {
    const count = (db.prepare('SELECT COUNT(*) AS n FROM chapters WHERE story_id = ?').get(storyId) as any).n;
    upsertStory({ ...story, totalChapters: count });
  }
};
export const chapterCount = (storyId: string): number =>
  (db.prepare('SELECT COUNT(*) AS n FROM chapters WHERE story_id = ?').get(storyId) as any).n;
export const bumpChapterViews = (storyId: string, number: number) => {
  db.prepare(
    `UPDATE chapters SET data = json_set(data, '$.views', COALESCE(json_extract(data, '$.views'), 0) + 1)
     WHERE story_id = ? AND number = ?`,
  ).run(storyId, number);
  db.prepare(
    `UPDATE stories SET data = json_set(data, '$.views', COALESCE(json_extract(data, '$.views'), 0) + 1) WHERE id = ?`,
  ).run(storyId);
  db.prepare(
    `INSERT INTO daily_views (day, views) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET views = views + 1`,
  ).run(dayKey(Date.now()));
};

/** Day bucket in the server's local time zone (YYYY-MM-DD). */
export const dayKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---- Ads ----
export const listAds = (): AdSlot[] =>
  parse<AdSlot>(db.prepare('SELECT data FROM ads ORDER BY position DESC').all() as any);
export const upsertAd = (a: AdSlot) => {
  const existing = db.prepare('SELECT position FROM ads WHERE id = ?').get(a.id) as any;
  const position = existing
    ? existing.position
    : ((db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM ads').get() as any).m + 1);
  db.prepare('INSERT OR REPLACE INTO ads (id, position, data) VALUES (?, ?, ?)').run(a.id, position, JSON.stringify(a));
};
export const deleteAd = (id: string) => {
  db.prepare('DELETE FROM ads WHERE id = ?').run(id);
};
export const bumpAdClick = (id: string) => {
  db.prepare(
    `UPDATE ads SET data = json_set(data, '$.clicks', COALESCE(json_extract(data, '$.clicks'), 0) + 1) WHERE id = ?`,
  ).run(id);
};
export const bumpAdView = (id: string) => {
  db.prepare(
    `UPDATE ads SET data = json_set(data, '$.impressions', COALESCE(json_extract(data, '$.impressions'), 0) + 1) WHERE id = ?`,
  ).run(id);
};

// ---- Notifications ----
export const listNotifications = (): PushNotification[] =>
  parse<PushNotification>(
    db.prepare('SELECT data FROM notifications ORDER BY created_at DESC LIMIT 30').all() as any,
  );
export const addNotification = (n: PushNotification) => {
  db.prepare('INSERT OR REPLACE INTO notifications (id, created_at, data) VALUES (?, ?, ?)').run(
    n.id,
    Date.now(),
    JSON.stringify(n),
  );
};

// ---- Comments ----
export const listComments = (storyId: string): StoryComment[] =>
  parse<StoryComment>(
    db.prepare('SELECT data FROM comments WHERE story_id = ? ORDER BY created_at DESC LIMIT 100').all(storyId) as any,
  );
export const addComment = (c: StoryComment) => {
  db.prepare('INSERT INTO comments (id, story_id, created_at, data) VALUES (?, ?, ?, ?)').run(
    c.id,
    c.storyId,
    Date.now(),
    JSON.stringify(c),
  );
};

// ---- Reader accounts ----
export interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
}
export const findUserByEmail = (email: string) =>
  db.prepare('SELECT * FROM users WHERE email = ?').get(email) as unknown as UserRow | undefined;
export const findUserById = (id: number) =>
  db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow | undefined;
export const createUser = (email: string, name: string, passwordHash: string): number =>
  Number(
    db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
      email,
      name,
      passwordHash,
      Date.now(),
    ).lastInsertRowid,
  );
export const deleteUser = (id: number) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
};
export const USER_DATA_KINDS = ['history', 'bookmarks', 'notes', 'settings'] as const;
export const getUserData = (userId: number): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const r of db.prepare('SELECT kind, data FROM user_data WHERE user_id = ?').all(userId) as any[]) {
    out[r.kind] = JSON.parse(r.data);
  }
  return out;
};
export const setUserData = (userId: number, kind: string, value: unknown) => {
  db.prepare(
    `INSERT INTO user_data (user_id, kind, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, kind) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(userId, kind, JSON.stringify(value), Date.now());
};

// ---- Moderation ----
export const deleteComment = (id: string) => {
  db.prepare('DELETE FROM comments WHERE id = ?').run(id);
};

// ---- Crawl runs ----
export const recordCrawlRun = (storyId: string, storyTitle: string, ok: boolean, added: number, message: string) => {
  db.prepare('INSERT INTO crawl_runs (story_id, story_title, at, ok, added, message) VALUES (?, ?, ?, ?, ?, ?)').run(
    storyId,
    storyTitle,
    Date.now(),
    ok ? 1 : 0,
    added,
    message.slice(0, 500),
  );
  db.prepare('DELETE FROM crawl_runs WHERE id NOT IN (SELECT id FROM crawl_runs ORDER BY id DESC LIMIT 200)').run();
};

// ---- Dashboard stats ----
export const getStats = () => {
  const one = (sql: string, ...args: any[]) => (db.prepare(sql).get(...args) as any).n as number;
  const now = Date.now();
  const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  const days: { day: string; views: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = dayKey(now - i * 86_400_000);
    const row = db.prepare('SELECT views FROM daily_views WHERE day = ?').get(day) as any;
    days.push({ day, views: row?.views ?? 0 });
  }
  const stories = listStories();
  const runs = (db.prepare('SELECT * FROM crawl_runs ORDER BY id DESC LIMIT 5').all() as any[]).map((r) => ({
    storyId: r.story_id,
    storyTitle: r.story_title,
    at: r.at,
    ok: Boolean(r.ok),
    added: r.added,
    message: r.message,
  }));
  const recentComments = (
    db
      .prepare(
        `SELECT c.data, s.data AS story FROM comments c JOIN stories s ON s.id = c.story_id
         ORDER BY c.created_at DESC LIMIT 8`,
      )
      .all() as any[]
  ).map((r) => ({ ...JSON.parse(r.data), storyTitle: JSON.parse(r.story).title }));
  return {
    totals: {
      stories: stories.length,
      chapters: one('SELECT COUNT(*) AS n FROM chapters'),
      comments: one('SELECT COUNT(*) AS n FROM comments'),
      users: one('SELECT COUNT(*) AS n FROM users'),
    },
    viewsToday: days[days.length - 1].views,
    views7d: days.reduce((a, d) => a + d.views, 0),
    viewsByDay: days,
    commentsToday: one('SELECT COUNT(*) AS n FROM comments WHERE created_at >= ?', startOfToday),
    newUsersToday: one('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', startOfToday),
    topStories: [...stories].sort((a, b) => b.views - a.views).slice(0, 5).map((s) => ({
      id: s.id, title: s.title, views: s.views, totalChapters: s.totalChapters,
    })),
    crawlRuns: runs,
    crawlConfigured: one('SELECT COUNT(*) AS n FROM crawl_config'),
    crawlIntervalMin: Number(process.env.CRAWL_INTERVAL_MIN) || 0,
    activeAds: listAds().filter((a) => a.isEnabled).map((a) => ({
      id: a.id, title: a.title, placement: a.placement, isShopee: a.isShopee, clicks: a.clicks,
    })),
    recentComments,
  };
};

// ---- Genres (editable list; stories reference genres by name) ----
export const getGenres = (): string[] => {
  const row = db.prepare("SELECT value FROM kv WHERE key = 'genres'").get() as any;
  return row ? (JSON.parse(row.value) as string[]) : [...GENRES];
};
const setGenres = (list: string[]) => {
  db.prepare("INSERT INTO kv (key, value) VALUES ('genres', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    JSON.stringify(list),
  );
};
export const addGenre = (name: string) => setGenres([...getGenres(), name]);
/** Renames (or merges into an existing genre) everywhere: the list and every story. */
export const renameGenre = (from: string, to: string) => {
  const list = getGenres();
  setGenres([...new Set(list.map((g) => (g === from ? to : g)))]);
  for (const s of listStories()) {
    if (s.genres.includes(from)) upsertStory({ ...s, genres: [...new Set(s.genres.map((g) => (g === from ? to : g)))] });
  }
};
/** Removes a genre from the list and from stories; a story left with none gets the first remaining genre. */
export const deleteGenre = (name: string) => {
  const list = getGenres().filter((g) => g !== name);
  setGenres(list);
  for (const s of listStories()) {
    if (!s.genres.includes(name)) continue;
    const genres = s.genres.filter((g) => g !== name);
    upsertStory({ ...s, genres: genres.length ? genres : [list[0]] });
  }
};

// ---- Crawl config ----
export interface CrawlConfig {
  tocUrl: string;
  linkSelector?: string; // empty = auto-detect
  contentSelector?: string; // empty = auto-detect
  titleSelector?: string;
}
export const getCrawlConfig = (storyId: string): CrawlConfig | undefined => {
  const row = db.prepare('SELECT data FROM crawl_config WHERE story_id = ?').get(storyId) as any;
  return row ? JSON.parse(row.data) : undefined;
};
export const saveCrawlConfig = (storyId: string, cfg: CrawlConfig) => {
  db.prepare('INSERT OR REPLACE INTO crawl_config (story_id, data) VALUES (?, ?)').run(storyId, JSON.stringify(cfg));
};
export const listCrawlConfigs = (): Array<{ storyId: string; cfg: CrawlConfig }> =>
  (db.prepare('SELECT story_id, data FROM crawl_config').all() as any[]).map((r) => ({
    storyId: r.story_id,
    cfg: JSON.parse(r.data),
  }));

// ---- Seed demo content on first run (disable with SEED_DEMO=false) ----
if (process.env.SEED_DEMO !== 'false' && listStories().length === 0 && listAds().length === 0) {
  [...INITIAL_STORIES].reverse().forEach(upsertStory);
  Object.values(INITIAL_CHAPTERS).flat().forEach((c) => upsertChapter(c));
  [...INITIAL_ADS].reverse().forEach(upsertAd);
}
