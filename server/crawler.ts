import * as cheerio from 'cheerio';
import type { Chapter } from '../src/types';
import { CrawlConfig, chapterCount, getStory, upsertChapter, addNotification, saveCrawlConfig, recordCrawlRun } from './db';

const UA = 'Mozilla/5.0 (compatible; TruyenFullBot/1.0)';

async function fetchHtml(url: string): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Chỉ hỗ trợ http/https');
  const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải ${url}`);
  return res.text();
}

function extractParagraphs($: cheerio.CheerioAPI, selector: string): string[] {
  const el = $(selector).first();
  if (!el.length) return [];
  el.find('script, style, iframe, ins, .ads, [class*="ads"], [id*="ads"]').remove();
  el.find('br').replaceWith('\n');
  const blocks = el.find('p').length ? el.find('p').map((_, p) => $(p).text()).get() : [el.text()];
  return blocks
    .flatMap((b) => b.split(/\n+/))
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export interface CrawlResult {
  added: number;
  logs: string[];
}

export const MAX_CRAWL_LIMIT = 1000;
const CONCURRENCY = 4; // chapters fetched in parallel per batch (saved in order)
const BATCH_DELAY_MS = 400; // be polite to the source between batches

interface CrawlOpts {
  onLog?: (line: string) => void;
  shouldStop?: () => boolean;
  onProgress?: (added: number, total: number) => void;
}

/** Crawl new chapters (by TOC order; chapter N = Nth link) for a story. Only chapters beyond the current count are fetched. */
export async function crawlStory(storyId: string, cfg: CrawlConfig, limit = 20, opts: CrawlOpts = {}): Promise<CrawlResult> {
  const title = getStory(storyId)?.title ?? storyId;
  try {
    const result = await doCrawl(storyId, cfg, Math.min(MAX_CRAWL_LIMIT, Math.max(1, limit)), opts);
    // A run that stopped on a chapter error is reported as failed even if earlier chapters were saved.
    const failure = result.logs.find((l) => l.startsWith('✗'));
    recordCrawlRun(storyId, title, !failure, result.added, failure ?? `Thêm ${result.added} chương`);
    return result;
  } catch (e: any) {
    recordCrawlRun(storyId, title, false, 0, e?.message || 'Lỗi không xác định');
    throw e;
  }
}

// ---- Background jobs: a big crawl takes minutes, so the admin UI starts one and polls its progress. ----
export interface CrawlJob {
  storyId: string;
  running: boolean;
  stopRequested: boolean;
  added: number;
  total: number;
  logs: string[];
  error?: string;
  startedAt: number;
}
const jobs = new Map<string, CrawlJob>();
const MAX_JOB_LOGS = 2000;

export const getCrawlJob = (storyId: string): CrawlJob | undefined => jobs.get(storyId);

export const stopCrawlJob = (storyId: string): boolean => {
  const job = jobs.get(storyId);
  if (!job?.running) return false;
  job.stopRequested = true;
  return true;
};

/** Starts a crawl in the background. Throws if one is already running for the story. */
export function startCrawlJob(storyId: string, cfg: CrawlConfig, limit: number): CrawlJob {
  if (jobs.get(storyId)?.running) throw new Error('Truyện này đang được cào, hãy đợi hoặc bấm Dừng.');
  const job: CrawlJob = { storyId, running: true, stopRequested: false, added: 0, total: 0, logs: [], startedAt: Date.now() };
  jobs.set(storyId, job);
  const push = (line: string) => {
    job.logs.push(line);
    if (job.logs.length > MAX_JOB_LOGS) job.logs.splice(0, job.logs.length - MAX_JOB_LOGS);
  };
  crawlStory(storyId, cfg, limit, {
    onLog: push,
    shouldStop: () => job.stopRequested,
    onProgress: (added, total) => {
      job.added = added;
      job.total = total;
    },
  })
    .then((r) => {
      job.added = r.added;
    })
    .catch((e: any) => {
      job.error = e?.message || 'Crawl lỗi';
    })
    .finally(() => {
      job.running = false;
    });
  return job;
}

async function doCrawl(storyId: string, cfg: CrawlConfig, limit: number, opts: CrawlOpts): Promise<CrawlResult> {
  const logs: string[] = [];
  const log = (m: string) => {
    logs.push(m);
    opts.onLog?.(m);
  };
  const story = getStory(storyId);
  if (!story) throw new Error('Không tìm thấy truyện');

  log(`Tải mục lục: ${cfg.tocUrl}`);
  const toc = cheerio.load(await fetchHtml(cfg.tocUrl));
  const seen = new Set<string>();
  const links: { url: string; text: string }[] = [];
  toc(cfg.linkSelector).each((_, a) => {
    const href = toc(a).attr('href');
    if (!href) return;
    let abs: string;
    try {
      abs = new URL(href, cfg.tocUrl).toString();
    } catch {
      return;
    }
    if (seen.has(abs)) return;
    seen.add(abs);
    links.push({ url: abs, text: toc(a).text().trim() });
  });
  log(`Tìm thấy ${links.length} chương trong mục lục.`);
  if (links.length === 0) throw new Error('Không tìm thấy link chương: kiểm tra lại selector danh sách chương.');

  saveCrawlConfig(storyId, cfg);

  const have = chapterCount(storyId);
  const todo = links.slice(have, have + limit);
  if (todo.length === 0) {
    log('Không có chương mới.');
    return { added: 0, logs };
  }

  opts.onProgress?.(0, todo.length);
  log(`Sẽ tải ${todo.length} chương (từ chương ${have + 1}), ${CONCURRENCY} chương song song.`);
  const fetchChapter = async (url: string, fallbackTitle: string) => {
    const $ = cheerio.load(await fetchHtml(url));
    const content = extractParagraphs($, cfg.contentSelector);
    if (content.length === 0) throw new Error('nội dung rỗng (sai selector nội dung?)');
    const title = (cfg.titleSelector && $(cfg.titleSelector).first().text().trim()) || fallbackTitle;
    return { content, title };
  };

  let added = 0;
  let halted = false;
  for (let b = 0; b < todo.length && !halted; b += CONCURRENCY) {
    if (opts.shouldStop?.()) {
      log('Đã dừng theo yêu cầu.');
      break;
    }
    const batch = todo.slice(b, b + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((l, k) => fetchChapter(l.url, l.text || `Chương ${have + b + k + 1}`)),
    );
    // Save in TOC order; stop at the first failure so chapter numbers never skip.
    for (let k = 0; k < settled.length; k++) {
      const number = have + b + k + 1;
      const r = settled[k];
      if (r.status === 'rejected') {
        log(`✗ Chương ${number} lỗi: ${r.reason?.message || r.reason}. Dừng để tránh bỏ sót thứ tự.`);
        halted = true;
        break;
      }
      const { content, title } = r.value;
      const chapter: Chapter = {
        id: `${storyId}-${number}`,
        storyId,
        chapterNumber: number,
        title,
        content,
        wordCount: content.join(' ').split(/\s+/).length,
        publishedAt: new Date().toISOString().split('T')[0],
        views: 0,
      };
      upsertChapter(chapter);
      added++;
      opts.onProgress?.(added, todo.length);
      log(`✓ Chương ${number}: ${title}`);
    }
    if (!halted && b + CONCURRENCY < todo.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  if (added > 0) {
    addNotification({
      id: `crawl-${Date.now()}`,
      storyId,
      title: `Chương mới: ${story.title}`,
      message: `Vừa cập nhật ${added} chương mới!`,
      timestamp: new Date().toISOString(),
      isRead: false,
      linkChapterNumber: have + 1,
    });
  }
  return { added, logs };
}
