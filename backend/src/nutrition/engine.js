import { db } from '../db.js';
import { DEFAULT_LANG, tNutritionAdaptive, tFueling, pick, tMenuScaleHint } from '../i18n/translations.js';
import { DAY_MENUS } from './menuLibrary.js';

const KCAL_PER_KG_FAT = 7700;

export function calcAge(birthYear) {
  if (!birthYear) return 35;
  return new Date().getFullYear() - birthYear;
}

// Mifflin-St Jeor — the most validated BMR equation for the general population.
export function calcBmr(profile) {
  const weight = profile.weight_kg || 70;
  const height = profile.height_cm || 175;
  const age = calcAge(profile.birth_year);
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(profile.sex === 'female' ? base - 161 : base + 5);
}

// Baseline daily multiplier covers non-training life (desk job, chores, walking).
// Actual ride calories are added on top explicitly using Strava/planned-workout data,
// so we deliberately use a conservative "lightly active" baseline here to avoid
// double-counting training energy.
export function calcBaselineTdee(profile) {
  return Math.round(calcBmr(profile) * 1.25);
}

// Estimate calories burned for a ride. Prefers real Strava kilojoules (mechanical work,
// which is a good proxy for metabolic cost once you account for ~24% gross efficiency —
// the two nearly cancel out against the kJ->kcal conversion, so kcal ≈ kilojoules).
// Falls back to a TSS/FTP-based estimate for planned-but-not-yet-ridden workouts.
export function estimateRideCalories({ kilojoules, tss, ftp, durationMin }) {
  if (kilojoules) return Math.round(kilojoules);
  if (tss && ftp) {
    // Rough: average watts implied by TSS/duration, then watts * seconds / 1000 = kJ ≈ kcal
    const hours = (durationMin || 60) / 60;
    const avgWattsGuess = ftp * Math.sqrt(tss / (100 * hours || 1));
    return Math.round((avgWattsGuess * hours * 3600) / 1000);
  }
  return Math.round((durationMin || 60) * 8); // very rough fallback ~8 kcal/min zone 2
}

export function classifyDayType(plannedWorkout) {
  if (!plannedWorkout || plannedWorkout.workout_key === 'rest') return 'rest';
  const tss = plannedWorkout.planned_tss || 0;
  const minutes = plannedWorkout.planned_duration_min || 0;
  if (minutes >= 150 || tss >= 100) return 'long';
  if (tss >= 65) return 'hard';
  if (tss >= 30) return 'moderate';
  return 'easy';
}

// Carb periodization by day type (g/kg bodyweight) — higher carb availability on hard/
// long days to fuel and recover from the session; lower on rest days to favor the deficit
// and fat oxidation. Protein stays high and constant to protect lean mass in a deficit.
const CARB_G_PER_KG = { rest: 2.5, easy: 3.5, moderate: 4.5, hard: 6, long: 7.5 };
const PROTEIN_G_PER_KG = 1.9;
const MIN_FAT_G_PER_KG = 0.6;

export function computeDailyTargets({ profile, dayType, rideCalories = 0, calorieAdjustment = 0 }) {
  const weight = profile.weight_kg || 70;
  const baseline = calcBaselineTdee(profile);
  const tdeeToday = baseline + rideCalories;

  const goalType = profile.goal_type || 'ftp_and_weight';
  const wantsDeficit = goalType.includes('weight');
  const ratePctPerWeek = profile.goal_rate_pct_per_week ?? 5;
  let dailyDeficit = 0;
  if (wantsDeficit) {
    const weeklyDeficitKcal = (ratePctPerWeek / 100) * weight * KCAL_PER_KG_FAT;
    dailyDeficit = Math.min(weeklyDeficitKcal / 7, tdeeToday * 0.25, 750); // safety caps
  }

  let calorieTarget = Math.round(tdeeToday - dailyDeficit + calorieAdjustment);
  // Never dip below a safety floor.
  const floor = Math.round(calcBmr(profile) * 0.9);
  if (calorieTarget < floor) calorieTarget = floor;

  const proteinG = Math.round(PROTEIN_G_PER_KG * weight);
  const carbG = Math.round((CARB_G_PER_KG[dayType] ?? 3.5) * weight);
  let fatG = Math.round((calorieTarget - proteinG * 4 - carbG * 4) / 9);
  const minFat = Math.round(MIN_FAT_G_PER_KG * weight);
  if (fatG < minFat) {
    fatG = minFat;
    // If fat floor forces it, trim carbs slightly rather than protein.
  }

  return {
    dayType,
    tdeeEstimate: tdeeToday,
    calories: calorieTarget,
    protein_g: proteinG,
    carbs_g: carbG,
    fat_g: fatG,
  };
}

// Adaptive calorie adjustment: compares the actual weight trend (7-day rolling average)
// against the goal rate, and nudges the daily calorie target by a bounded amount — the
// same idea used by adaptive-TDEE apps like MacroFactor. Requires at least 2 weeks of
// weigh-ins to have a stable trend to compare.
export function computeAdaptiveAdjustment(profile, lang = DEFAULT_LANG, userId) {
  const rows = db.prepare('SELECT * FROM weigh_ins WHERE user_id = ? ORDER BY date ASC').all(userId);
  if (rows.length < 10) return { adjustment: 0, message: tNutritionAdaptive(lang, 'needsMoreData') };

  const trend = rollingAverage(rows, 7);
  const recent = trend[trend.length - 1];
  const twoWeeksAgoIdx = Math.max(0, trend.length - 15);
  const past = trend[twoWeeksAgoIdx];
  if (!recent || !past) return { adjustment: 0, message: tNutritionAdaptive(lang, 'notEnoughData') };

  const days = (new Date(recent.date) - new Date(past.date)) / (1000 * 3600 * 24) || 14;
  const actualWeeklyRateKg = ((recent.avg - past.avg) / days) * 7;
  const goalWeeklyRateKg = -((profile.goal_rate_pct_per_week ?? 5) / 100) * (profile.weight_kg || 70);
  const wantsLoss = (profile.goal_type || '').includes('weight');
  if (!wantsLoss) return { adjustment: 0, message: tNutritionAdaptive(lang, 'notWeightFocused') };

  const diff = actualWeeklyRateKg - goalWeeklyRateKg; // positive = losing slower than goal (or gaining)
  let adjustment = 0;
  let message = tNutritionAdaptive(lang, 'onTarget');
  if (diff > 0.15) {
    adjustment = -100;
    message = tNutritionAdaptive(lang, 'behind', { actual: actualWeeklyRateKg.toFixed(2), goal: goalWeeklyRateKg.toFixed(2) });
  } else if (diff < -0.25) {
    adjustment = 100;
    message = tNutritionAdaptive(lang, 'ahead', { actual: actualWeeklyRateKg.toFixed(2), goal: goalWeeklyRateKg.toFixed(2) });
  }
  return { adjustment, message, actualWeeklyRateKg, goalWeeklyRateKg };
}

function rollingAverage(rows, windowDays) {
  return rows.map((r, i) => {
    const windowStart = new Date(r.date);
    windowStart.setDate(windowStart.getDate() - windowDays);
    const windowRows = rows.filter((x) => new Date(x.date) > windowStart && new Date(x.date) <= new Date(r.date));
    const avg = windowRows.reduce((s, x) => s + x.weight_kg, 0) / windowRows.length;
    return { date: r.date, avg };
  });
}

// Simple fueling guidance for a specific ride, following standard endurance sports
// nutrition guidelines (not a substitute for individualized professional advice).
// Two alternative full-day menus (breakfast/lunch/snack/dinner) built from real
// Spanish/Mediterranean dishes for the given day type — the "what do I actually eat"
// answer behind the macro targets. Each template's reference calories are compared
// against the athlete's real target for the day so we can tell them whether to scale
// portions up or down a bit, rather than pretending gram-level precision.
export function suggestMenus(dayType, targetCalories, lang = DEFAULT_LANG) {
  const templates = DAY_MENUS[dayType] || DAY_MENUS.moderate;
  return templates.map((tpl) => {
    const scaleFactor = targetCalories && tpl.kcal ? targetCalories / tpl.kcal : 1;
    const meals = {};
    for (const slot of Object.keys(tpl.meals)) {
      const m = tpl.meals[slot];
      meals[slot] = {
        name: pick(m.name, lang, slot),
        kcal: m.kcal,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        fat_g: m.fat_g,
      };
    }
    return {
      id: tpl.id,
      referenceKcal: tpl.kcal,
      referenceProteinG: tpl.protein_g,
      referenceCarbsG: tpl.carbs_g,
      referenceFatG: tpl.fat_g,
      scaleFactor: Math.round(scaleFactor * 100) / 100,
      scaleHint: tMenuScaleHint(lang, scaleFactor),
      meals,
    };
  });
}

export function fuelingGuidance(workout, lang = DEFAULT_LANG) {
  if (!workout || workout.workout_key === 'rest') {
    return tFueling(lang, { isRest: true });
  }
  const minutes = workout.planned_duration_min || 60;
  const intense = ['threshold', 'vo2max', 'over_unders', 'anaerobic_repeats', 'ftp_test', 'climbing_repeats'].includes(workout.workout_key);
  return tFueling(lang, { isRest: false, minutes, intense });
}
