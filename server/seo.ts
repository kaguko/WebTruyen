import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import * as db from './db';
import { parseRoute, storyPath, chapterPath, genrePath, GENRES } from '../src/routes';

const SITE_NAME = 'TruyenFull Live';
const DEFAULT_TITLE = `${SITE_NAME} - Đọc Truyện Online Tối Ưu, Cập Nhật Nhanh`;
const DEFAULT_DESC =
  'Nền tảng đọc truyện chữ online mượt mà: cập nhật chương mới nhanh, đọc offline, ghi chú, chế độ đọc ban đêm.';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

export const siteUrl = (req: Request): string =>
  (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

interface Page {
  status: number;
  title: string;
  description: string;
  path: string;
  image?: string;
  type: 'website' | 'book' | 'article';
  noindex?: boolean;
  ld?: unknown[];
  body?: string; // crawler-readable fallback markup placed inside #root (React replaces it on load)
}

function buildPage(req: Request): Page {
  const base = siteUrl(req);
  const route = parseRoute(req.path);
  const home: Page = { status: 200, title: DEFAULT_TITLE, description: DEFAULT_DESC, path: '/', type: 'website' };

  if (route.type === 'home') {
    const stories = db.listStories().slice(0, 30);
    return {
      ...home,
      ld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: base }],
      body: `<h1>${esc(SITE_NAME)}</h1><ul>${stories
        .map((s) => `<li><a href="${storyPath(s.slug)}">${esc(s.title)}</a> - ${esc(s.author)}</li>`)
        .join('')}</ul>`,
    };
  }
  if (route.type === 'genre') {
    const stories = db.listStories().filter((s) => s.genres.includes(route.genre as any));
    return {
      status: 200,
      title: `Truyện ${route.genre} hay nhất, đọc online | ${SITE_NAME}`,
      description: `Danh sách truyện ${route.genre} được cập nhật mới nhất, đọc online miễn phí tại ${SITE_NAME}.`,
      path: genrePath(route.genre),
      type: 'website',
      body: `<h1>Truyện ${esc(route.genre)}</h1><ul>${stories
        .map((s) => `<li><a href="${storyPath(s.slug)}">${esc(s.title)}</a></li>`)
        .join('')}</ul>`,
    };
  }
  if (route.type === 'story' || route.type === 'chapter') {
    const story = db.listStories().find((s) => s.slug === route.slug);
    if (!story) return { ...home, status: 404, noindex: true, title: `Không tìm thấy trang | ${SITE_NAME}` };

    const storyUrl = base + storyPath(story.slug);
    const book = {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: story.title,
      author: { '@type': 'Person', name: story.author },
      description: story.description,
      image: story.cover,
      genre: story.genres,
      url: storyUrl,
      numberOfPages: story.totalChapters,
    };
    if (route.type === 'story') {
      const first = db.listChapterMetas(story.id, 0, 20).items;
      return {
        status: 200,
        title: `${story.title} - ${story.author} | Đọc truyện online | ${SITE_NAME}`,
        description: clip(story.description, 160),
        path: storyPath(story.slug),
        image: story.cover,
        type: 'book',
        ld: [book],
        body: `<h1>${esc(story.title)}</h1><p>Tác giả: ${esc(story.author)}</p><p>${esc(story.description)}</p><ol>${first
          .map((c) => `<li><a href="${chapterPath(story.slug, c.chapterNumber)}">${esc(c.title)}</a></li>`)
          .join('')}</ol>`,
      };
    }
    const ch = db.getChapter(story.id, route.n);
    if (!ch) return { ...home, status: 404, noindex: true, title: `Không tìm thấy chương | ${SITE_NAME}` };
    return {
      status: 200,
      title: `${story.title} - ${ch.title} | ${SITE_NAME}`,
      description: clip(ch.content[0] || story.description, 160),
      path: chapterPath(story.slug, ch.chapterNumber),
      image: story.cover,
      type: 'article',
      ld: [
        book,
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: SITE_NAME, item: base + '/' },
            { '@type': 'ListItem', position: 2, name: story.title, item: storyUrl },
            { '@type': 'ListItem', position: 3, name: ch.title },
          ],
        },
      ],
      body: `<h1>${esc(story.title)}</h1><h2>${esc(ch.title)}</h2>${ch.content.map((p) => `<p>${esc(p)}</p>`).join('')}`,
    };
  }
  return { ...home, status: 404, noindex: true, title: `Không tìm thấy trang | ${SITE_NAME}` };
}

let template: string | null = null;

export function renderPage(req: Request, res: Response, distDir: string) {
  template ??= fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const page = buildPage(req);
  const base = siteUrl(req);
  const url = base + page.path;
  const title = esc(page.title);
  const desc = esc(page.description);
  const tags = [
    `<meta name="description" content="${desc}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    page.noindex ? '<meta name="robots" content="noindex" />' : '',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:type" content="${page.type}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    page.image ? `<meta property="og:image" content="${esc(page.image)}" />` : '',
    `<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}" />`,
    ...(page.ld || []).map((o) => `<script type="application/ld+json">${jsonLd(o)}</script>`),
  ]
    .filter(Boolean)
    .join('\n    ');

  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta\s+(name|property)="(description|og:title|og:description|og:type|twitter:card)"[^>]*>\s*/g, '')
    .replace('</head>', `    ${tags}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${page.body || ''}</div>`);
  res.status(page.status).type('html').send(html);
}

export function robots(req: Request, res: Response) {
  res.type('text/plain').send(`User-agent: *\nDisallow: /api/\nAllow: /\n\nSitemap: ${siteUrl(req)}/sitemap.xml\n`);
}

const MAX_URLS = 50000;
export function sitemap(req: Request, res: Response) {
  const base = siteUrl(req);
  const urls: { loc: string; lastmod?: string }[] = [{ loc: base + '/' }];
  GENRES.forEach((g) => urls.push({ loc: base + genrePath(g) }));
  for (const s of db.listStories()) {
    urls.push({ loc: base + storyPath(s.slug), lastmod: /^\d{4}-/.test(s.lastUpdated) ? s.lastUpdated.slice(0, 10) : undefined });
    for (const c of db.listChapterMetas(s.id, 0, 100000).items) {
      if (urls.length >= MAX_URLS) break;
      urls.push({ loc: base + chapterPath(s.slug, c.chapterNumber), lastmod: c.publishedAt });
    }
  }
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ''}</url>`)
      .join('\n') +
    `\n</urlset>`;
  res.type('application/xml').send(xml);
}
