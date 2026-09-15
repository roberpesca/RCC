import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { todayStr } from '../utils/dates.js';
import WeekdayPicker from '../components/WeekdayPicker.jsx';

export default function Onboarding() {
  const { refreshProfile, t } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', sex: 'male', birth_year: '', height_cm: '', weight_kg: '',
    ftp_watts: '', goal_type: 'ftp_and_weight', goal_weight_kg: '',
    goal_rate_pct_per_week: 5, weekly_hours_available: 6,
    available_days: [0, 1, 2, 3, 4, 5, 6],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const GOAL_OPTIONS = [
    { value: 'ftp_and_weight', label: t('onboarding.goalFtpWeight'), hint: t('onboarding.goalFtpWeightHint') },
    { value: 'ftp', label: t('onboarding.goalFtp'), hint: t('onboarding.goalFtpHint') },
    { value: 'weight', label: t('onboarding.goalWeight'), hint: t('onboarding.goalWeightHint') },
    { value: 'endurance_event', label: t('onboarding.goalEndurance'), hint: t('onboarding.goalEnduranceHint') },
  ];

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api.updateProfile({
        name: form.name || 'Athlete',
        sex: form.sex,
        birth_year: form.birth_year ? Number(form.birth_year) : null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        ftp_watts: form.ftp_watts ? Number(form.ftp_watts) : null,
        goal_type: form.goal_type,
        goal_weight_kg: form.goal_weight_kg ? Number(form.goal_weight_kg) : null,
        goal_rate_pct_per_week: Number(form.goal_rate_pct_per_week),
        weekly_hours_available: Number(form.weekly_hours_available),
        available_days: form.available_days,
        onboarded: 1,
      });
      if (form.weight_kg) {
        await api.addWeighIn({ date: todayStr(), weight_kg: Number(form.weight_kg) });
      }
      await refreshProfile();
      navigate('/programs');
    } catch (e2) {
      setErr(e2.message || t('onboarding.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-neutral-900 outline-none focus:border-brand-500';
  const label = 'text-xs font-medium text-neutral-500';

  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-4">
      <div className="mb-6 text-center">
        <div className="text-xl font-black tracking-tight text-neutral-900">
          Coach<span className="text-brand-500">.</span>
        </div>
        <h1 className="mt-3 text-lg font-semibold text-neutral-900">{t('onboarding.title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t('onboarding.subtitle')}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={label}>{t('onboarding.name')}</label>
          <input className={input} value={form.name} onChange={set('name')} placeholder={t('onboarding.namePlaceholder')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t('onboarding.sex')}</label>
            <select className={input} value={form.sex} onChange={set('sex')}>
              <option value="male">{t('onboarding.male')}</option>
              <option value="female">{t('onboarding.female')}</option>
            </select>
          </div>
          <div>
            <label className={label}>{t('onboarding.birthYear')}</label>
            <input className={input} type="number" value={form.birth_year} onChange={set('birth_year')} placeholder="1988" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t('onboarding.height')}</label>
            <input className={input} type="number" value={form.height_cm} onChange={set('height_cm')} placeholder="178" />
          </div>
          <div>
            <label className={label}>{t('onboarding.currentWeight')}</label>
            <input className={input} type="number" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} placeholder="80" />
          </div>
        </div>

        <div>
          <label className={label}>{t('onboarding.currentFtp')}</label>
          <input className={input} type="number" value={form.ftp_watts} onChange={set('ftp_watts')} placeholder="220" />
        </div>

        <div>
          <label className={label}>{t('onboarding.mainGoal')}</label>
          <div className="mt-1 space-y-2">
            {GOAL_OPTIONS.map((g) => (
              <label
                key={g.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${
                  form.goal_type === g.value ? 'border-brand-400 bg-brand-50' : 'border-neutral-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="goal_type"
                  value={g.value}
                  checked={form.goal_type === g.value}
                  onChange={set('goal_type')}
                  className="mt-1 accent-brand-600"
                />
                <div>
                  <div className="text-sm font-medium text-neutral-900">{g.label}</div>
                  <div className="text-xs text-neutral-500">{g.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {form.goal_type !== 'ftp' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{t('onboarding.goalWeightKg')}</label>
              <input className={input} type="number" step="0.1" value={form.goal_weight_kg} onChange={set('goal_weight_kg')} placeholder="72" />
            </div>
            <div>
              <label className={label}>{t('onboarding.targetRate')}</label>
              <input className={input} type="number" step="0.5" value={form.goal_rate_pct_per_week} onChange={set('goal_rate_pct_per_week')} />
            </div>
          </div>
        )}

        <div>
          <label className={label}>{t('onboarding.hoursAvailable')}</label>
          <input className={input} type="number" step="0.5" value={form.weekly_hours_available} onChange={set('weekly_hours_available')} />
        </div>

        <div>
          <label className={label}>{t('onboarding.availableDays')}</label>
          <div className="mt-1.5">
            <WeekdayPicker value={form.available_days} onChange={(days) => setForm((f) => ({ ...f, available_days: days }))} />
          </div>
          <p className="mt-1.5 text-xs text-neutral-400">{t('onboarding.availableDaysHint')}</p>
        </div>

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <button type="submit" disabled={saving} className="w-full rounded-full bg-brand-600 py-3 font-semibold text-white shadow-pop disabled:opacity-50">
          {saving ? t('common.saving') : t('onboarding.submit')}
        </button>
      </form>
    </div>
  );
}
