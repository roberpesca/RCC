import { db, getProfile } from '../db.js';
import { getProgram } from './programs.js';
import { WORKOUTS, estimateWorkoutTss, estimateWorkoutMinutes } from './workoutLibrary.js';
import { DEFAULT_LANG, tProgram, tPhase, tWorkout, tSegmentNote } from '../i18n/translations.js';
import { localDateStr, addDays } from '../shared/dates.js';
import { getAvailableWeekdays, isDateAvailable, layoutOntoDates } from './scheduler.js';
import { classifyMismatch } from './mismatch.js';

const REFERENCE_WEEKLY_MINUTES = 8 * 60; // programs are authored assuming ~8h/week riders

const iso = localDateStr;

function buildWeekSequence(program, totalWeeks) {
  const counts = program.phases.map((p) => Math.round(p.weeksFraction * totalWeeks));
  let diff = totalWeeks - counts.reduce((a, b) => a + b, 0);
  counts[counts.length - 1] += diff; // absorb rounding error in the final phase
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

// Workouts/plans are stored with only neutral keys (workout_key, phase key, program_id) —
// title/description/program name are resolved from i18n/translations.js at read time
// (see decorateWorkout / decoratePlan below), so switching languages works retroactively
// on plans that already exist, with no need to regenerate anything.
export function generatePlan({ userId, programId, startDate, weeks, weeklyHoursAvailable, ftp }) {
  const program = getProgram(programId);
  if (!program) throw new Error(`Unknown program: ${programId}`);
  const totalWeeks = weeks || program.defaultWeeks;
  // Day 1 of the plan is exactly the date the athlete chose — no snapping to the
  // nearest Monday, which used to silently pull the start backward (or leave it
  // stuck on the current week) whenever the chosen date fell within this week.
  const start = new Date(startDate + 'T00:00:00');
  const weekSeq = buildWeekSequence(program, totalWeeks);

  // Figure out a scale factor so the plan respects the athlete's real available hours,
  // relative to the ~8h/week baseline the programs are authored against.
  const baselineWeeklyMinutes = program.phases[0].pattern.reduce((sum, key) => {
    const w = WORKOUTS[key];
    return sum + (w ? estimateWorkoutMinutes(w.structure) : 0);
  }, 0);
  const targetWeeklyMinutes = (weeklyHoursAvailable || 8) * 60;
  const hoursScale = Math.min(1.4, Math.max(0.6, targetWeeklyMinutes / (baselineWeeklyMinutes || targetWeeklyMinutes)));

  const profile = getProfile(userId);
  const weekdaySet = new Set(getAvailableWeekdays(profile));

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE plans SET status = 'archived' WHERE status = 'active' AND user_id = ?`).run(userId);
    const planInfo = db.prepare(
      `INSERT INTO plans (user_id, program_id, program_name, start_date, weeks, base_ftp) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, program.id, program.id, iso(start), totalWeeks, ftp || null);
    const planId = planInfo.lastInsertRowid;

    const insertWorkout = db.prepare(`
      INSERT INTO plan_workouts (plan_id, week_number, phase, day_date, workout_key, structure_json, planned_tss, planned_duration_min)
      VALUES (@plan_id, @week_number, @phase, @day_date, @workout_key, @structure_json, @planned_tss, @planned_duration_min)
    `);

    weekSeq.forEach((weekInfo, weekIdx) => {
      const isStepBack = weekIdx > 0 && (weekIdx + 1) % 4 === 0;
      // Progressive overload within a phase, capped, and blunted on step-back weeks.
      const progression = isStepBack
        ? 0.65
        : Math.min(1.25, 1 + 0.06 * weekInfo.weekInPhase);

      const factor = progression * hoursScale;
      const weekDates = Array.from({ length: 7 }, (_, dayIdx) => iso(addDays(start, weekIdx * 7 + dayIdx)));
      const restRow = () => ({ workout_key: 'rest', structure_json: JSON.stringify([]), planned_tss: 0, planned_duration_min: 0 });
      const sessionRow = (workoutKey) => {
        const def = WORKOUTS[workoutKey];
        if (!def || def.structure.length === 0) return restRow();
        const structure = scaleStructure(def.structure, factor);
        return {
          workout_key: workoutKey,
          structure_json: JSON.stringify(structure),
          planned_tss: estimateWorkoutTss(structure),
          planned_duration_min: estimateWorkoutMinutes(structure),
        };
      };

      const allDaysAvailable = weekDates.every((d) => isDateAvailable(userId, d, weekdaySet));

      if (allDaysAvailable) {
        // Unconstrained week: keep the program author's exact original day-by-day
        // order (this is also what every plan looked like before availability
        // existed as a concept, so nothing changes for anyone who hasn't set it up).
        weekInfo.pattern.forEach((workoutKey, dayIdx) => {
          const row = workoutKey === 'rest' ? restRow() : sessionRow(workoutKey);
          insertWorkout.run({ plan_id: planId, week_number: weekIdx + 1, phase: weekInfo.phase, day_date: weekDates[dayIdx], ...row });
        });
      } else {
        // Constrained week: lay the program's prescribed non-rest sessions onto
        // whichever days are actually available, dropping the least important ones
        // first if there isn't room for all of them.
        const sessions = weekInfo.pattern.filter((k) => k !== 'rest').map((k) => sessionRow(k));
        const availableDates = weekDates.filter((d) => isDateAvailable(userId, d, weekdaySet));
        const layout = layoutOntoDates(sessions, availableDates);
        weekDates.forEach((d) => {
          const session = layout.has(d) ? layout.get(d) : null;
          const row = session || restRow();
          insertWorkout.run({ plan_id: planId, week_number: weekIdx + 1, phase: weekInfo.phase, day_date: d, ...row });
        });
      }
    });

    db.exec('COMMIT');
    return getPlan(planId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function decorateWorkout(w, lang) {
  const text = tWorkout(w.workout_key, lang);
  const structure = JSON.parse(w.structure_json || '[]').map((s) => ({
    ...s,
    noteText: tSegmentNote(s.note, lang),
  }));
  return {
    ...w,
    title: text.title,
    description: text.description,
    purpose: text.purpose,
    coachTip: text.coachTip,
    indoorTip: text.indoorTip,
    outdoorTip: text.outdoorTip,
    phaseLabel: tPhase(w.phase, lang),
    structure,
  };
}

function decoratePlan(plan, lang) {
  if (!plan) return plan;
  const programText = tProgram(plan.program_id, lang);
  return {
    ...plan,
    program_name: programText.name,
    program_tagline: programText.tagline,
    workouts: plan.workouts.map((w) => decorateWorkout(w, lang)),
  };
}

export function getActivePlan(userId, lang = DEFAULT_LANG) {
  const plan = db.prepare(`SELECT * FROM plans WHERE status = 'active' AND user_id = ? ORDER BY id DESC LIMIT 1`).get(userId);
  if (!plan) return null;
  return getPlan(plan.id, lang, userId);
}

// `userId`, when passed, enforces ownership — routes that take a plan id straight from
// the URL (GET /plan/:id, POST /plan/:id/adapt) must pass it so one athlete can't view
// or mutate another athlete's plan by guessing/incrementing an id.
export function getPlan(planId, lang = DEFAULT_LANG, userId = null) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return null;
  if (userId != null && plan.user_id !== userId) return null;
  const workouts = db.prepare('SELECT * FROM plan_workouts WHERE plan_id = ? ORDER BY day_date ASC').all(planId);
  // Availability is looked up from the plan's own owner (plan.user_id), independent
  // of the `userId` ownership-check param above, so this works even from call sites
  // that don't have that param handy.
  const weekdaySet = new Set(getAvailableWeekdays(getProfile(plan.user_id)));
  const raw = {
    ...plan,
    workouts: workouts.map((w) => ({
      ...w,
      structure: JSON.parse(w.structure_json || '[]'),
      dayAvailable: isDateAvailable(plan.user_id, w.day_date, weekdaySet),
    })),
  };
  return decoratePlan(raw, lang);
}

// Ownership check by join, since plan_workouts itself carries no user_id.
export function markWorkoutStatus(workoutId, status, matchedActivityId, userId) {
  const owned = db.prepare(
    `SELECT pw.id FROM plan_workouts pw JOIN plans p ON p.id = pw.plan_id WHERE pw.id = ? AND p.user_id = ?`
  ).get(workoutId, userId);
  if (!owned) return false;
  db.prepare('UPDATE plan_workouts SET status = ?, matched_activity_id = ? WHERE id = ?').run(status, matchedActivityId ?? null, workoutId);
  return true;
}

// Match completed Strava rides to planned workouts on the same date, so the dashboard
// and adaptation logic know what actually happened vs. what was planned.
export function autoMatchActivities(planId, userId) {
  const plan = getPlan(planId, DEFAULT_LANG, userId);
  if (!plan) return;
  const activitiesByDate = new Map();
  const activities = db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY start_date ASC').all(userId);
  for (const a of activities) {
    // start_date is a UTC instant; match it to the calendar day it happened on in the
    // athlete's local timezone (not UTC's), so late-evening rides land on the right day.
    const date = a.start_date ? iso(new Date(a.start_date)) : null;
    if (!date) continue;
    if (!activitiesByDate.has(date)) activitiesByDate.set(date, []);
    activitiesByDate.get(date).push(a);
  }
  const today = iso(new Date());
  for (const w of plan.workouts) {
    if (w.workout_key === 'rest') continue;
    const candidates = activitiesByDate.get(w.day_date) || [];
    if (candidates.length > 0 && w.status === 'planned') {
      const match = candidates.sort((a, b) => (b.tss_estimate || 0) - (a.tss_estimate || 0))[0];
      markWorkoutStatus(w.id, 'completed', match.id, userId);
      // Confirm-first prompt: only ever set the first time a workout is matched
      // (mismatch_status IS NULL guard), so re-opening the app doesn't re-flag
      // something already answered, and doesn't overwrite an already-pending one.
      const direction = classifyMismatch(w.planned_tss, match.tss_estimate);
      if (direction) {
        db.prepare(
          `UPDATE plan_workouts SET mismatch_status = 'pending', mismatch_direction = ? WHERE id = ? AND mismatch_status IS NULL`
        ).run(direction, w.id);
      }
    } else if (w.status === 'planned' && w.day_date < today) {
      markWorkoutStatus(w.id, 'missed', null, userId);
    }
  }
}
