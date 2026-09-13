// Reusable workout building blocks — cycling only (no off-bike sessions). "structure" is
// a list of segments; each segment's intensity is a fraction of FTP, used both to render
// %FTP targets in the UI and to estimate Training Stress Score:
// TSS ≈ (hours) * IF^2 * 100 per segment.
//
// Display text (title/description) lives in i18n/translations.js, keyed by the same
// workout key, and is resolved at request time based on the athlete's language —
// keeping it out of here means switching languages never requires regenerating a plan.
//
// Cadence (rpm) targets by segment type — attached automatically by seg() below so every
// segment carries a concrete pedaling-cadence cue alongside its %FTP range, without having
// to repeat it at every call site. Low-cadence "climb" work builds muscular/force strength,
// high-cadence "sprint"/"over" work trains neuromuscular power, everything else sits in a
// normal cruising cadence.
const CADENCE_BY_NOTE = {
  warmup: [85, 95],
  cooldown: [85, 95],
  steady: [85, 95],
  upper_z2: [80, 90],
  recover: [85, 95],
  tempo: [85, 95],
  sweet_spot: [85, 95],
  threshold: [85, 95],
  over: [95, 105],
  under: [75, 85],
  prime: [90, 100],
  vo2max: [90, 100],
  sprint: [100, 115],
  climb: [60, 70],
  opener: [85, 95],
  max_effort: [90, 100],
};

function seg(minutes, ifLow, ifHigh, note) {
  return { minutes, ifLow, ifHigh, note, cadence: CADENCE_BY_NOTE[note] || null };
}

export const WORKOUTS = {
  rest: { structure: [] },
  recovery_spin: {
    structure: [seg(10, 0.4, 0.5, 'recover'), seg(20, 0.45, 0.55, 'recover'), seg(5, 0.4, 0.5, 'cooldown')],
  },
  endurance_z2: {
    structure: [seg(10, 0.5, 0.6, 'warmup'), seg(60, 0.65, 0.75, 'steady'), seg(10, 0.5, 0.55, 'cooldown')],
  },
  long_endurance: {
    structure: [
      seg(15, 0.5, 0.6, 'warmup'),
      seg(90, 0.65, 0.72, 'steady'),
      seg(45, 0.7, 0.78, 'upper_z2'),
      seg(10, 0.5, 0.55, 'cooldown'),
    ],
  },
  tempo: {
    structure: [seg(15, 0.5, 0.6, 'warmup'), seg(40, 0.76, 0.85, 'tempo'), seg(10, 0.5, 0.55, 'cooldown')],
  },
  sweet_spot: {
    structure: [
      seg(15, 0.5, 0.6, 'warmup'),
      seg(15, 0.88, 0.94, 'sweet_spot'),
      seg(5, 0.5, 0.55, 'recover'),
      seg(15, 0.88, 0.94, 'sweet_spot'),
      seg(5, 0.5, 0.55, 'recover'),
      seg(10, 0.5, 0.55, 'cooldown'),
    ],
  },
  threshold: {
    structure: [
      seg(15, 0.5, 0.6, 'warmup'),
      seg(20, 0.98, 1.03, 'threshold'),
      seg(10, 0.5, 0.55, 'recover'),
      seg(20, 0.98, 1.03, 'threshold'),
      seg(10, 0.5, 0.55, 'cooldown'),
    ],
  },
  over_unders: {
    structure: [
      seg(15, 0.5, 0.6, 'warmup'),
      seg(2, 1.05, 1.1, 'over'), seg(2, 0.9, 0.95, 'under'),
      seg(2, 1.05, 1.1, 'over'), seg(2, 0.9, 0.95, 'under'),
      seg(2, 1.05, 1.1, 'over'), seg(2, 0.9, 0.95, 'under'),
      seg(10, 0.5, 0.55, 'recover'),
      seg(2, 1.05, 1.1, 'over'), seg(2, 0.9, 0.95, 'under'),
      seg(2, 1.05, 1.1, 'over'), seg(2, 0.9, 0.95, 'under'),
      seg(2, 1.05, 1.1, 'over'), seg(2, 0.9, 0.95, 'under'),
      seg(12, 0.5, 0.55, 'cooldown'),
    ],
  },
  vo2max: {
    structure: [
      seg(15, 0.5, 0.6, 'warmup'), seg(5, 0.75, 0.85, 'prime'),
      ...Array.from({ length: 5 }).flatMap(() => [seg(3, 1.15, 1.25, 'vo2max'), seg(3, 0.45, 0.55, 'recover')]),
      seg(10, 0.5, 0.55, 'cooldown'),
    ],
  },
  anaerobic_repeats: {
    structure: [
      seg(15, 0.5, 0.6, 'warmup'), seg(5, 0.8, 0.9, 'prime'),
      ...Array.from({ length: 8 }).flatMap(() => [seg(0.5, 1.5, 1.8, 'sprint'), seg(4.5, 0.45, 0.55, 'recover')]),
      seg(10, 0.5, 0.55, 'cooldown'),
    ],
  },
  climbing_repeats: {
    structure: [
      seg(15, 0.5, 0.6, 'warmup'),
      seg(12, 0.95, 1.05, 'climb'), seg(8, 0.5, 0.55, 'recover'),
      seg(12, 0.95, 1.05, 'climb'), seg(8, 0.5, 0.55, 'recover'),
      seg(12, 0.95, 1.05, 'climb'),
      seg(10, 0.5, 0.55, 'cooldown'),
    ],
  },
  ftp_test: {
    structure: [seg(15, 0.5, 0.6, 'warmup'), seg(5, 0.9, 1.0, 'opener'), seg(20, 1.0, 1.15, 'max_effort'), seg(10, 0.4, 0.5, 'cooldown')],
  },
};

export function estimateWorkoutTss(structure) {
  return Math.round(
    structure.reduce((sum, s) => {
      const ifAvg = (s.ifLow + s.ifHigh) / 2;
      return sum + (s.minutes / 60) * ifAvg * ifAvg * 100;
    }, 0)
  );
}

export function estimateWorkoutMinutes(structure) {
  return Math.round(structure.reduce((sum, s) => sum + s.minutes, 0));
}
