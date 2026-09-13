import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { getAuthorizeUrl, exchangeCodeForToken, isConnected, disconnectStrava } from './client.js';
import { syncActivities } from './sync.js';

// Public router: only the OAuth redirect target, which Strava hits directly and
// therefore can't carry our session's bearer token. Instead, /connect (below, behind
// auth) stashes a one-time `state` value bound to the logged-in user just before
// redirecting to Strava, and this callback looks it up to know whose account to
// attach the tokens to.
export const stravaPublicRouter = Router();
stravaPublicRouter.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (error) return res.redirect(`${frontend}/settings?strava=denied`);
  const pending = state && db.prepare('SELECT user_id as userId FROM strava_pending_connect WHERE state = ?').get(state);
  if (!pending) return res.redirect(`${frontend}/settings?strava=error`);
  db.prepare('DELETE FROM strava_pending_connect WHERE state = ?').run(state); // single-use
  try {
    await exchangeCodeForToken(code, pending.userId);
    await syncActivities(pending.userId);
    res.redirect(`${frontend}/settings?strava=connected`);
  } catch (e) {
    console.error(e);
    res.redirect(`${frontend}/settings?strava=error`);
  }
});

// Protected router: everything else, gated behind requireAuth in index.js.
export const stravaRouter = Router();

stravaRouter.get('/status', (req, res) => {
  res.json({ connected: isConnected(req.userId) });
});

// Redirects the browser straight to Strava's consent screen. Note: Strava API apps
// start capped at one authorized athlete ("single player mode") until Strava approves
// a capacity increase, so in a shared deployment this button will realistically only
// work for whoever owns the Strava API app — everyone else gets an error from Strava
// itself when they try. File import (Settings > Get your data in) has no such limit.
stravaRouter.get('/connect', (req, res) => {
  const state = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO strava_pending_connect (state, user_id) VALUES (?, ?)').run(state, req.userId);
  res.redirect(getAuthorizeUrl(state));
});

stravaRouter.post('/sync', async (req, res) => {
  try {
    const result = await syncActivities(req.userId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

stravaRouter.post('/disconnect', (req, res) => {
  disconnectStrava(req.userId);
  res.json({ ok: true });
});
