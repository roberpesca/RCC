import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import WorkoutCard from '../components/WorkoutCard.jsx';
import PendingRescheduleBanner from '../components/PendingRescheduleBanner.jsx';
import { todayStr } from '../utils/dates.js';

export default function Dashboard() {
  const { plan, profile, stravaConnected, refreshPlan, refreshProfile, lang, t } = useApp();
  const [snapshot, setSnapshot] = useState(null);
  const [load, setLoad] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const load_ = async () => {
    const [snap, loadData] = await Promise.all([api.getSnapshot(), api.getLoad(56)]);
    setSnapshot(snap);
    setLoad(loadData);
  };

  useEffect(() => {
    load_();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, lang]);

  const today = todayStr();
  const todayWorkout = plan?.workouts?.find((w) => w.day_date === today);
  const weekWorkouts = plan?.workouts?.filter((w) => w.week_number === todayWorkout?.week_number) || [];
  const weeklyPlannedTss = weekWorkouts.reduce((s, w) => s + (w.planned_tss || 0), 0);
  const weeklyActualTss = weekWorkouts.reduce((s, w) => s + (w.actual_tss || 0), 0);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.syncStrava();
      setSyncMsg(t('importPanel.rowsImported', res.imported));
      await Promise.all([refreshPlan(), refreshProfile(), load_()]);
    } catch (e) {
      setSyncMsg(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const markComplete = async (id) => {
    await api.setWorkoutStatus(id, 'completed');
    await refreshPlan();
  };

  return (
    <div className="mx-auto max-w-md px-5 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{t('dashboard.greeting')} {profile?.name || ''}</h1>
          <p className="text-xs text-neutral-400">{new Date().toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>
        <Link to="/settings" className="rounded-full bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-pop">
          {t('dashboard.importData')}
        </Link>
      </div>

      {stravaConnected && (
        <button
          onClick={sync}
          disabled={syncing}
          className="mt-3 w-full rounded-full border border-neutral-200 bg-white py-2 text-xs font-medium text-neutral-600 disabled:opacity-50"
        >
          {syncing ? t('dashboard.syncing') : t('dashboard.syncStrava')}
        </button>
      )}
      {syncMsg && <p className="mt-1 text-xs text-neutral-400">{syncMsg}</p>}

      {plan?.pendingReschedule && (
        <div className="mt-4">
          <PendingRescheduleBanner pendingReschedule={plan.pendingReschedule} onResolved={refreshPlan} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatCard label="FTP" value={profile?.ftp_watts ? `${Math.round(profile.ftp_watts)}w` : '—'} sub={snapshot?.ftpDeltaWatts ? `${snapshot.ftpDeltaWatts > 0 ? '+' : ''}${snapshot.ftpDeltaWatts}w` : undefined} accent="text-brand-600" />
        <StatCard label={t('settings.weight')} value={profile?.weight_kg ? `${profile.weight_kg}kg` : '—'} sub={snapshot?.weightDeltaKg ? `${snapshot.weightDeltaKg > 0 ? '+' : ''}${snapshot.weightDeltaKg}kg` : undefined} />
        <StatCard label="W/KG" value={snapshot?.wattsPerKg ?? '—'} />
      </div>

      <div className="mt-3">
        <StatCard label="TSB" value={load?.current ? load.current.tsb : '—'} sub={load?.current && (load.current.tsb < -10 ? t('dashboard.fatigued') : load.current.tsb > 5 ? t('dashboard.fresh') : t('dashboard.balanced'))} accent={load?.current?.tsb < -20 ? 'text-rose-500' : 'text-brand-600'} />
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">{t('dashboard.tsbExplain')}</p>
      </div>

      {load?.series && (
        <div className="mt-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="font-semibold uppercase tracking-wide">{t('dashboard.fitness')}</span>
            <span className="font-mono font-semibold text-neutral-700">{load.current.ctl}</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={load.series}>
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#737373' }} />
              <Line type="monotone" dataKey="ctl" stroke="#0d9488" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="atl" stroke="#fb923c" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">{t('dashboard.ctlAtlExplain')}</p>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{t('dashboard.today')}</h2>
        {!plan ? (
          <Link to="/programs" className="block rounded-2xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            {t('dashboard.noPlan')}
          </Link>
        ) : todayWorkout ? (
          <WorkoutCard workout={todayWorkout} onComplete={markComplete} expanded />
        ) : (
          <p className="text-sm text-neutral-500">{t('dashboard.nothingToday')}</p>
        )}
      </div>

      {plan && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{t('dashboard.thisWeek')}</h2>
            <span className="font-mono text-xs text-neutral-400">
              {weeklyPlannedTss} {t('dashboard.tssPlanned')}
              {weeklyActualTss > 0 && ` · ${weeklyActualTss} ${t('dashboard.tssDone')}`}
            </span>
          </div>
          <div className="space-y-2">
            {weekWorkouts.map((w) => (
              <WorkoutCard key={w.id} workout={w} onComplete={markComplete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
