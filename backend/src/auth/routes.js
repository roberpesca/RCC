import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword, verifyPassword, generateSessionToken, sessionExpiry } from './passwords.js';
import { requireAuth } from '../middleware/auth.js';
import { getLang, tAuth } from '../i18n/translations.js';

export const authRouter = Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createSession(userId) {
  const token = generateSessionToken();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, sessionExpiry());
  return token;
}

authRouter.post('/signup', (req, res) => {
  const lang = getLang(req);
  const { email, password, name, signupCode } = req.body || {};

  const requiredCode = process.env.SIGNUP_CODE;
  if (requiredCode && signupCode !== requiredCode) {
    return res.status(403).json({ error: tAuth(lang, 'invalidSignupCode') });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: tAuth(lang, 'invalidEmail') });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: tAuth(lang, 'passwordTooShort') });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: tAuth(lang, 'emailTaken') });
  }

  const info = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(
    normalizedEmail,
    hashPassword(String(password)),
    (name || '').trim() || null
  );
  const userId = Number(info.lastInsertRowid);
  const token = createSession(userId);
  res.json({ token, user: { id: userId, email: normalizedEmail, name: name || null } });
});

authRouter.post('/login', (req, res) => {
  const lang = getLang(req);
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: tAuth(lang, 'invalidCredentials') });
  }
  const token = createSession(user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});
