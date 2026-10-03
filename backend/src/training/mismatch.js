// Thresholds for flagging a planned-vs-actual TSS gap large enough to prompt the
// athlete about lightening (or slightly boosting) the rest of the week. Deliberately
// more conservative than the 130%-of-planned cap already used for weekly compliance
// (see computeWeekCompliance in adapt.js) — that number treats "130%+" as just
// "solid effort, nothing unusual" for a whole-week average. This is reserved for a
// single day being a real outlier, either direction, and always asks before
// changing anything (see adapt.js's applyMismatchAdjustment/dismissMismatch).
export const OVERSHOOT_RATIO = 1.65;
export const UNDERSHOOT_RATIO = 0.5;
export const MIN_PLANNED_TSS_FOR_MISMATCH = 20;

// Returns 'over' | 'under' | null. Only ever called for non-rest, planned sessions
// with a real planned_tss — a tiny recovery spin isn't substantial enough for its
// day-to-day noise to mean anything, hence the minimum-planned-TSS floor.
export function classifyMismatch(plannedTss, actualTss) {
  if (!plannedTss || plannedTss < MIN_PLANNED_TSS_FOR_MISMATCH) return null;
  if (actualTss === null || actualTss === undefined) return null;
  const ratio = actualTss / plannedTss;
  if (ratio >= OVERSHOOT_RATIO) return 'over';
  if (ratio <= UNDERSHOOT_RATIO) return 'under';
  return null;
}

// --- Type (shape) mismatch --------------------------------------------------
// A ratio on total TSS can't catch the case the athlete actually described: a
// different *kind* of session subbed in that happens to land on a similar total
// load — a long easy ride instead of planned intervals, or vice versa. What
// distinguishes those isn't how much load, it's how that load was distributed:
// a few hard efforts with recovery in between ("variable") versus one sustained
// effort ("steady"). Coggan's Variability Index (normalized power / average
// power) is the standard way to tell those apart from a power file; VI close to
// 1.0 means steady, materially above it means variable/intervals. We compute the
// same ratio two ways — from the actual ride's power (or, lacking power, a
// cruder heart-rate-spread proxy) and from the planned workout's own segments —
// and flag it only when they land on opposite sides of the line.
export const VARIABILITY_THRESHOLD = 1.1;
// Heart rate lags effort and a single short spike can skew max_hr on an
// otherwise steady ride, so this proxy only engages when there's no power data
// at all, and needs a wider gap before it calls a ride "variable".
export const HR_SPREAD_THRESHOLD = 0.18;

function shapeFromVI(vi) {
  if (vi === null || vi === undefined || Number.isNaN(vi)) return null;
  return vi >= VARIABILITY_THRESHOLD ? 'variable' : 'steady';
}

// 'steady' | 'variable' | null (null = no usable signal on this ride — no power
// data and no heart-rate data either, e.g. a manually-entered duration-only entry).
export function actualShape(activity) {
  if (!activity) return null;
  if (activity.avg_watts && activity.weighted_avg_watts) {
    return shapeFromVI(activity.weighted_avg_watts / activity.avg_watts);
  }
  if (activity.avg_hr && activity.max_hr && activity.avg_hr > 0) {
    const spread = (activity.max_hr - activity.avg_hr) / activity.avg_hr;
    return spread >= HR_SPREAD_THRESHOLD ? 'variable' : 'steady';
  }
  return null;
}

// Same idea from the plan's side: derives an NP/avg-style ratio from the
// workout's own segments (each a [minutes, ifLow, ifHigh] block) rather than a
// raw power stream, but the same principle — a session with short hard blocks
// and easier recovery between them reads as "variable" even at the block
// granularity we store. Accepts either the raw structure_json string or an
// already-parsed array.
export function plannedShape(structure) {
  let segments = structure;
  if (typeof segments === 'string') {
    try {
      segments = JSON.parse(segments || '[]');
    } catch {
      return null;
    }
  }
  if (!Array.isArray(segments) || segments.length === 0) return null;

  let durationSum = 0;
  let ifWeightedSum = 0;
  let if4WeightedSum = 0;
  for (const s of segments) {
    const minutes = s.minutes || 0;
    if (minutes <= 0) continue;
    const midIf = ((s.ifLow ?? 0) + (s.ifHigh ?? 0)) / 2;
    durationSum += minutes;
    ifWeightedSum += minutes * midIf;
    if4WeightedSum += minutes * midIf ** 4;
  }
  if (durationSum === 0) return null;
  const avgIf = ifWeightedSum / durationSum;
  if (!avgIf) return null;
  const npIf = (if4WeightedSum / durationSum) ** 0.25;
  return shapeFromVI(npIf / avgIf);
}

// Returns 'different_type' | null. Deliberately only meaningful as a secondary
// check — callers should only reach for this once classifyMismatch has already
// come back null, so a genuine overshoot/undershoot (which is the bigger signal)
// always takes priority over a same-load-different-shape flag.
export function classifyTypeMismatch(plannedStructure, activity) {
  const planned = plannedShape(plannedStructure);
  const actual = actualShape(activity);
  if (!planned || !actual) return null; // no usable signal on one side or the other
  return planned !== actual ? 'different_type' : null;
}
