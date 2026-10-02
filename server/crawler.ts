import * as cheerio from 'cheerio';
import type { Chapter } from '../src/types';
import { CrawlConfig, chapterCount, getStory, upsertChapter, addNotification, saveCrawlConfig } from './db';

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

/** Crawl new chapters (by TOC order; chapter N = Nth link) for a story. Only chapters beyond the current count are fetched. */
export async function crawlStory(storyId: string, cfg: CrawlConfig, limit = 20): Promise<CrawlResult> {
  const logs: string[] = [];
  const log = (m: string) => logs.push(m);
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

  let added = 0;
  for (let i = 0; i < todo.length; i++) {
    const number = have + i + 1;
    try {
      const $ = cheerio.load(await fetchHtml(todo[i].url));
      const content = extractParagraphs($, cfg.contentSelector);
      if (content.length === 0) throw new Error('nội dung rỗng (sai selector nội dung?)');
      const title = (cfg.titleSelector && $(cfg.titleSelector).first().text().trim()) || todo[i].text || `Chương ${number}`;
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
      log(`✓ Chương ${number}: ${title}`);
    } catch (e: any) {
      log(`✗ Chương ${number} lỗi: ${e?.message || e}. Dừng để tránh bỏ sót thứ tự.`);
      break;
    }
    await new Promise((r) => setTimeout(r, 800)); // be polite to the source
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
