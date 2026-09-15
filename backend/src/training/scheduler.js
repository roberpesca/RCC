// Turns a week's list of prescribed sessions into concrete calendar dates, respecting
// which days the athlete is actually available to train.
//
// Design choice that matters: when every day of a week is available, callers should
// keep the program author's original day-by-day order instead of running the
// heuristic below — that keeps behaviour for anyone who hasn't restricted their
// availability byte-for-byte identical to before this feature existed. The
// layoutOntoDates() function here is only invoked when a week is actually
// constrained (fewer available days than prescribed sessions, or specific days
// forced on/off), by planEngine.js (new plans) and reschedule() below (existing
// plans reacting to an availability change).
import { db, getProfile } from '../db.js';
import { todayStr } from '../shared/dates.js';

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

// Reflows every not-yet-happened, not-yet-completed week of the athlete's active plan
// against their current availability. Called whenever the standing weekly pattern
// changes (Settings) or a one-off day gets blocked/unblocked (Training tab). A week
// where every remaining day is still available is left completely untouched — this
// only ever moves things when something actually needs to move.
//
// Known simplification: a session dropped because a day became unavailable turns
// into plain rest and stays that way even if the day later becomes available again
// (we don't resurrect it) — regaining a day just gives extra recovery going forward.
export function rescheduleActivePlan(userId) {
  const plan = db.prepare(`SELECT * FROM plans WHERE status = 'active' AND user_id = ? ORDER BY id DESC LIMIT 1`).get(userId);
  if (!plan) return { changed: 0, noActivePlan: true };

  const profile = getProfile(userId);
  const weekdaySet = new Set(getAvailableWeekdays(profile));
  const today = todayStr();

  const rows = db.prepare('SELECT * FROM plan_workouts WHERE plan_id = ? ORDER BY day_date ASC').all(plan.id);
  const byWeek = new Map();
  for (const r of rows) {
    if (!byWeek.has(r.week_number)) byWeek.set(r.week_number, []);
    byWeek.get(r.week_number).push(r);
  }

  const update = db.prepare(
    `UPDATE plan_workouts SET workout_key = ?, structure_json = ?, planned_tss = ?, planned_duration_min = ?, adapted_from = ?, status = 'planned', matched_activity_id = NULL WHERE id = ?`
  );

  let changed = 0;
  db.exec('BEGIN');
  try {
    for (const weekRows of byWeek.values()) {
      const open = weekRows.filter((r) => r.status === 'planned' && r.day_date >= today);
      if (open.length === 0) continue;

      const openDates = open.map((r) => r.day_date);
      const availableDates = openDates.filter((d) => isDateAvailable(userId, d, weekdaySet));
      if (availableDates.length === openDates.length) continue; // nothing blocked this week — no-op

      const sessions = open
        .filter((r) => r.workout_key && r.workout_key !== 'rest')
        .map((r) => ({
          workout_key: r.workout_key,
          structure_json: r.structure_json,
          planned_tss: r.planned_tss,
          planned_duration_min: r.planned_duration_min,
          adapted_from: r.adapted_from,
        }));

      const layout = layoutOntoDates(sessions, availableDates);
      const byDate = new Map(open.map((r) => [r.day_date, r]));

      for (const d of openDates) {
        const row = byDate.get(d);
        const session = layout.has(d) ? layout.get(d) : null;
        if (session) {
          update.run(session.workout_key, session.structure_json, session.planned_tss, session.planned_duration_min, session.adapted_from ?? null, row.id);
        } else {
          update.run('rest', JSON.stringify([]), 0, 0, null, row.id);
        }
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
