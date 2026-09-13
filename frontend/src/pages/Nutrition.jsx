import { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import { api } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { todayStr } from '../utils/dates.js';

function MenuCard({ menu, label, t }) {
  const slots = ['breakfast', 'lunch', 'snack', 'dinner'];
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold text-brand-600">{label}</span>
        <span className="font-mono text-[10px] text-neutral-400">{t('nutrition.referenceNote')} ~{menu.referenceKcal} kcal</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">{menu.scaleHint}</p>
      <div className="mt-3 space-y-2.5">
        {slots.map((slot) => {
          const m = menu.meals[slot];
          if (!m) return null;
          return (
            <div key={slot} className="border-t border-neutral-100 pt-2.5 first:border-t-0 first:pt-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-brand-600">{m.slotLabel}</div>
              <p className="mt-0.5 text-sm text-neutral-800">{m.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
                {m.kcal} kcal · P{m.protein_g}g · C{m.carbs_g}g · F{m.fat_g}g
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayRow({ day, isToday, lang, t, open, onToggle }) {
  const weekday = new Date(day.date + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold capitalize text-neutral-900">{weekday}</span>
            {isToday && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold text-white">{t('nutrition.todayTag')}</span>}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {day.targets.dayTypeLabel}
            {day.workout && day.workout.workout_key !== 'rest' ? ` · ${day.workout.title}` : ''}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-brand-600">{day.targets.calories}</div>
          <div className="font-mono text-[10px] text-neutral-400">
            P{day.targets.protein_g} · C{day.targets.carbs_g} · F{day.targets.fat_g}
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
          {day.menus.map((m, i) => (
            <MenuCard key={m.id} menu={m} label={`${t('nutrition.menuWord')} ${String.fromCharCode(65 + i)}`} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function MacroBar({ label, grams, kcalPerG, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-500">
        <span className="font-semibold uppercase tracking-wide">{label}</span>
        <span className="font-mono">{grams}g · {grams * kcalPerG} kcal</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full ${color}`} style={{ width: '100%' }} />
      </div>
    </div>
  );
}

export default function Nutrition() {
  const { refreshProfile, lang, t } = useApp();
  const [data, setData] = useState(null);
  const [week, setWeek] = useState(null);
  const [weighIns, setWeighIns] = useState([]);
  const [newWeight, setNewWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedDate, setExpandedDate] = useState(null);

  const load = async () => {
    const [today, weekData, weights] = await Promise.all([api.getNutritionToday(), api.getNutritionWeek(7), api.getWeighIns()]);
    setData(today);
    setWeek(weekData);
    setWeighIns(weights);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const logWeight = async (e) => {
    e.preventDefault();
    if (!newWeight) return;
    setSaving(true);
    try {
      await api.addWeighIn({ date: todayStr(), weight_kg: Number(newWeight.replace(',', '.')) });
      setNewWeight('');
      await Promise.all([load(), refreshProfile()]);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="px-5 pt-8 text-neutral-400">{t('common.loading')}</div>;

  const { targets, fueling, adaptive, workout, menus } = data;
  const chartData = weighIns.slice(-60).map((w) => ({ date: w.date.slice(5), weight: w.weight_kg }));

  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-4">
      <h1 className="text-lg font-semibold text-neutral-900">{t('nutrition.title')}</h1>
      <p className="text-sm text-neutral-500">{targets.dayTypeLabel} — {t('nutrition.subtitle')}</p>

      <div className="mt-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-3xl font-bold text-brand-600">{targets.calories}</span>
          <span className="text-xs text-neutral-400">{t('nutrition.kcalTarget')} {targets.tdeeEstimate})</span>
        </div>
        <div className="mt-4 space-y-3">
          <MacroBar label={t('nutrition.protein')} grams={targets.protein_g} kcalPerG={4} color="bg-emerald-500" />
          <MacroBar label={t('nutrition.carbs')} grams={targets.carbs_g} kcalPerG={4} color="bg-brand-500" />
          <MacroBar label={t('nutrition.fat')} grams={targets.fat_g} kcalPerG={9} color="bg-amber-500" />
        </div>
      </div>

      {adaptive?.message && (
        <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">{adaptive.message}</p>
      )}

      {week?.days?.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{t('nutrition.weekTitle')}</h2>
          <p className="mb-2 mt-0.5 text-xs text-neutral-500">{t('nutrition.weekSubtitle')}</p>
          <div className="space-y-2">
            {week.days.map((day) => (
              <DayRow
                key={day.date}
                day={day}
                isToday={day.date === todayStr()}
                lang={lang}
                t={t}
                open={expandedDate === day.date}
                onToggle={() => setExpandedDate(expandedDate === day.date ? null : day.date)}
              />
            ))}
          </div>
        </div>
      )}

      {menus?.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{t('nutrition.menusTitle')}</h2>
          <p className="mb-2 mt-0.5 text-xs text-neutral-500">{t('nutrition.menusSubtitle')}</p>
          <div className="space-y-3">
            {menus.map((m, i) => (
              <MenuCard key={m.id} menu={m} label={`${t('nutrition.menuWord')} ${String.fromCharCode(65 + i)}`} t={t} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {t('nutrition.fueling')} {workout && workout.workout_key !== 'rest' ? `${t('nutrition.fuelingFor')} ${workout.title}` : ''}
        </h2>
        <div className="space-y-2">
          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-xs">
            <span className="font-semibold text-neutral-700">{t('nutrition.before')}: </span>
            <span className="text-neutral-500">{fueling.pre}</span>
          </div>
          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-xs">
            <span className="font-semibold text-neutral-700">{t('nutrition.during')}: </span>
            <span className="text-neutral-500">{fueling.during}</span>
          </div>
          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-xs">
            <span className="font-semibold text-neutral-700">{t('nutrition.after')}: </span>
            <span className="text-neutral-500">{fueling.post}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{t('nutrition.weightTrend')}</h2>
        {chartData.length > 1 && (
          <div className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-card">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 12 }} />
                <Line type="monotone" dataKey="weight" stroke="#0d9488" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <form onSubmit={logWeight} className="mt-3 flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={newWeight}
            onChange={(e) => {
              const v = e.target.value;
              // Accept digits and a single "." or "," decimal separator (typing directly,
              // not just the number-input spinner) — plain type="number" inputs can
              // silently reject keystrokes when the OS/browser locale expects a different
              // decimal separator, which made typing feel broken.
              if (v === '' || /^\d*[.,]?\d*$/.test(v)) setNewWeight(v);
            }}
            placeholder={t('nutrition.logWeightPlaceholder')}
            className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 outline-none focus:border-brand-500"
          />
          <button disabled={saving} className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-pop disabled:opacity-50">
            {t('nutrition.log')}
          </button>
        </form>
      </div>
    </div>
  );
}
