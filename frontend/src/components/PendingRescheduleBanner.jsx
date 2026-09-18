import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';

// Confirm-first prompt for the availability rescheduler (see backend training/scheduler.js):
// shown whenever a plan has a pending reschedule proposal — i.e. an availability change
// (Settings pattern or a one-off "can't train this day" toggle) has computed sessions that
// would move or drop, but nothing has been written to the plan yet. Mirrors the mid-week
// TSS-mismatch prompt's apply/dismiss pattern.
export default function PendingRescheduleBanner({ pendingReschedule, onResolved }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  if (!pendingReschedule || pendingReschedule.count === 0) return null;

  const respond = async (action) => {
    setBusy(true);
    try {
      if (action === 'apply') await api.rescheduleApply();
      else await api.rescheduleDismiss();
      await onResolved?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">{t('training.pendingRescheduleTitle', pendingReschedule.count)}</p>
      <div className="mt-2 space-y-1">
        {pendingReschedule.items.slice(0, 6).map((it, i) => (
          <div key={i} className="flex items-center justify-between font-mono text-[11px] text-amber-800">
            <span>{it.day_date}</span>
            <span>
              {it.from_title} ({it.from_tss} TSS) → {it.to_title} ({it.to_tss} TSS)
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => respond('apply')}
          disabled={busy}
          className="flex-1 rounded-full bg-amber-600 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {t('training.pendingRescheduleApply')}
        </button>
        <button
          onClick={() => respond('dismiss')}
          disabled={busy}
          className="flex-1 rounded-full border border-amber-300 py-1.5 text-xs font-medium text-amber-700 disabled:opacity-50"
        >
          {t('training.pendingRescheduleDismiss')}
        </button>
      </div>
    </div>
  );
}
