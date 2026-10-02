/** URL scheme shared by the client router and the server (SEO meta, sitemap). */

export const slugify = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const GENRES = [
  'Tiên Hiệp', 'Kiếm Hiệp', 'Huyền Huyễn', 'Ngôn Tình', 'Đô Thị', 'Khoa Huyễn', 'Võng Du',
  'Dị Năng', 'Linh Dị', 'Trọng Sinh', 'Xuyên Không', 'Hệ Thống', 'Mạt Thế', 'Cổ Đại',
] as const;

export const genreFromSlug = (slug: string): string | undefined => GENRES.find((g) => slugify(g) === slug);

export const homePath = () => '/';
export const genrePath = (genre: string) => `/the-loai/${slugify(genre)}`;
export const storyPath = (slug: string) => `/truyen/${slug}`;
export const chapterPath = (slug: string, n: number) => `/truyen/${slug}/chuong-${n}`;

export type Route =
  | { type: 'home' }
  | { type: 'genre'; genre: string }
  | { type: 'story'; slug: string }
  | { type: 'chapter'; slug: string; n: number }
  | { type: 'notfound' };

export const parseRoute = (pathname: string): Route => {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return { type: 'home' };
  let m = p.match(/^\/the-loai\/([a-z0-9-]+)$/);
  if (m) {
    const genre = genreFromSlug(m[1]);
    return genre ? { type: 'genre', genre } : { type: 'notfound' };
  }
  m = p.match(/^\/truyen\/([a-z0-9-]+)$/);
  if (m) return { type: 'story', slug: m[1] };
  m = p.match(/^\/truyen\/([a-z0-9-]+)\/chuong-(\d{1,6})$/);
  if (m) return { type: 'chapter', slug: m[1], n: Number(m[2]) };
  return { type: 'notfound' };
};
