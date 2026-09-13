import fetch from 'node-fetch';
import { db } from '../db.js';

const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH = 'https://www.strava.com/oauth';

export function getAuthorizeUrl(state = '') {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: process.env.STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all,profile:read_all',
    state
  });
  return `${STRAVA_OAUTH}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code, userId) {
  const res = await fetch(`${STRAVA_OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code'
    })
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  saveTokens(data, userId);
  return data;
}

function saveTokens(data, userId) {
  db.prepare(
    `INSERT INTO strava_tokens (user_id, athlete_id, access_token, refresh_token, expires_at, scope)
     VALUES (@user_id, @athlete_id, @access_token, @refresh_token, @expires_at, @scope)
     ON CONFLICT(user_id) DO UPDATE SET
       athlete_id=excluded.athlete_id,
       access_token=excluded.access_token,
       refresh_token=excluded.refresh_token,
       expires_at=excluded.expires_at,
       scope=excluded.scope`
  ).run({
    user_id: userId,
    athlete_id: data.athlete?.id ?? null,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    scope: (data.scope || '').toString()
  });
}

export function getStoredTokens(userId) {
  return db.prepare('SELECT * FROM strava_tokens WHERE user_id = ?').get(userId);
}

export function disconnectStrava(userId) {
  db.prepare('DELETE FROM strava_tokens WHERE user_id = ?').run(userId);
}

async function refreshIfNeeded(tokens, userId) {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens.expires_at && tokens.expires_at > nowSec + 60) {
    return tokens.access_token;
  }
  const res = await fetch(`${STRAVA_OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  saveTokens({ ...data, athlete: { id: tokens.athlete_id } }, userId);
  return data.access_token;
}

export async function stravaFetch(userId, endpoint, params = {}) {
  const tokens = getStoredTokens(userId);
  if (!tokens) throw new Error('Strava not connected');
  const accessToken = await refreshIfNeeded(tokens, userId);
  const url = new URL(`${STRAVA_API}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Strava API error ${res.status} on ${endpoint}: ${await res.text()}`);
  return res.json();
}

export function isConnected(userId) {
  return !!getStoredTokens(userId);
}
