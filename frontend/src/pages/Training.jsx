import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import WorkoutCard from '../components/WorkoutCard.jsx';
import { todayStr } from '../utils/dates.js';

export default function Training() {
  const { plan, refreshPlan, t } = useApp();
  const [adapting, setAdapting] = useState(false);
  const [adaptMsg, setAdaptMsg] = useState(null);
  const [openWeek, setOpenWeek] = useState(null);

  const weeks = useMemo(() => {
    if (!plan) return [];
    const map = new Map();
    for (const w of plan.workouts) {
      if (!map.has(w.week_number)) map.set(w.week_number, { number: w.week_number, phaseLabel: w.phaseLabel, workouts: [] });
      map.get(w.week_number).workouts.push(w);
    }
    return [...map.values()].sort((a, b) => a.number - b.number);
  }, [plan]);

  const today = todayStr();
  const currentWeekNumber = weeks.find((w) => w.workouts.some((x) => x.day_date <= today) && w.workouts.some((x) => x.day_date >= today))?.number
    ?? weeks.find((w) => w.workouts[w.workouts.length - 1]?.day_date >= today)?.number
    ?? weeks[0]?.number;

  if (openWeek === null && currentWeekNumber) setOpenWeek(currentWeekNumber);

  const markComplete = async (id) => {
    await api.setWorkoutStatus(id, 'completed');
    await refreshPlan();
  };

  const adapt = async () => {
    setAdapting(true);
    setAdaptMsg(null);
    try {
      const res = await api.adaptPlan(plan.id);
      setAdaptMsg(res.message || res.reason || null);
      await refreshPlan();
    } catch (e) {
      setAdaptMsg(e.message);
    } finally {
      setAdapting(false);
    }
  };

  if (!plan) {
    return (
      <div className="mx-auto max-w-md px-5 pb-10 pt-4">
        <h1 className="text-lg font-semibold text-neutral-900">{t('training.title')}</h1>
        <Link to="/programs" className="mt-4 block rounded-2xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
          {t('training.noPlan')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{plan.program_name}</h1>
          <p className="text-xs text-neutral-400">{plan.weeks} {t('programPicker.weeks')} · {t('training.started')} {plan.start_date}</p>
        </div>
        <Link to="/programs" className="text-xs font-semibold text-brand-600">{t('training.switch')}</Link>
      </div>

      <button
        onClick={adapt}
        disabled={adapting}
        className="mt-4 w-full rounded-full border border-neutral-200 bg-white py-2 text-xs font-medium text-neutral-600 disabled:opacity-50"
      >
        {adapting ? t('training.adapting') : t('training.adapt')}
      </button>
      {adaptMsg && <p className="mt-1 text-xs text-neutral-400">{adaptMsg}</p>}

      <div className="mt-5 space-y-3">
        {weeks.map((w) => (
          <div key={w.number} className="rounded-2xl border border-neutral-100 bg-white shadow-card">
            <button
              onClick={() => setOpenWeek(openWeek === w.number ? null : w.number)}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <span className="text-sm font-semibold text-neutral-800">
                {t('training.week')} {w.number} · {w.phaseLabel}
                {w.number === currentWeekNumber && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">{t('training.current')}</span>}
              </span>
              <span className="text-xs text-neutral-400">{openWeek === w.number ? '▲' : '▼'}</span>
            </button>
            {openWeek === w.number && (
              <div className="space-y-2 px-4 pb-4">
                {w.workouts.map((wo) => (
                  <WorkoutCard key={wo.id} workout={wo} onComplete={markComplete} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
