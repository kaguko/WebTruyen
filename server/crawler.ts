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

const CONTENT_CANDIDATES = [
  '#chapter-c', '.chapter-c', '#chapter-content', '.chapter-content', '#content', '.content',
  '.reading-content', '.entry-content', '#chapter_content', '.chapter-body', 'article',
];
const CHAPTER_HREF = /(chuong|chapter|chap|hoi|phan|tap|ch)[-_/. ]?\d+/i;
const CHAPTER_TEXT = /^\s*(chương|chuong|chapter|chap|hồi|tập|phần)\s*\d+/i;

/** Finds the chapter text container with no selector: known ids/classes first, else the block with the most prose. */
function autoContentElement($: cheerio.CheerioAPI) {
  for (const sel of CONTENT_CANDIDATES) {
    const el = $(sel).first();
    if (el.length && el.text().replace(/\s+/g, ' ').trim().length >= 200) return el;
  }
  let best: ReturnType<typeof $> | undefined;
  let bestScore = 0;
  $('div, article, section, main').each((_, node) => {
    const el = $(node);
    const own = el.children('p').map((_, p) => $(p).text().length).get().reduce((a, b) => a + b, 0);
    const brText = el.contents().filter((_, c) => c.type === 'text').text().replace(/\s+/g, ' ').trim().length;
    const linkText = el.find('a').text().length;
    const score = own + brText - linkText * 2;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  });
  return bestScore >= 200 && best ? best : undefined;
}

function extractParagraphs($: cheerio.CheerioAPI, selector?: string): string[] {
  const el = selector ? $(selector).first() : autoContentElement($);
  if (!el || !el.length) return [];
  el.find('script, style, iframe, ins, .ads, [class*="ads"], [id*="ads"]').remove();
  // Chapter text may be bare text split by <br>, <p> tags, or both (with unrelated <p> blocks mixed in): read it all in order.
  el.find('br').replaceWith('\n');
  el.find('p, div, li').each((_, n) => {
    $(n).append('\n');
  });
  return el
    .text()
    .split(/\n+/)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    // Drop short SEO keyword lines sites append to every chapter (e.g. "truyen full, truyenfull, ...").
    .filter((t) => !(t.length < 150 && /truyen\s?full/i.test(t)));
}

/** Chapter links of a TOC page. With no selector, picks the block whose links mostly look like chapters. */
function collectLinks(toc: cheerio.CheerioAPI, tocUrl: string, selector?: string): { url: string; text: string }[] {
  const tocNoHash = tocUrl.split('#')[0];
  const host = new URL(tocUrl).host;
  const resolve = (a: any): string | undefined => {
    const href = toc(a).attr('href');
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return undefined;
    try {
      const u = new URL(href, tocUrl);
      u.hash = '';
      return u.toString();
    } catch {
      return undefined;
    }
  };
  let anchors: any[];
  if (selector) {
    anchors = toc(selector).toArray();
  } else {
    const chapterLike = (a: any) => {
      const abs = resolve(a);
      if (!abs || abs === tocNoHash || new URL(abs).host !== host) return false;
      return CHAPTER_TEXT.test(toc(a).text()) || CHAPTER_HREF.test(new URL(abs).pathname);
    };
    let best: any;
    let bestCount = 0;
    let bestDepth = -1;
    toc('ul, ol, div, nav, section, table, tbody').each((_, node) => {
      const all = toc(node).find('a').toArray();
      if (all.length < 3) return;
      const count = all.filter(chapterLike).length;
      if (count < 3 || count / all.length < 0.7) return;
      const depth = toc(node).parents().length;
      if (count > bestCount || (count === bestCount && depth > bestDepth)) {
        best = node;
        bestCount = count;
        bestDepth = depth;
      }
    });
    anchors = best ? toc(best).find('a').toArray().filter(chapterLike) : [];
  }
  const seen = new Set<string>();
  const links: { url: string; text: string }[] = [];
  for (const a of anchors) {
    const abs = resolve(a);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    links.push({ url: abs, text: toc(a).text().replace(/\s+/g, ' ').trim() });
  }
  // Some sites list newest first: put chapter 1 first.
  const num = (t: string) => Number(/(\d+)/.exec(t)?.[1]);
  const first = num(links[0]?.text ?? ''), last = num(links[links.length - 1]?.text ?? '');
  if (links.length > 1 && first > last) links.reverse();
  return links;
}

const PAGE_PARAM = /(\/trang-|\/page[-/]|[?&]page=|\/p-)(\d+)/i;
const MAX_TOC_PAGES = 200;

/** Pagination of a TOC (".../trang-2/", "?page=2", ...): returns a builder for page N and the last page number. */
function tocPages(toc: cheerio.CheerioAPI, tocUrl: string): { max: number; urlFor: (n: number) => string } | undefined {
  const base = new URL(tocUrl);
  const basePath = base.pathname.replace(/\/$/, '');
  let best: { max: number; tpl: string } | undefined;
  toc('a[href]').each((_, a) => {
    let u: URL;
    try {
      u = new URL(toc(a).attr('href')!, tocUrl);
    } catch {
      return;
    }
    if (u.host !== base.host || !u.pathname.startsWith(basePath)) return;
    const rel = u.pathname + u.search;
    const m = PAGE_PARAM.exec(rel);
    if (!m) return;
    const n = Number(m[2]);
    if (!best || n > best.max) best = { max: n, tpl: `${u.origin}${rel.replace(PAGE_PARAM, (_x, pre) => `${pre}\u0000`)}` };
  });
  if (!best || best.max < 2) return undefined;
  const { max, tpl } = best;
  return { max: Math.min(max, MAX_TOC_PAGES), urlFor: (n) => tpl.replace('\u0000', String(n)) };
}

/** Chapter links across all TOC pages, stopping once `need` links are known (pass Infinity for all). */
export async function collectAllLinks(cfg: CrawlConfig, need: number, onPage?: (page: number, max: number) => void) {
  const toc = cheerio.load(await fetchHtml(cfg.tocUrl));
  const links = collectLinks(toc, cfg.tocUrl, cfg.linkSelector || undefined);
  const pages = tocPages(toc, cfg.tocUrl);
  if (pages && links.length > 0) {
    const seen = new Set(links.map((l) => l.url));
    for (let n = 2; n <= pages.max && links.length < need; n++) {
      onPage?.(n, pages.max);
      const pageUrl = pages.urlFor(n);
      const more = collectLinks(cheerio.load(await fetchHtml(pageUrl)), pageUrl, cfg.linkSelector || undefined);
      let fresh = 0;
      for (const l of more) if (!seen.has(l.url)) (seen.add(l.url), links.push(l), fresh++);
      if (fresh === 0) break;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return { links, pages: pages?.max ?? 1 };
}

export interface CrawlPreview {
  chapterTotal: number; // links found on the first TOC page
  pages: number; // number of TOC pages
  firstTitle: string;
  sample: string[];
  paragraphs: number;
}

/** Dry run for the admin UI: finds the chapter list and reads one chapter without saving anything. */
export async function previewCrawl(cfg: CrawlConfig): Promise<CrawlPreview> {
  const { links, pages } = await collectAllLinks(cfg, 1);
  if (links.length === 0) {
    throw new Error('Không nhận ra danh sách chương trong link này. Hãy dán link trang chính của truyện (có liệt kê các chương), hoặc mở "Nâng cao" để nhập selector.');
  }
  const $ = cheerio.load(await fetchHtml(links[0].url));
  const content = extractParagraphs($, cfg.contentSelector || undefined);
  if (content.length === 0) {
    throw new Error('Tìm thấy chương nhưng không đọc được nội dung. Hãy mở "Nâng cao" để nhập selector nội dung.');
  }
  return { chapterTotal: links.length, pages, firstTitle: links[0].text || 'Chương 1', sample: content.slice(0, 3).map((t) => t.slice(0, 200)), paragraphs: content.length };
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
  const have = chapterCount(storyId);
  const { links } = await collectAllLinks(cfg, have + limit, (n, max) => log(`Tải trang mục lục ${n}/${max}...`));
  log(`Tìm thấy ${links.length} chương trong mục lục.`);
  if (links.length === 0) throw new Error('Không tìm thấy link chương: hãy dán link trang chính của truyện, hoặc nhập selector ở mục Nâng cao.');

  saveCrawlConfig(storyId, cfg);

  const todo = links.slice(have, have + limit);
  if (todo.length === 0) {
    log('Không có chương mới.');
    return { added: 0, logs };
  }

  opts.onProgress?.(0, todo.length);
  log(`Sẽ tải ${todo.length} chương (từ chương ${have + 1}), ${CONCURRENCY} chương song song.`);
  const fetchChapter = async (url: string, fallbackTitle: string) => {
    const $ = cheerio.load(await fetchHtml(url));
    const content = extractParagraphs($, cfg.contentSelector || undefined);
    if (content.length === 0) throw new Error('không đọc được nội dung (thử nhập selector nội dung ở mục Nâng cao)');
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
