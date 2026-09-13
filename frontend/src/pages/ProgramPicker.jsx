import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { todayStr } from '../utils/dates.js';

export default function ProgramPicker() {
  const { profile, refreshPlan, lang, t } = useApp();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [weeks, setWeeks] = useState(null);
  const [startDate, setStartDate] = useState(() => todayStr());
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.getPrograms().then((p) => {
      setPrograms(p);
      const recommended = p.find((prog) => prog.goalFocus.join(',') === (profile?.goal_type || '').split('_and_').join(','));
      setSelected((recommended || p[0])?.id || null);
      setWeeks((recommended || p[0])?.defaultWeeks);
    });
    // Re-fetch program names/taglines/descriptions when the language toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, lang]);

  const generate = async () => {
    setGenerating(true);
    setErr(null);
    try {
      await api.generatePlan({ programId: selected, startDate, weeks: Number(weeks) });
      await refreshPlan();
      navigate('/');
    } catch (e) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const isRecommended = (p) => {
    if (profile?.goal_type === 'ftp_and_weight') return p.id === 'ftp_weight_combo';
    if (profile?.goal_type === 'ftp') return p.id === 'ftp_builder';
    if (profile?.goal_type === 'weight') return p.id === 'weight_loss_base';
    if (profile?.goal_type === 'endurance_event') return p.id === 'gran_fondo_endurance';
    return false;
  };

  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-4">
      <h1 className="text-lg font-semibold text-neutral-900">{t('programPicker.title')}</h1>
      <p className="mt-1 text-sm text-neutral-500">{t('programPicker.subtitle')}</p>

      <div className="mt-5 space-y-3">
        {programs.map((p) => (
          <label
            key={p.id}
            className={`block cursor-pointer rounded-2xl border px-4 py-3.5 transition-shadow ${
              selected === p.id ? 'border-brand-400 bg-brand-50 shadow-card' : 'border-neutral-100 bg-white shadow-card'
            }`}
          >
            <input
              type="radio"
              name="program"
              className="hidden"
              checked={selected === p.id}
              onChange={() => {
                setSelected(p.id);
                setWeeks(p.defaultWeeks);
              }}
            />
            <div className="flex items-center justify-between">
              <div className="font-semibold text-neutral-900">{p.name}</div>
              {isRecommended(p) && (
                <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-bold text-white">{t('programPicker.recommended')}</span>
              )}
            </div>
            <div className="text-xs font-semibold text-brand-600">{p.tagline}</div>
            <p className="mt-1 text-xs text-neutral-500">{p.description}</p>
            <div className="mt-1 font-mono text-[11px] text-neutral-400">{t('programPicker.defaultLength')}: {p.defaultWeeks} {t('programPicker.weeks')}</div>
          </label>
        ))}
      </div>

      {selected && (
        <div className="mt-6 space-y-3 rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-500">{t('programPicker.startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-900 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">{t('programPicker.planLength')}</label>
              <input
                type="number"
                value={weeks || ''}
                onChange={(e) => setWeeks(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-900 outline-none"
              />
            </div>
          </div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button
            onClick={generate}
            disabled={generating}
            className="w-full rounded-full bg-brand-600 py-3 font-semibold text-white shadow-pop disabled:opacity-50"
          >
            {generating ? t('programPicker.generating') : t('programPicker.generate')}
          </button>
        </div>
      )}
    </div>
  );
}
