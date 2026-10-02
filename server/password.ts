import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEYLEN = 64;
// Fixed dummy hash used to equalise timing when the email is unknown.
const DUMMY = `${'0'.repeat(32)}:${'0'.repeat(KEYLEN * 2)}`;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
};

export const verifyPassword = async (password: string, stored?: string): Promise<boolean> => {
  const [saltHex, keyHex] = (stored || DUMMY).split(':');
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), KEYLEN);
  const expected = Buffer.from(keyHex, 'hex');
  return Boolean(stored) && expected.length === key.length && crypto.timingSafeEqual(key, expected);
};
