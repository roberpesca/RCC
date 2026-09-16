import { db } from '../db.js';
import { getPlan } from './planEngine.js';
import { DEFAULT_LANG, tAdaptReason, tAdaptMessage, tMismatchReason } from '../i18n/translations.js';
import { localDateStr, todayStr } from '../shared/dates.js';

// --- Performance Management Chart: CTL (fitness) / ATL (fatigue) / TSB (form) ---
// Standard exponentially-weighted moving averages over daily TSS, same math used by
// TrainingPeaks/intervals.icu (CTL time constant 42 days, ATL time constant 7 days).
export function computeLoadSeries(userId, daysBack = 180) {
  // start_date is stored as a UTC instant (from Strava); bucket it to the calendar day
  // it happened *in the athlete's local timezone*, not UTC's, so a late-evening ride
  // doesn't get counted against the wrong day.
  const rows = db.prepare(
    `SELECT date(start_date, 'localtime') as d, SUM(tss_estimate) as tss FROM activities
     WHERE user_id = ? AND start_date >= date('now', 'localtime', ?) GROUP BY date(start_date, 'localtime') ORDER BY d ASC`
  ).all(userId, `-${daysBack} days`);
  const byDate = new Map(rows.map((r) => [r.d, r.tss || 0]));

  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  let ctl = 0;
  let atl = 0;
  const series = [];
  for (let i = 0; i <= daysBack; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = localDateStr(d);
    const tss = byDate.get(key) || 0;
    ctl = ctl + (tss - ctl) / 42;
    atl = atl + (tss - atl) / 7;
    series.push({ date: key, tss, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb: Math.round((ctl - atl) * 10) / 10 });
  }
  return series;
}

export function getCurrentLoad(userId) {
  const series = computeLoadSeries(userId, 120);
  return series[series.length - 1] || { ctl: 0, atl: 0, tsb: 0 };
}

function todayIso() {
  return todayStr();
}

export function computeWeekCompliance(plan, weekNumber, userId) {
  const weekWorkouts = plan.workouts.filter((w) => w.week_number === weekNumber && w.workout_key !== 'rest');
  const planned = weekWorkouts.reduce((s, w) => s + (w.planned_tss || 0), 0);
  if (planned === 0) return 1;
  const achieved = weekWorkouts.reduce((s, w) => {
    if (w.status !== 'completed' || !w.matched_activity_id) return s;
    const act = db.prepare('SELECT tss_estimate FROM activities WHERE id = ? AND user_id = ?').get(w.matched_activity_id, userId);
    return s + Math.min(w.planned_tss * 1.3, act?.tss_estimate || 0);
  }, 0);
  return Math.round((achieved / planned) * 100) / 100;
}

// Looks at the most recently completed week and nudges the *upcoming* week's volume up
// or down based on compliance and current form (TSB), so the plan responds to what you
// actually did on the bike rather than blindly marching forward. `reason` strings are
// resolved through i18n/translations.js so the same stored `adapted_from` key renders
// correctly no matter which language the athlete is viewing in later.
export function adaptUpcomingWeek(planId, lang = DEFAULT_LANG, userId) {
  const plan = getPlan(planId, lang, userId);
  if (!plan) return null;
  const today = todayIso();

  const weekNumbers = [...new Set(plan.workouts.map((w) => w.week_number))].sort((a, b) => a - b);
  let lastCompletedWeek = null;
  for (const wn of weekNumbers) {
    const weekWorkouts = plan.workouts.filter((w) => w.week_number === wn);
    const lastDay = weekWorkouts[weekWorkouts.length - 1]?.day_date;
    if (lastDay && lastDay < today) lastCompletedWeek = wn;
  }
  if (lastCompletedWeek === null) return { message: tAdaptMessage(lang, 'noCompletedWeek') };
  const nextWeek = lastCompletedWeek + 1;
  const nextWeekWorkouts = plan.workouts.filter((w) => w.week_number === nextWeek);
  if (nextWeekWorkouts.length === 0) return { message: tAdaptMessage(lang, 'planComplete') };
  if (nextWeekWorkouts.some((w) => w.adapted_from)) {
    return { message: tAdaptMessage(lang, 'alreadyAdapted', { week: nextWeek }), skipped: true };
  }

  const compliance = computeWeekCompliance(plan, lastCompletedWeek, userId);
  const { tsb } = getCurrentLoad(userId);

  let factor = 1.0;
  const pct = Math.round(compliance * 100);
  let reason = tAdaptReason(lang, 'onTarget');
  if (compliance < 0.5) {
    factor = 0.75;
    reason = tAdaptReason(lang, 'lowCompliance', { pct });
  } else if (compliance < 0.75) {
    factor = 0.9;
    reason = tAdaptReason(lang, 'partialCompliance', { pct });
  } else if (compliance >= 0.95 && tsb > -10) {
    factor = 1.08;
    reason = tAdaptReason(lang, 'strongCompliance', { pct });
  }
  if (tsb < -25) {
    factor = Math.min(factor, 0.85);
    reason += tAdaptReason(lang, 'fatigueCap');
  }
  factor = Math.min(1.25, Math.max(0.6, factor));

  const update = db.prepare(
    `UPDATE plan_workouts SET structure_json = ?, planned_tss = ?, planned_duration_min = ?, adapted_from = ? WHERE id = ?`
  );
  for (const w of nextWeekWorkouts) {
    if (w.workout_key === 'rest' || w.structure.length === 0) continue;
    const scaled = w.structure.map((s) => ({ ...s, minutes: Math.max(1, Math.round(s.minutes * factor)) }));
    const plannedTss = Math.round(
      scaled.reduce((sum, s) => sum + (s.minutes / 60) * ((s.ifLow + s.ifHigh) / 2) ** 2 * 100, 0)
    );
    const plannedMin = Math.round(scaled.reduce((sum, s) => sum + s.minutes, 0));
    update.run(JSON.stringify(scaled), plannedTss, plannedMin, reason, w.id);
  }

  return { adaptedWeek: nextWeek, compliance, tsb, factor, reason };
}

// --- Confirm-first mid-week mismatch adjustment -----------------------------------
// Triggered by the athlete tapping "yes" on the prompt that appears when a logged
// ride is way outside what that day's session called for (see
// training/mismatch.js for the thresholds, and autoMatchActivities in
// planEngine.js for where the pending flag gets set). Scales the *remaining*
// not-yet-happened days of that same week — never past/completed ones — using the
// same kind of factor as adaptUpcomingWeek, so a big blowout eases the rest of the
// week and a big shortfall trims it slightly rather than piling more on.
export function applyMismatchAdjustment(workoutId, lang = DEFAULT_LANG, userId) {
  const trigger = db.prepare(
    `SELECT pw.* FROM plan_workouts pw JOIN plans p ON p.id = pw.plan_id WHERE pw.id = ? AND p.user_id = ?`
  ).get(workoutId, userId);
  if (!trigger) return null;
  if (trigger.mismatch_status !== 'pending') {
    return { skipped: true, reason: tAdaptMessage(lang, 'alreadyAdapted', { week: trigger.week_number }) };
  }

  const remaining = db.prepare(
    `SELECT * FROM plan_workouts WHERE plan_id = ? AND week_number = ? AND day_date > ? AND status = 'planned'`
  ).all(trigger.plan_id, trigger.week_number, trigger.day_date);

  const { tsb } = getCurrentLoad(userId);
  let factor = trigger.mismatch_direction === 'over' ? 0.85 : 0.9;
  let reason = tMismatchReason(lang, trigger.mismatch_direction === 'over' ? 'overshoot' : 'undershoot');
  if (tsb < -25) {
    factor = Math.min(factor, 0.85);
    reason += tAdaptReason(lang, 'fatigueCap');
  }

  const update = db.prepare(
    `UPDATE plan_workouts SET structure_json = ?, planned_tss = ?, planned_duration_min = ?, adapted_from = ? WHERE id = ?`
  );
  let adjusted = 0;
  for (const w of remaining) {
    const structure = JSON.parse(w.structure_json || '[]');
    if (w.workout_key === 'rest' || structure.length === 0) continue;
    const scaled = structure.map((s) => ({ ...s, minutes: Math.max(1, Math.round(s.minutes * factor)) }));
    const plannedTss = Math.round(
      scaled.reduce((sum, s) => sum + (s.minutes / 60) * ((s.ifLow + s.ifHigh) / 2) ** 2 * 100, 0)
    );
    const plannedMin = Math.round(scaled.reduce((sum, s) => sum + s.minutes, 0));
    update.run(JSON.stringify(scaled), plannedTss, plannedMin, reason, w.id);
    adjusted++;
  }

  db.prepare(`UPDATE plan_workouts SET mismatch_status = 'applied' WHERE id = ?`).run(workoutId);
  return { adjusted, factor, reason };
}

export function dismissMismatch(workoutId, userId) {
  const owned = db.prepare(
    `SELECT pw.id FROM plan_workouts pw JOIN plans p ON p.id = pw.plan_id WHERE pw.id = ? AND p.user_id = ?`
  ).get(workoutId, userId);
  if (!owned) return false;
  db.prepare(`UPDATE plan_workouts SET mismatch_status = 'dismissed' WHERE id = ?`).run(workoutId);
  return true;
}
