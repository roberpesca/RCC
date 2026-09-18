import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { todayStr } from '../utils/dates.js';

const STATUS_STYLES = {
  planned: 'bg-neutral-100 text-neutral-500',
  completed: 'bg-brand-50 text-brand-700',
  missed: 'bg-rose-50 text-rose-600',
};

export default function WorkoutCard({ workout, onComplete, onToggleAvailability, onMismatchRespond, expanded: expandedProp }) {
  const { t } = useApp();
  const [open, setOpen] = useState(!!expandedProp);
  const isRest = workout.workout_key === 'rest';
  // Only planned, not-yet-happened days can be blocked/unblocked — the backend only
  // ever reflows sessions from today onward, so toggling a past or completed day
  // wouldn't do anything.
  const canToggleAvailability = !!onToggleAvailability && workout.status === 'planned' && workout.day_date >= todayStr();

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white shadow-card">
      <button className="flex w-full items-start justify-between p-4 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isRest ? 'bg-neutral-300' : 'bg-brand-500'}`} />
          <div>
            <div className="font-semibold text-neutral-900">{workout.title}</div>
            <div className="mt-0.5 font-mono text-[11px] text-neutral-400">
              {workout.day_date}
              {!isRest && workout.planned_duration_min ? ` · ${workout.planned_duration_min}${t('common.min')}` : ''}
              {!isRest && workout.planned_tss
                ? ` · ${workout.planned_tss}${workout.actual_tss != null ? `→${workout.actual_tss}` : ''} TSS`
                : ''}
              {workout.dayAvailable === false && (
                <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                  {t('training.unavailableBadge')}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[workout.status] || STATUS_STYLES.planned}`}>
          {t(`workoutCard.${workout.status}`) || workout.status}
        </span>
      </button>

      {workout.mismatch_status === 'pending' && onMismatchRespond && (
        <div className="mx-4 mb-3 rounded-xl bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            {workout.mismatch_direction === 'over' ? t('workoutCard.mismatchOver') : t('workoutCard.mismatchUnder')}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onMismatchRespond(workout.id, 'apply')}
              className="flex-1 rounded-full bg-amber-600 py-1.5 text-xs font-semibold text-white"
            >
              {t('workoutCard.mismatchApply')}
            </button>
            <button
              onClick={() => onMismatchRespond(workout.id, 'dismiss')}
              className="flex-1 rounded-full border border-amber-300 py-1.5 text-xs font-medium text-amber-700"
            >
              {t('workoutCard.mismatchDismiss')}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="space-y-3 border-t border-neutral-100 p-4">
          <p className="text-sm text-neutral-500">{workout.description}</p>

          {workout.actual_tss != null && (
            <div className="flex gap-4 rounded-xl bg-neutral-50 px-3 py-2.5 font-mono text-xs">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">{t('workoutCard.plannedTss')}</div>
                <div className="mt-0.5 text-neutral-600">{workout.planned_tss} TSS</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">{t('workoutCard.actualTss')}</div>
                <div className="mt-0.5 font-semibold text-neutral-800">{workout.actual_tss} TSS</div>
              </div>
            </div>
          )}

          {workout.purpose && (
            <div className="rounded-xl bg-brand-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-brand-700">{t('workoutCard.why')}</div>
              <p className="mt-0.5 text-xs text-brand-900/80">{workout.purpose}</p>
            </div>
          )}

          {workout.adapted_from && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {t('workoutCard.adapted')}: {workout.adapted_from}
            </p>
          )}

          {workout.structure?.length > 0 && (
            <div className="space-y-1">
              {workout.structure.map((seg, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-1.5 font-mono text-xs">
                  <span className="text-neutral-600">{seg.noteText || seg.note}</span>
                  <span className="text-neutral-400">
                    {seg.minutes}{t('common.min')} · {Math.round(seg.ifLow * 100)}-{Math.round(seg.ifHigh * 100)}% FTP
                    {seg.cadence ? ` · ${seg.cadence[0]}-${seg.cadence[1]} ${t('workoutCard.rpm')}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {workout.coachTip && (
            <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{t('workoutCard.coachTip')}</div>
              <p className="mt-0.5 text-xs text-neutral-600">{workout.coachTip}</p>
            </div>
          )}

          {(workout.indoorTip || workout.outdoorTip) && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {workout.indoorTip && (
                <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{t('workoutCard.indoor')}</div>
                  <p className="mt-0.5 text-xs text-neutral-600">{workout.indoorTip}</p>
                </div>
              )}
              {workout.outdoorTip && (
                <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{t('workoutCard.outdoor')}</div>
                  <p className="mt-0.5 text-xs text-neutral-600">{workout.outdoorTip}</p>
                </div>
              )}
            </div>
          )}

          {!isRest && onComplete && workout.status === 'planned' && (
            <button
              onClick={() => onComplete(workout.id)}
              className="w-full rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-pop hover:bg-brand-700"
            >
              {t('workoutCard.markComplete')}
            </button>
          )}

          {canToggleAvailability && (
            <button
              onClick={() => onToggleAvailability(workout.day_date, workout.dayAvailable)}
              className="w-full rounded-full border border-neutral-200 py-2 text-xs font-medium text-neutral-500"
            >
              {workout.dayAvailable === false ? t('training.markAvailable') : t('training.cantTrain')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
