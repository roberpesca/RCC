// Turns a week's list of prescribed sessions into concrete calendar dates, respecting
// which days the athlete is actually available to train.
//
// Design choice that matters: when every day of a week is available, callers should
// keep the program author's original day-by-day order instead of running the
// heuristic below — that keeps behaviour for anyone who hasn't restricted their
// availability byte-for-byte identical to before this feature existed. The
// layoutOntoDates() function here is only invoked when a week is actually
// constrained (fewer available days than prescribed sessions, or specific days
// forced on/off), by planEngine.js (new plans) and proposeReschedule() below
// (existing plans reacting to an availability change).
import { db, getProfile } from '../db.js';
import { todayStr } from '../shared/dates.js';
import { getProgram } from './programs.js';
import { WORKOUTS, estimateWorkoutTss, estimateWorkoutMinutes } from './workoutLibrary.js';

// Athlete-facing day numbering is Mon=0 .. Sun=6 (matches the weekday picker in
// Settings/Onboarding), not JS's native Sun=0 .. Sat=6.
export function weekdayIndex(date) {
  const jsDay = date.getDay();
  return (jsDay + 6) % 7;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function getAvailableWeekdays(profile) {
  if (!profile || !profile.available_days) return ALL_DAYS;
  try {
    const arr = JSON.parse(profile.available_days);
    if (Array.isArray(arr) && arr.length > 0) return arr;
  } catch {
    // malformed value — fall back to "every day available" rather than error out
  }
  return ALL_DAYS;
}

export function getOverride(userId, dateStr) {
  return db.prepare('SELECT available FROM availability_overrides WHERE user_id = ? AND date = ?').get(userId, dateStr);
}

export function setOverride(userId, dateStr, available) {
  db.prepare(
    `INSERT INTO availability_overrides (user_id, date, available) VALUES (?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET available = excluded.available`
  ).run(userId, dateStr, available ? 1 : 0);
}

export function clearOverride(userId, dateStr) {
  db.prepare('DELETE FROM availability_overrides WHERE user_id = ? AND date = ?').run(userId, dateStr);
}

// weekdaySet: a Set of the standing-pattern weekday ints (see getAvailableWeekdays).
// A one-off override for this specific date, if any, always wins over the pattern.
export function isDateAvailable(userId, dateStr, weekdaySet) {
  const override = getOverride(userId, dateStr);
  if (override) return !!override.available;
  const date = new Date(dateStr + 'T00:00:00');
  return weekdaySet.has(weekdayIndex(date));
}

// --- Intensity / priority classification ------------------------------------
// Only used when a week doesn't fit on the available days as-is: decides which
// sessions get dropped first (lowest weight goes first — recovery spins are the
// most disposable, the long ride is kept until there's truly no room for it) and
// how to spread the ones that remain so two hard efforts don't land back to back.
const WEIGHT = {
  recovery_spin: 1,
  endurance_z2: 2,
  tempo: 2,
  sweet_spot: 3,
  climbing_repeats: 3,
  threshold: 4,
  over_unders: 4,
  vo2max: 4,
  anaerobic_repeats: 4,
  ftp_test: 4,
  long_endurance: 5,
};
function weightOf(key) {
  return WEIGHT[key] ?? 2;
}

function dayGap(dateA, dateB) {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round((a - b) / 86400000);
}

// sessions: [{ workout_key, structure_json, planned_tss, planned_duration_min, adapted_from? }]
// dates: available date strings (any order) for this week.
// Returns a Map<dateString, session|null> — null means the date becomes explicit rest.
// Never invents a session that wasn't already in `sessions`: if there are more
// available dates than sessions, the extras are just rest (more recovery, which is
// always safe), and if there are fewer, the lowest-priority sessions are dropped.
export function layoutOntoDates(sessions, dates) {
  const sortedDates = [...dates].sort();
  const result = new Map(sortedDates.map((d) => [d, null]));
  if (sortedDates.length === 0 || sessions.length === 0) return result;

  let pool = sessions;
  if (pool.length > sortedDates.length) {
    pool = pool
      .map((s, idx) => ({ s, idx }))
      .sort((a, b) => (weightOf(b.s.workout_key) - weightOf(a.s.workout_key)) || (a.idx - b.idx))
      .slice(0, sortedDates.length)
      .sort((a, b) => a.idx - b.idx)
      .map(({ s }) => s);
  }

  const placed = new Array(sortedDates.length).fill(null);
  const usedSlots = new Set();

  // The long ride goes on the last available day of the week — the closest thing
  // to "the weekend" we can infer without knowing the athlete's actual schedule.
  const longIdx = pool.findIndex((s) => s.workout_key === 'long_endurance');
  if (longIdx !== -1) {
    const slot = sortedDates.length - 1;
    placed[slot] = pool[longIdx];
    usedSlots.add(slot);
  }

  // Everything else, hardest first, each placed on whichever remaining slot
  // maximizes its distance (in days) from every slot already used.
  const remaining = pool.filter((_, i) => i !== longIdx).sort((a, b) => weightOf(b.workout_key) - weightOf(a.workout_key));
  for (const session of remaining) {
    let bestSlot = -1;
    let bestScore = -1;
    for (let i = 0; i < sortedDates.length; i++) {
      if (usedSlots.has(i)) continue;
      const score = usedSlots.size === 0 ? 0 : Math.min(...[...usedSlots].map((j) => Math.abs(dayGap(sortedDates[i], sortedDates[j]))));
      if (score > bestScore) {
        bestScore = score;
        bestSlot = i;
      }
    }
    if (bestSlot === -1) break; // can't happen — pool.length <= sortedDates.length
    placed[bestSlot] = session;
    usedSlots.add(bestSlot);
  }

  sortedDates.forEach((d, i) => result.set(d, placed[i]));
  return result;
}

// --- Original-template reconstruction ---------------------------------------
// Mirrors planEngine.js's generatePlan() phase/week/scaling math, but only to answer
// "what would this specific day have been, ignoring availability entirely?" — used
// below so a session that got dropped to rest because a day was unavailable can be
// restored once that day (or another) opens back up, instead of staying rest forever.
function buildWeekSequence(program, totalWeeks) {
  const counts = program.phases.map((p) => Math.round(p.weeksFraction * totalWeeks));
  let diff = totalWeeks - counts.reduce((a, b) => a + b, 0);
  counts[counts.length - 1] += diff;
  const sequence = [];
  program.phases.forEach((phase, pIdx) => {
    for (let w = 0; w < counts[pIdx]; w++) {
      sequence.push({ phase: phase.name, pattern: phase.pattern, weekInPhase: w, weeksInPhase: counts[pIdx] });
    }
  });
  return sequence;
}

function scaleStructure(structure, factor) {
  return structure.map((s) => ({ ...s, minutes: Math.max(1, Math.round(s.minutes * factor)) }));
}

function computeHoursScale(program, weeklyHoursAvailable) {
  const baselineWeeklyMinutes = program.phases[0].pattern.reduce((sum, key) => {
    const w = WORKOUTS[key];
    return sum + (w ? estimateWorkoutMinutes(w.structure) : 0);
  }, 0);
  const targetWeeklyMinutes = (weeklyHoursAvailable || 8) * 60;
  return Math.min(1.4, Math.max(0.6, targetWeeklyMinutes / (baselineWeeklyMinutes || targetWeeklyMinutes)));
}

function buildSessionRow(workoutKey, factor) {
  const def = WORKOUTS[workoutKey];
  if (!def || def.structure.length === 0) return null;
  const structure = scaleStructure(def.structure, factor);
  return {
    workout_key: workoutKey,
    structure_json: JSON.stringify(structure),
    planned_tss: estimateWorkoutTss(structure),
    planned_duration_min: estimateWorkoutMinutes(structure),
    adapted_from: null,
  };
}

// Returns { keys, factor } for a given week number: `keys` is the program's full list
// of non-rest workout keys prescribed for that week (with multiplicity — a week can
// legitimately call for the same key twice), `factor` is the duration/TSS scale that
// week would be built at today. Deliberately NOT tied to a specific day-of-week slot:
// a constrained week never had a fixed day<->session mapping in the first place (it
// was laid out by layoutOntoDates, which repositions freely), so the only thing that
// generalizes across both an originally-unconstrained week and an originally-
// constrained one is "which sessions does the template call for this week", not
// "what belongs on day N specifically".
function templateForWeek(program, totalWeeks, weekNumber, hoursScale) {
  const weekSeq = buildWeekSequence(program, totalWeeks);
  const weekIdx = weekNumber - 1;
  const weekInfo = weekSeq[weekIdx];
  if (!weekInfo) return { keys: [], factor: hoursScale };
  const isStepBack = weekIdx > 0 && (weekIdx + 1) % 4 === 0;
  const progression = isStepBack ? 0.65 : Math.min(1.25, 1 + 0.06 * weekInfo.weekInPhase);
  return { keys: weekInfo.pattern.filter((k) => k !== 'rest'), factor: progression * hoursScale };
}

// Given a week's prescribed session keys and every non-rest row that already exists
// somewhere in that week (whether open, completed, or in the past), returns the
// keys with no corresponding row left anywhere — i.e. sessions that were dropped by
// an earlier constrained reschedule and never came back. Matches by key identity
// (not day position, and not adaptation state), consuming one prescribed slot per
// existing row so a week that legitimately calls for the same key twice isn't
// treated as "one is missing" just because only one row currently has that key.
function missingTemplateKeys(templateKeys, weekRows) {
  const remaining = [...templateKeys];
  for (const r of weekRows) {
    if (!r.workout_key || r.workout_key === 'rest') continue;
    const idx = remaining.indexOf(r.workout_key);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return remaining;
}

// --- Confirm-first reschedule proposal ---------------------------------------
// Recomputes every not-yet-happened, not-yet-completed week of the athlete's active
// plan against their current availability, and stores what WOULD change without
// touching plan_workouts yet — the athlete has to explicitly apply it (or dismiss
// it) via the endpoints below, mirroring the mid-week TSS-mismatch confirm prompt.
// A week where every remaining day is still available is left completely alone.
//
// Unlike the old (pre-confirm) version, the pool of sessions considered for a
// constrained week is NOT just "whatever isn't currently rest" — it also includes,
// for any day currently sitting at rest, what the original program template would
// have put there. That's what lets a previously-dropped session come back once its
// day (or another day that week) becomes available again, instead of staying rest
// forever (the old, documented limitation).
export function proposeReschedule(userId) {
  const plan = db.prepare(`SELECT * FROM plans WHERE status = 'active' AND user_id = ? ORDER BY id DESC LIMIT 1`).get(userId);
  if (!plan) return { changed: 0, noActivePlan: true };

  const profile = getProfile(userId);
  const weekdaySet = new Set(getAvailableWeekdays(profile));
  const today = todayStr();
  const program = getProgram(plan.program_id);
  const hoursScale = program ? computeHoursScale(program, profile?.weekly_hours_available) : 1;

  const rows = db.prepare('SELECT * FROM plan_workouts WHERE plan_id = ? ORDER BY day_date ASC').all(plan.id);
  const byWeek = new Map();
  for (const r of rows) {
    if (!byWeek.has(r.week_number)) byWeek.set(r.week_number, []);
    byWeek.get(r.week_number).push(r);
  }

  let changed = 0;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM pending_reschedule WHERE plan_id = ?').run(plan.id);
    const insertPending = db.prepare(
      `INSERT INTO pending_reschedule (plan_id, workout_id, day_date, workout_key, structure_json, planned_tss, planned_duration_min, adapted_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const [weekNumber, weekRows] of byWeek.entries()) {
      const open = weekRows.filter((r) => r.status === 'planned' && r.day_date >= today);
      if (open.length === 0) continue;

      const openDates = open.map((r) => r.day_date);
      const availableDates = openDates.filter((d) => isDateAvailable(userId, d, weekdaySet));

      // Live (non-rest, open) sessions keep whatever they currently are — including
      // any prior adaptation — so a legitimate mid-week adjustment never gets
      // clobbered. Anything the program's template calls for this week that has no
      // corresponding row anywhere (open, completed, or past) was dropped by an
      // earlier constrained reschedule and gets reconstructed fresh — that's the
      // "restore" path, and it's what lets a previously-dropped session come back
      // once there's room for it again, instead of staying rest forever.
      let missing = [];
      if (program) {
        const { keys, factor } = templateForWeek(program, plan.weeks, weekNumber, hoursScale);
        missing = missingTemplateKeys(keys, weekRows)
          .map((key) => buildSessionRow(key, factor))
          .filter(Boolean);
      }

      const liveOpenNonRest = open
        .filter((r) => r.workout_key && r.workout_key !== 'rest')
        .map((r) => ({
          workout_key: r.workout_key,
          structure_json: r.structure_json,
          planned_tss: r.planned_tss,
          planned_duration_min: r.planned_duration_min,
          adapted_from: r.adapted_from,
        }));

      const sessions = liveOpenNonRest.concat(missing);

      // Nothing blocked and nothing to restore this week — skip it entirely.
      if (availableDates.length === openDates.length && missing.length === 0) {
        continue;
      }

      const layout = layoutOntoDates(sessions, availableDates);
      const byDate = new Map(open.map((r) => [r.day_date, r]));

      for (const d of openDates) {
        const row = byDate.get(d);
        const session = layout.has(d) ? layout.get(d) : null;
        const newKey = session ? session.workout_key : 'rest';
        const newStructure = session ? session.structure_json : JSON.stringify([]);
        const newTss = session ? session.planned_tss : 0;
        const newDur = session ? session.planned_duration_min : 0;
        const newAdapted = session ? session.adapted_from ?? null : null;

        const isNoOp = row.workout_key === newKey && Number(row.planned_tss) === Number(newTss) && row.structure_json === newStructure;
        if (isNoOp) continue;

        insertPending.run(plan.id, row.id, d, newKey, newStructure, newTss, newDur, newAdapted);
        changed++;
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { changed, planId: plan.id };
}

// Rows currently proposed for a plan, joined with each workout's present values so
// callers (the API / UI) can show a clear "from -> to" summary before the athlete
// decides whether to apply.
export function getPendingReschedule(planId) {
  return db
    .prepare(
      `SELECT p.id, p.workout_id, p.day_date, p.workout_key AS new_workout_key, p.planned_tss AS new_planned_tss,
              w.workout_key AS current_workout_key, w.planned_tss AS current_planned_tss
       FROM pending_reschedule p JOIN plan_workouts w ON w.id = p.workout_id
       WHERE p.plan_id = ? ORDER BY p.day_date ASC`
    )
    .all(planId);
}

export function applyPendingReschedule(userId) {
  const plan = db.prepare(`SELECT * FROM plans WHERE status = 'active' AND user_id = ? ORDER BY id DESC LIMIT 1`).get(userId);
  if (!plan) return { applied: 0, noActivePlan: true };

  const rows = db.prepare('SELECT * FROM pending_reschedule WHERE plan_id = ?').all(plan.id);
  const update = db.prepare(
    `UPDATE plan_workouts SET workout_key = ?, structure_json = ?, planned_tss = ?, planned_duration_min = ?, adapted_from = ?, status = 'planned', matched_activity_id = NULL WHERE id = ?`
  );

  db.exec('BEGIN');
  try {
    for (const r of rows) {
      update.run(r.workout_key, r.structure_json, r.planned_tss, r.planned_duration_min, r.adapted_from, r.workout_id);
    }
    db.prepare('DELETE FROM pending_reschedule WHERE plan_id = ?').run(plan.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { applied: rows.length, planId: plan.id };
}

export function dismissPendingReschedule(userId) {
  const plan = db.prepare(`SELECT id FROM plans WHERE status = 'active' AND user_id = ? ORDER BY id DESC LIMIT 1`).get(userId);
  if (!plan) return { dismissed: 0, noActivePlan: true };
  const info = db.prepare('DELETE FROM pending_reschedule WHERE plan_id = ?').run(plan.id);
  return { dismissed: info.changes, planId: plan.id };
}
