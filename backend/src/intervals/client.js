// Intervals.icu auth is a personal API key, not OAuth: Basic auth with username
// "API_KEY" and the key itself as the password. No app registration/approval
// needed, and critically no per-app athlete cap the way a new Strava API app is
// capped at one authorized athlete — every friend just grabs their own key from
// their own intervals.icu account (Settings > Developer Settings) and pastes it
// into ours. The athlete id in API paths can be '0' as shorthand for "whoever
// this key belongs to", so we never need to look it up separately for most calls.
import fetch from 'node-fetch';
import { db } from '../db.js';

// Overridable via env for testing against a local stand-in server; always the
// real Intervals.icu API in production since the env var is never set there.
const INTERVALS_API = process.env.INTERVALS_API_BASE || 'https://intervals.icu/api/v1';

export function getConnection(userId) {
  return db.prepare('SELECT * FROM intervals_icu_connections WHERE user_id = ?').get(userId);
}

export function isConnected(userId) {
  return !!getConnection(userId);
}

export function saveConnection(userId, { apiKey, athleteId, athleteName }) {
  db.prepare(
    `INSERT INTO intervals_icu_connections (user_id, api_key, athlete_id, athlete_name)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET api_key = excluded.api_key, athlete_id = excluded.athlete_id, athlete_name = excluded.athlete_name`
  ).run(userId, apiKey, athleteId ?? null, athleteName ?? null);
}

export function disconnect(userId) {
  db.prepare('DELETE FROM intervals_icu_connections WHERE user_id = ?').run(userId);
}

export function markPulled(userId) {
  db.prepare(`UPDATE intervals_icu_connections SET last_pulled_at = datetime('now') WHERE user_id = ?`).run(userId);
}

function basicAuthHeader(apiKey) {
  return 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64');
}

// Low-level authenticated request against a given API key — used both by the
// connect flow (to validate a key before saving it) and by intervalsFetch below.
export async function intervalsFetchWithKey(apiKey, path, { method = 'GET', query, body } = {}) {
  const url = new URL(`${INTERVALS_API}${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => v !== undefined && v !== null && url.searchParams.set(k, v));
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: basicAuthHeader(apiKey),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Intervals.icu API error ${res.status} on ${path}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

// Looks up the stored connection for this user and makes the call with it.
export async function intervalsFetch(userId, path, opts) {
  const conn = getConnection(userId);
  if (!conn) throw new Error('Intervals.icu not connected');
  return intervalsFetchWithKey(conn.api_key, path, opts);
}
