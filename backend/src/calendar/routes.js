import { Router } from 'express';
import { getOrCreateCalendarToken, regenerateCalendarToken, getUserIdByCalendarToken } from '../db.js';
import { buildIcsForUser } from './ics.js';
import { DEFAULT_LANG } from '../i18n/translations.js';

// Public router: the actual .ics feed. Calendar apps (Google Calendar, Apple
// Calendar, etc.) poll this URL directly and can't send our session's bearer
// header, so the unguessable token in the path IS the auth — same pattern as the
// Strava OAuth callback in strava/routes.js.
export const calendarPublicRouter = Router();

calendarPublicRouter.get('/feed/:tokenWithExt', (req, res) => {
  const token = req.params.tokenWithExt.replace(/\.ics$/i, '');
  const userId = getUserIdByCalendarToken(token);
  if (!userId) return res.status(404).send('Not found');
  const lang = (req.query.lang === 'es' ? 'es' : req.query.lang === 'en' ? 'en' : DEFAULT_LANG);
  const ics = buildIcsForUser(userId, lang);
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'inline; filename="training-plan.ics"');
  res.send(ics);
});

// Protected router: managing (not reading) the feed — getting your own URL, or
// rotating it so a previously-shared link stops working.
export const calendarRouter = Router();

function feedUrl(req, token) {
  const base = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}/api`;
  const lang = req.query.lang === 'es' ? 'es' : 'en';
  return `${base}/calendar/feed/${token}.ics?lang=${lang}`;
}

calendarRouter.get('/token', (req, res) => {
  const token = getOrCreateCalendarToken(req.userId);
  res.json({ token, url: feedUrl(req, token) });
});

calendarRouter.post('/token/regenerate', (req, res) => {
  const token = regenerateCalendarToken(req.userId);
  res.json({ token, url: feedUrl(req, token) });
});
