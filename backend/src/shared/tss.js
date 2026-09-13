import { db, getProfile, updateProfile } from '../db.js';

// --- TSS estimation -------------------------------------------------------
// Shared by every ingestion path (live Strava OAuth sync, bulk CSV/ZIP import,
// single-activity GPX/TCX import, and manual entry) so a ride gets the same
// training-load treatment no matter how it got into the app.
//
// Power-based (most accurate): TSS = (seconds * NP * IF) / (FTP * 3600) * 100
// HR/effort fallback: Strava's "Relative Effort" tracks TSS reasonably well for a
// rider with well-set HR zones, so we use it directly when power is absent.
// Last-resort fallback: assume a moderate intensity factor for the ride duration.
export function estimateTss(activity, ftp) {
  const np = activity.weighted_average_watts || activity.average_watts;
  if (np && ftp) {
    const ifactor = np / ftp;
    const hours = (activity.moving_time || 0) / 3600;
    return { tss: Math.round(hours * ifactor * ifactor * 100), method: 'power' };
  }
  if (typeof activity.suffer_score === 'number' && !Number.isNaN(activity.suffer_score)) {
    return { tss: Math.round(activity.suffer_score), method: 'relative_effort' };
  }
  const hours = (activity.moving_time || 0) / 3600;
  const assumedIF = 0.65;
  return { tss: Math.round(hours * assumedIF * assumedIF * 100), method: 'duration_estimate' };
}

// Heuristic FTP estimate: look at hard efforts of 18-70 min in the last 42 days and
// back into an FTP number. Deliberately conservative — only nudges FTP upward when
// there's clear evidence, never overrides a manual entry downward automatically.
// Works purely off the local `activities` table, so it applies equally whether those
// rides came from live Strava sync or a file import.
export function maybeUpdateFtpEstimate(userId) {
  const profile = getProfile(userId);
  const currentFtp = profile.ftp_watts || 0;
  const cutoff = new Date(Date.now() - 42 * 24 * 3600 * 1000).toISOString();
  const rows = db.prepare(
    `SELECT * FROM activities WHERE user_id = ? AND start_date >= ? AND weighted_avg_watts IS NOT NULL
     AND moving_time_s BETWEEN 1080 AND 4200 ORDER BY start_date DESC`
  ).all(userId, cutoff);

  let bestCandidate = 0;
  for (const r of rows) {
    const minutes = r.moving_time_s / 60;
    // Roughly: ~20min effort -> FTP ~= 0.95 * NP; ~60min effort -> FTP ~= NP
    const factor = minutes <= 25 ? 0.95 : minutes >= 50 ? 1.0 : 0.97;
    const candidate = r.weighted_avg_watts * factor;
    if (candidate > bestCandidate) bestCandidate = candidate;
  }

  if (bestCandidate > 0 && bestCandidate > currentFtp * 1.02 && bestCandidate < currentFtp * 1.25) {
    const rounded = Math.round(bestCandidate);
    db.prepare(`INSERT INTO ftp_history (user_id, date, ftp_watts, source) VALUES (?, date('now', 'localtime'), ?, 'estimated')`).run(userId, rounded);
    updateProfile(userId, { ftp_watts: rounded });
    return rounded;
  } else if (!currentFtp && bestCandidate > 0) {
    const rounded = Math.round(bestCandidate);
    db.prepare(`INSERT INTO ftp_history (user_id, date, ftp_watts, source) VALUES (?, date('now', 'localtime'), ?, 'estimated')`).run(userId, rounded);
    updateProfile(userId, { ftp_watts: rounded });
    return rounded;
  }
  return null;
}
