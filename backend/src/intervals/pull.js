// Pulls completed activities FROM Intervals.icu — which is itself already synced
// from the athlete's Garmin/Hammerhead/other devices — into our own `activities`
// table, using the exact same upsert path (and therefore the exact same downstream
// matching/adaptation logic) as Strava import and manual entry.
import { db, getProfile } from '../db.js';
import { intervalsFetch, getConnection, markPulled } from './client.js';
import { upsertActivity } from '../shared/activityStore.js';
import { estimateTss, maybeUpdateFtpEstimate } from '../shared/tss.js';
import { localDateStr } from '../shared/dates.js';

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'Handcycle', 'Velomobile']);

// Intervals.icu activity ids (e.g. "i55751783") aren't the plain positive integers
// our `activities.id` column expects for real Strava rides, so — same trick as
// manual/file import — fold the id into a deterministic negative integer, salted
// with the athlete's own user id so two different athletes' ids can never collide.
function hashToNegativeId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return -Math.abs(h);
}

// Debounced: called on every GET /training/plan/active, but only actually hits
// Intervals.icu's API at most once every DEBOUNCE_MS, so opening the app
// repeatedly doesn't hammer their rate limits. `force` (used by the manual "Sync
// now" button) skips the debounce.
const DEBOUNCE_MS = 5 * 60 * 1000;

export async function maybeAutoPull(userId) {
  const conn = getConnection(userId);
  if (!conn) return null;
  if (conn.last_pulled_at) {
    const elapsed = Date.now() - new Date(conn.last_pulled_at + 'Z').getTime();
    if (elapsed < DEBOUNCE_MS) return null;
  }
  try {
    return await pullActivities(userId);
  } catch {
    // Best-effort: a flaky/expired key should never break loading the plan.
    return null;
  }
}

export async function pullActivities(userId, { days = 30, force = false } = {}) {
  const conn = getConnection(userId);
  if (!conn) throw new Error('Intervals.icu not connected');
  if (!force && conn.last_pulled_at && Date.now() - new Date(conn.last_pulled_at + 'Z').getTime() < DEBOUNCE_MS) {
    return { imported: 0, skipped: 'debounced' };
  }

  const profile = getProfile(userId);
  const ftp = profile.ftp_watts || 200;
  const oldest = localDateStr(new Date(Date.now() - days * 86400000));
  const newest = localDateStr(new Date());

  const activities = await intervalsFetch(userId, '/athlete/0/activities', { query: { oldest, newest } });
  let imported = 0;
  for (const a of activities || []) {
    if (a.type && !RIDE_TYPES.has(a.type)) continue; // cycling-only app — skip runs/swims/etc. pulled in from other devices
    const localTime = a.start_date_local || a.start_date;
    if (!localTime) continue;

    // Intervals.icu already computes its own training-load number (accounting for
    // the athlete's real zones/FTP history), which is a better estimate than we
    // could derive after the fact — use it directly when present, and only fall
    // back to our own power/HR-based estimate for the rare activity without one.
    let tss = typeof a.icu_training_load === 'number' ? Math.round(a.icu_training_load) : null;
    let method = tss !== null ? 'icu_training_load' : null;
    if (tss === null) {
      const est = estimateTss(
        { average_watts: a.average_watts, weighted_average_watts: a.weighted_average_watts, suffer_score: a.icu_rpe, moving_time: a.moving_time },
        ftp
      );
      tss = est.tss;
      method = est.method;
    }

    upsertActivity(
      {
        id: hashToNegativeId(`intervals_icu|${userId}|${a.id}`),
        start_date: new Date(localTime).toISOString(),
        type: a.type || 'Ride',
        name: a.name || 'Intervals.icu activity',
        distance_m: a.distance ?? null,
        moving_time_s: a.moving_time ?? null,
        elapsed_time_s: a.elapsed_time ?? null,
        avg_watts: a.average_watts ?? null,
        weighted_avg_watts: a.weighted_average_watts ?? null,
        max_watts: a.max_watts ?? null,
        avg_hr: a.average_heartrate ?? null,
        max_hr: a.max_heartrate ?? null,
        kilojoules: null,
        suffer_score: a.icu_rpe ?? null,
        total_elevation_gain: a.total_elevation_gain ?? null,
        tss_estimate: tss,
        tss_method: method,
        source: 'intervals_icu',
        raw_json: JSON.stringify(a),
      },
      userId
    );
    imported++;
  }

  markPulled(userId);
  maybeUpdateFtpEstimate(userId);
  return { imported };
}
