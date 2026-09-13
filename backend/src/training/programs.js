// Each program defines phases (Base / Build / Specialty) as fractions of the total plan
// length, and a 7-day pattern (Mon..Sun) of workout keys (see workoutLibrary.js) for each
// phase. planEngine.js expands this into concrete dated workouts, scales durations to the
// athlete's available hours, and inserts a step-back (recovery) week every 4th week.
//
// Cycling only — no off-bike/gym sessions. Display name/tagline/description live in
// i18n/translations.js (PROGRAMS_TEXT), keyed by `id`; phase display names live in
// i18n/translations.js (PHASES), keyed by the lowercase `name` below.

export const PROGRAMS = [
  {
    id: 'ftp_builder',
    goalFocus: ['ftp'],
    defaultWeeks: 12,
    phases: [
      { name: 'base', weeksFraction: 0.35, pattern: ['rest', 'sweet_spot', 'endurance_z2', 'tempo', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'build', weeksFraction: 0.4, pattern: ['rest', 'threshold', 'endurance_z2', 'over_unders', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'peak', weeksFraction: 0.25, pattern: ['rest', 'vo2max', 'endurance_z2', 'threshold', 'rest', 'long_endurance', 'recovery_spin'] },
    ],
  },
  {
    id: 'weight_loss_base',
    goalFocus: ['weight'],
    defaultWeeks: 12,
    phases: [
      { name: 'base', weeksFraction: 0.5, pattern: ['rest', 'endurance_z2', 'endurance_z2', 'endurance_z2', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'build', weeksFraction: 0.5, pattern: ['rest', 'tempo', 'endurance_z2', 'endurance_z2', 'rest', 'long_endurance', 'recovery_spin'] },
    ],
  },
  {
    id: 'ftp_weight_combo',
    goalFocus: ['ftp', 'weight'],
    defaultWeeks: 12,
    phases: [
      { name: 'base', weeksFraction: 0.35, pattern: ['rest', 'sweet_spot', 'endurance_z2', 'recovery_spin', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'build', weeksFraction: 0.4, pattern: ['rest', 'threshold', 'endurance_z2', 'recovery_spin', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'peak', weeksFraction: 0.25, pattern: ['rest', 'over_unders', 'endurance_z2', 'tempo', 'rest', 'long_endurance', 'recovery_spin'] },
    ],
  },
  {
    id: 'gran_fondo_endurance',
    goalFocus: ['endurance_event'],
    defaultWeeks: 14,
    phases: [
      { name: 'base', weeksFraction: 0.4, pattern: ['rest', 'endurance_z2', 'tempo', 'endurance_z2', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'build', weeksFraction: 0.4, pattern: ['rest', 'tempo', 'sweet_spot', 'endurance_z2', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'taper', weeksFraction: 0.2, pattern: ['rest', 'endurance_z2', 'tempo', 'recovery_spin', 'rest', 'endurance_z2', 'recovery_spin'] },
    ],
  },
  {
    id: 'climbing_specialist',
    goalFocus: ['ftp', 'weight'],
    defaultWeeks: 12,
    phases: [
      { name: 'base', weeksFraction: 0.35, pattern: ['rest', 'sweet_spot', 'recovery_spin', 'endurance_z2', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'build', weeksFraction: 0.4, pattern: ['rest', 'climbing_repeats', 'recovery_spin', 'endurance_z2', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'peak', weeksFraction: 0.25, pattern: ['rest', 'climbing_repeats', 'over_unders', 'endurance_z2', 'rest', 'long_endurance', 'recovery_spin'] },
    ],
  },
  {
    id: 'race_crit_prep',
    goalFocus: ['race'],
    defaultWeeks: 10,
    phases: [
      { name: 'base', weeksFraction: 0.3, pattern: ['rest', 'sweet_spot', 'endurance_z2', 'tempo', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'build', weeksFraction: 0.4, pattern: ['rest', 'vo2max', 'endurance_z2', 'over_unders', 'rest', 'long_endurance', 'recovery_spin'] },
      { name: 'sharpen', weeksFraction: 0.3, pattern: ['rest', 'anaerobic_repeats', 'recovery_spin', 'vo2max', 'rest', 'endurance_z2', 'recovery_spin'] },
    ],
  },
];

export function getProgram(id) {
  return PROGRAMS.find((p) => p.id === id);
}
