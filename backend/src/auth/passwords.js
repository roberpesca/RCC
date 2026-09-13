// Password hashing and session tokens using only Node's built-in crypto module —
// no bcrypt/jsonwebtoken dependency, consistent with this project's "no native
// addons, runs anywhere modern Node runs" approach (see db.js).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  const hash = scryptSync(password, salt, KEY_LEN);
  const expected = Buffer.from(hashHex, 'hex');
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

// Opaque bearer session tokens (not JWTs): the token itself carries no data, it's
// just a random key looked up in the `sessions` table. Simpler than JWT (no secret
// to manage, no signature-verification code) and trivially revocable on logout —
// fine for this app's scale (SQLite, a handful of users).
export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

const SESSION_TTL_DAYS = 90;

export function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d.toISOString();
}
