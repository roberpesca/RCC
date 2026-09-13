import { db, getProfile, updateProfile } from '../db.js';
import { stravaFetch } from './client.js';
import { estimateTss, maybeUpdateFtpEstimate } from '../shared/tss.js';
import { upsertActivity } from '../shared/activityStore.js';

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide']);

// NOTE: this is the *optional, advanced* live-sync path. New Strava API apps are
// created in "single player mode" — capped at 1 authorized athlete until Strava
// reviews and approves a rate-limit/athlete-capacity increase — so in a shared,
// multi-friend deployment this realistically only works for whoever owns the Strava
// API app (usually the person who deployed the instance). Everyone else should use
// file import (see src/import/), which has no such cap and is the primary,
// always-available data path.
export async function syncActivities(userId, { perPage = 60, pages = 2 } = {}) {
  const profile = getProfile(userId);
  const ftp = profile.ftp_watts || 200;

  let imported = 0;
  for (let page = 1; page <= pages; page++) {
    const activities = await stravaFetch(userId, '/athlete/activities', { per_page: perPage, page });
    if (!activities.length) break;
    for (const a of activities) {
      if (!RIDE_TYPES.has(a.type) && !RIDE_TYPES.has(a.sport_type)) continue;
      const { tss, method } = estimateTss(a, ftp);
      upsertActivity({
        id: a.id,
        start_date: a.start_date,
        type: a.sport_type || a.type,
        name: a.name,
        distance_m: a.distance,
        moving_time_s: a.moving_time,
        elapsed_time_s: a.elapsed_time,
        avg_watts: a.average_watts ?? null,
        weighted_avg_watts: a.weighted_average_watts ?? null,
        max_watts: a.max_watts ?? null,
        avg_hr: a.average_heartrate ?? null,
        max_hr: a.max_heartrate ?? null,
        kilojoules: a.kilojoules ?? null,
        suffer_score: a.suffer_score ?? null,
        total_elevation_gain: a.total_elevation_gain ?? null,
        tss_estimate: tss,
        tss_method: method,
        source: 'strava_api',
        raw_json: JSON.stringify(a),
      }, userId);
      imported++;
    }
    if (activities.length < perPage) break;
  }

  maybeUpdateFtpEstimate(userId);
  await maybeUpdateWeightFromStrava(userId);
  return { imported };
}

async function maybeUpdateWeightFromStrava(userId) {
  try {
    const athlete = await stravaFetch(userId, '/athlete');
    if (athlete.weight) {
      const profile = getProfile(userId);
      const latestWeighIn = db.prepare('SELECT * FROM weigh_ins WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(userId);
      if (!latestWeighIn && !profile.weight_kg) {
        updateProfile(userId, { weight_kg: athlete.weight });
      }
    }
  } catch {
    // non-fatal
  }
}
