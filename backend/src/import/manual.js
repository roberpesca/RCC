import { estimateTss } from '../shared/tss.js';

function hashToNegativeId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return -Math.abs(h);
}

// Universal fallback when no file export works: the athlete just types in what they
// did. RPE (rate of perceived exertion, 1-10) is converted to a rough Relative-Effort
// style score so it flows through the same TSS estimator as everything else —
// approximate by design, but far better than no training-load signal at all.
export function buildManualActivity({ date, type = 'Ride', title, durationMin, distanceKm, avgWatts, avgHr, rpe }, ftp, userId) {
  if (!date || !durationMin) throw new Error('date and durationMin are required');
  const movingTimeS = Math.round(Number(durationMin) * 60);
  const sufferScoreProxy = rpe ? Math.round(Number(rpe) * Number(durationMin) * 0.11) : null;

  const activityLike = {
    average_watts: avgWatts ? Number(avgWatts) : null,
    weighted_average_watts: null,
    suffer_score: sufferScoreProxy,
    moving_time: movingTimeS,
  };
  const { tss, method } = estimateTss(activityLike, ftp);

  return {
    // Namespaced by user id so two athletes logging a generically-titled entry on the
    // same day with the same duration ("Manual entry: Ride", 60 min) can't collide.
    id: hashToNegativeId(`manual|${userId}|${date}|${title || type}|${durationMin}`),
    start_date: new Date(`${date}T12:00:00`).toISOString(),
    type,
    name: title || `Manual entry: ${type}`,
    distance_m: distanceKm ? Number(distanceKm) * 1000 : null,
    moving_time_s: movingTimeS,
    elapsed_time_s: movingTimeS,
    avg_watts: avgWatts ? Number(avgWatts) : null,
    weighted_avg_watts: null,
    max_watts: null,
    avg_hr: avgHr ? Number(avgHr) : null,
    max_hr: null,
    kilojoules: null,
    suffer_score: sufferScoreProxy,
    total_elevation_gain: null,
    tss_estimate: tss,
    tss_method: method,
    source: 'manual',
  };
}
