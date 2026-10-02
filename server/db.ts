import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { Story, Chapter, AdSlot, PushNotification, StoryComment } from '../src/types';
import { INITIAL_STORIES, INITIAL_CHAPTERS, INITIAL_ADS } from '../src/data/mockStories';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'truyen.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
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

// ---- Crawl config ----
export interface CrawlConfig {
  tocUrl: string;
  linkSelector: string;
  contentSelector: string;
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
