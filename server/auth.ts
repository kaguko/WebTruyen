import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const COOKIE = 'tf_admin';
const TTL_MS = 12 * 60 * 60 * 1000;

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'); // random => sessions reset on restart

if (!PASSWORD) console.warn('[auth] ADMIN_PASSWORD chưa được đặt: không thể đăng nhập admin.');
if (!process.env.SESSION_SECRET) console.warn('[auth] SESSION_SECRET chưa đặt: phiên admin sẽ mất khi khởi động lại.');

const sign = (value: string) => crypto.createHmac('sha256', SECRET).update(value).digest('hex');
const safeEqual = (a: string, b: string) => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export const checkPassword = (input: string) => PASSWORD !== '' && safeEqual(input, PASSWORD);

export const issueSession = (res: Response) => {
  const exp = String(Date.now() + TTL_MS);
  const token = `${exp}.${sign(exp)}`;
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    maxAge: TTL_MS,
    path: '/',
  });
};

export const clearSession = (res: Response) => {
  res.clearCookie(COOKIE, { path: '/' });
};

const readCookie = (req: Request, name: string): string | undefined => {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
};

export const isAdmin = (req: Request): boolean => {
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  next();
};
