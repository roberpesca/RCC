// Pushes the active plan's upcoming sessions to the athlete's Intervals.icu
// calendar, so Intervals.icu's own Garmin push (and Hammerhead Karoo's native
// Intervals.icu connection) can carry them the rest of the way to the device.
// IMPORTANT caveat, confirmed on the Intervals.icu forum: a workout only reliably
// reaches a connected Garmin when it's created using Intervals.icu's own plain-text
// workout description language (what this file generates) rather than an uploaded
// FIT/ZWO file — at least one developer reported file-based events never synced to
// Garmin at all. This still depends on the athlete having Garmin (or Hammerhead)
// actually connected inside their own Intervals.icu account, with "push workouts to
// Garmin" enabled there — that last leg is entirely Intervals.icu's own pipeline,
// outside anything we can control or verify from here.
import { db } from '../db.js';
import { intervalsFetch, isConnected } from './client.js';
import { tWorkout, tSegmentNote, DEFAULT_LANG } from '../i18n/translations.js';
import { todayStr } from '../shared/dates.js';

function segmentToLine(seg, lang) {
  const pct = Math.round(((seg.ifLow ?? 0) + (seg.ifHigh ?? 0)) / 2 * 100);
  const label = tSegmentNote(seg.note, lang) || seg.note || '';
  return `- ${seg.minutes}m ${pct}% ${label}`.trim();
}

// Exported for direct testing — turns our segment array (or its raw JSON string)
// into Intervals.icu's own workout-description text, one flat line per segment
// (e.g. "- 15m 55% Warmup"). Not as compact as their "3x\n- ...\n- ..." repeat-block
// shorthand, but every line is independently valid in their language, so this
// can't fail to parse the way a hand-rolled repeat block risks doing.
export function buildWorkoutDescription(structure, lang = DEFAULT_LANG) {
  let segments = structure;
  if (typeof segments === 'string') {
    try {
      segments = JSON.parse(segments || '[]');
    } catch {
      return '';
    }
  }
  if (!Array.isArray(segments) || segments.length === 0) return '';
  return segments.map((s) => segmentToLine(s, lang)).join('\n');
}

export async function pushPlanToIntervals(userId, lang = DEFAULT_LANG) {
  if (!isConnected(userId)) return { pushed: 0, skipped: 'not_connected' };
  const plan = db.prepare(`SELECT * FROM plans WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`).get(userId);
  if (!plan) return { pushed: 0, skipped: 'no_active_plan' };

  const today = todayStr();
  // Only upcoming, still-planned, real (non-rest) sessions — Intervals.icu doesn't
  // need to know about rest days, and a day that already happened shouldn't be
  // re-pushed as if it were still upcoming.
  const workouts = db
    .prepare(
      `SELECT * FROM plan_workouts WHERE plan_id = ? AND status = 'planned' AND day_date >= ? AND workout_key IS NOT NULL AND workout_key != 'rest' ORDER BY day_date ASC`
    )
    .all(plan.id, today);

  if (workouts.length === 0) return { pushed: 0 };

  // external_id is how Intervals.icu's upsert matches an existing event to update
  // rather than creating a duplicate, and it's only ever matched against events
  // our own app created — keying it to the plan_workouts row id means a workout
  // that later gets adapted (mismatch/reschedule) re-pushes as an UPDATE to the
  // same calendar event, not a second one.
  const events = workouts.map((w) => {
    const text = tWorkout(w.workout_key, lang);
    return {
      category: 'WORKOUT',
      type: 'Ride',
      start_date_local: `${w.day_date}T00:00:00`,
      name: text.title,
      description: buildWorkoutDescription(w.structure_json, lang),
      moving_time: Math.round((w.planned_duration_min || 0) * 60),
      icu_training_load: Math.round(w.planned_tss || 0),
      target: 'POWER',
      workout_doc: {},
      external_id: `coach-workout-${w.id}`,
    };
  });

  await intervalsFetch(userId, '/athlete/0/events/bulk', { method: 'POST', query: { upsert: 'true' }, body: events });
  return { pushed: events.length };
}

// Best-effort wrapper for call sites that mutate the plan (generate/adapt/
// reschedule) — a push failure (bad/revoked key, Intervals.icu briefly down)
// should never break the user-facing action that triggered it.
export async function maybeSyncPush(userId, lang = DEFAULT_LANG) {
  if (!isConnected(userId)) return;
  try {
    await pushPlanToIntervals(userId, lang);
  } catch {
    // swallow — the plan mutation itself already succeeded and was already returned
  }
}
