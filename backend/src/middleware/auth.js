import { getLang, tSystem } from '../i18n/translations.js';
import { db } from '../db.js';

// Per-account access gate. Every request to a protected route must carry a bearer
// session token (issued at signup/login, see auth/routes.js) identifying which
// athlete's data to read/write — this is what lets several people share one
// deployment without seeing each other's plans, nutrition, or weigh-ins.
export function requireAuth(req, res, next) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) {
    return res.status(401).json({ error: tSystem(getLang(req), 'unauthorized') });
  }
  const session = db.prepare(
    `SELECT s.user_id as userId, u.email as email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).get(token);
  if (!session) {
    return res.status(401).json({ error: tSystem(getLang(req), 'unauthorized') });
  }
  req.userId = session.userId;
  req.userEmail = session.email;
  next();
}
