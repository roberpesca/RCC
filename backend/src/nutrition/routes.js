import { Router } from 'express';
import { db, getProfile } from '../db.js';
import { getActivePlan } from '../training/planEngine.js';
import { getLang, tDayType, tMealSlot } from '../i18n/translations.js';
import { localDateStr, todayStr, addDays } from '../shared/dates.js';
import {
  classifyDayType,
  computeDailyTargets,
  computeAdaptiveAdjustment,
  estimateRideCalories,
  fuelingGuidance,
  suggestMenus,
} from './engine.js';

function withSlotLabels(menus, lang) {
  return menus.map((m) => ({
    ...m,
    meals: Object.fromEntries(
      Object.entries(m.meals).map(([slot, meal]) => [slot, { ...meal, slotLabel: tMealSlot(slot, lang) }])
    ),
  }));
}

// Shared by /today and /week: turns a (possibly absent) plan workout into a full
// nutrition payload for that day — targets, fueling, and two suggested menus. Future
// days use the *planned* TSS/duration (there's no ride data yet), which is exactly what
// /today already did for the current day, so this just generalizes that to any date.
function buildDayPayload(workout, profile, adaptive, lang) {
  const dayType = classifyDayType(workout);
  const rideCalories = workout && workout.workout_key !== 'rest'
    ? estimateRideCalories({ tss: workout.planned_tss, ftp: profile.ftp_watts, durationMin: workout.planned_duration_min })
    : 0;
  const targets = computeDailyTargets({ profile, dayType, rideCalories, calorieAdjustment: adaptive.adjustment });
  const fueling = fuelingGuidance(workout, lang);
  const menus = withSlotLabels(suggestMenus(dayType, targets.calories, lang), lang);
  return {
    workout: workout
      ? {
          id: workout.id,
          day_date: workout.day_date,
          workout_key: workout.workout_key,
          title: workout.title,
          planned_tss: workout.planned_tss,
          planned_duration_min: workout.planned_duration_min,
        }
      : null,
    targets: { ...targets, dayTypeLabel: tDayType(dayType, lang) },
    fueling,
    menus,
  };
}

export const nutritionRouter = Router();

function findWorkoutOn(plan, dateStr) {
  return plan?.workouts?.find((w) => w.day_date === dateStr) || null;
}

nutritionRouter.get('/today', (req, res) => {
  const lang = getLang(req);
  const profile = getProfile(req.userId);
  const today = todayStr();
  const plan = getActivePlan(req.userId, lang);
  const workout = findWorkoutOn(plan, today);
  const adaptive = computeAdaptiveAdjustment(profile, lang, req.userId);
  const { targets, fueling, menus } = buildDayPayload(workout, profile, adaptive, lang);

  db.prepare(`
    INSERT INTO nutrition_targets (user_id, date, day_type, calories, protein_g, carbs_g, fat_g, tdee_estimate)
    VALUES (@userId, date('now', 'localtime'), @dayType, @calories, @protein_g, @carbs_g, @fat_g, @tdeeEstimate)
    ON CONFLICT(user_id, date) DO UPDATE SET day_type=excluded.day_type, calories=excluded.calories,
      protein_g=excluded.protein_g, carbs_g=excluded.carbs_g, fat_g=excluded.fat_g,
      tdee_estimate=excluded.tdee_estimate, generated_at=datetime('now')
  `).run({
    userId: req.userId,
    dayType: targets.dayType,
    calories: targets.calories,
    protein_g: targets.protein_g,
    carbs_g: targets.carbs_g,
    fat_g: targets.fat_g,
    tdeeEstimate: targets.tdeeEstimate,
  });

  res.json({ profile, workout, targets, fueling, adaptive, menus });
});

// A week-ahead view of what's coming: for each of the next N days, the training-driven
// calorie/macro target and two suggested menus, so meal planning and grocery shopping
// can happen once for the whole week instead of one day at a time.
nutritionRouter.get('/week', (req, res) => {
  const lang = getLang(req);
  const profile = getProfile(req.userId);
  const adaptive = computeAdaptiveAdjustment(profile, lang, req.userId);
  const plan = getActivePlan(req.userId, lang);
  const days = Math.min(14, Math.max(1, Number(req.query.days) || 7));

  const result = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(new Date(), i);
    const dateStr = localDateStr(d);
    const workout = findWorkoutOn(plan, dateStr);
    const payload = buildDayPayload(workout, profile, adaptive, lang);
    result.push({ date: dateStr, ...payload });
  }

  res.json({ days: result, adaptive });
});

nutritionRouter.get('/history', (req, res) => {
  const lang = getLang(req);
  const rows = db.prepare('SELECT * FROM nutrition_targets WHERE user_id = ? ORDER BY date DESC LIMIT 60').all(req.userId);
  res.json(rows.map((r) => ({ ...r, dayTypeLabel: tDayType(r.day_type, lang) })));
});

nutritionRouter.get('/weigh-ins', (req, res) => {
  const rows = db.prepare('SELECT * FROM weigh_ins WHERE user_id = ? ORDER BY date ASC').all(req.userId);
  res.json(rows);
});

nutritionRouter.post('/weigh-ins', (req, res) => {
  const { date, weight_kg, note } = req.body;
  if (!date || !weight_kg) return res.status(400).json({ error: 'date and weight_kg are required' });
  db.prepare(`
    INSERT INTO weigh_ins (user_id, date, weight_kg, note) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET weight_kg=excluded.weight_kg, note=excluded.note
  `).run(req.userId, date, weight_kg, note || null);
  // Keep profile's current weight in sync with the latest weigh-in.
  const latest = db.prepare('SELECT * FROM weigh_ins WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(req.userId);
  if (latest) db.prepare(`UPDATE profile SET weight_kg = ?, updated_at = datetime('now') WHERE user_id = ?`).run(latest.weight_kg, req.userId);
  res.json({ ok: true });
});

nutritionRouter.get('/adaptive', (req, res) => {
  res.json(computeAdaptiveAdjustment(getProfile(req.userId), getLang(req), req.userId));
});
