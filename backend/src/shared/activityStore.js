import { db } from '../db.js';

const upsertStmt = db.prepare(`
  INSERT INTO activities (id, user_id, start_date, type, name, distance_m, moving_time_s, elapsed_time_s,
    avg_watts, weighted_avg_watts, max_watts, avg_hr, max_hr, kilojoules, suffer_score,
    total_elevation_gain, tss_estimate, tss_method, source, raw_json)
  VALUES (@id, @user_id, @start_date, @type, @name, @distance_m, @moving_time_s, @elapsed_time_s,
    @avg_watts, @weighted_avg_watts, @max_watts, @avg_hr, @max_hr, @kilojoules, @suffer_score,
    @total_elevation_gain, @tss_estimate, @tss_method, @source, @raw_json)
  ON CONFLICT(id) DO UPDATE SET
    user_id=excluded.user_id, start_date=excluded.start_date, type=excluded.type, name=excluded.name,
    distance_m=excluded.distance_m, moving_time_s=excluded.moving_time_s,
    elapsed_time_s=excluded.elapsed_time_s, avg_watts=excluded.avg_watts,
    weighted_avg_watts=excluded.weighted_avg_watts, max_watts=excluded.max_watts,
    avg_hr=excluded.avg_hr, max_hr=excluded.max_hr, kilojoules=excluded.kilojoules,
    suffer_score=excluded.suffer_score, total_elevation_gain=excluded.total_elevation_gain,
    tss_estimate=excluded.tss_estimate, tss_method=excluded.tss_method,
    source=excluded.source, raw_json=excluded.raw_json
`);

// Shared upsert used by every non-live-Strava ingestion path (CSV/ZIP bulk import,
// GPX/TCX single-file import, manual entry). Keyed by `id` — real Strava IDs are
// always positive (and globally unique across all Strava accounts, so two different
// athletes' real rides never collide); file/manual imports use a deterministic
// negative synthetic ID that also folds in the athlete's own user id (see
// import/manual.js, import/activityFile.js) so two different athletes importing
// similarly-named entries can't collide with each other either.
export function upsertActivity(row, userId) {
  upsertStmt.run({
    distance_m: null,
    moving_time_s: null,
    elapsed_time_s: null,
    avg_watts: null,
    weighted_avg_watts: null,
    max_watts: null,
    avg_hr: null,
    max_hr: null,
    kilojoules: null,
    suffer_score: null,
    total_elevation_gain: null,
    raw_json: null,
    ...row,
    user_id: userId,
  });
}

export function upsertActivities(rows, userId) {
  let count = 0;
  for (const row of rows) {
    upsertActivity(row, userId);
    count++;
  }
  return count;
}

export function listRecentActivities(userId, limit = 100) {
  return db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY start_date DESC LIMIT ?').all(userId, limit);
}
