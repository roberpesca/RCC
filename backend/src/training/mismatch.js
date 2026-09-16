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
