import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import ImportPanel from '../components/ImportPanel.jsx';
import WeekdayPicker from '../components/WeekdayPicker.jsx';

export default function Settings() {
  const { profile, refreshProfile, refreshPlan, stravaConnected, refreshStrava, user, logout, lang, setLang, t } = useApp();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState(null);

  useEffect(() => {
    if (profile) setForm(profile);
    refreshStrava();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (!form) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setRescheduleMsg(null);
    try {
      const res = await api.updateProfile({
        name: form.name,
        sex: form.sex,
        birth_year: Number(form.birth_year) || null,
        height_cm: Number(form.height_cm) || null,
        weight_kg: Number(form.weight_kg) || null,
        ftp_watts: Number(form.ftp_watts) || null,
        goal_type: form.goal_type,
        goal_weight_kg: Number(form.goal_weight_kg) || null,
        goal_rate_pct_per_week: Number(form.goal_rate_pct_per_week),
        weekly_hours_available: Number(form.weekly_hours_available),
        available_days: form.available_days,
        units: form.units,
      });
      await refreshProfile();
      if (res?.reschedule && res.reschedule.changed > 0) {
        await refreshPlan();
        setRescheduleMsg(t('settings.reschedulePending'));
      }
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await api.disconnectStrava();
      await refreshStrava();
    } finally {
      setDisconnecting(false);
    }
  };

  const STRAVA_MESSAGES = {
    connected: { text: t('settings.stravaConnected'), tone: 'text-brand-600' },
    denied: { text: t('settings.stravaDenied'), tone: 'text-neutral-500' },
    error: { text: t('settings.stravaError'), tone: 'text-rose-600' },
  };
  const stravaMsg = STRAVA_MESSAGES[searchParams.get('strava')];
  const input = 'w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-neutral-900 outline-none focus:border-brand-500';
  const label = 'text-xs font-medium text-neutral-500';

  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-4">
      <h1 className="text-lg font-semibold text-neutral-900">{t('settings.title')}</h1>
      {user?.email && <p className="mt-1 text-xs text-neutral-400">{user.email}</p>}

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-neutral-100 bg-white px-4 py-3 shadow-card">
        <span className="text-sm font-medium text-neutral-800">{t('settings.language')}</span>
        <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-0.5 text-[10px] font-bold uppercase tracking-wide">
          {['es', 'en'].map((code) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`rounded-full px-2.5 py-1 transition-colors ${lang === code ? 'bg-brand-600 text-white' : 'text-neutral-400'}`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {stravaMsg && <p className={`mt-3 text-sm ${stravaMsg.tone}`}>{stravaMsg.text}</p>}

      <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{t('settings.getDataIn')}</h2>
      <p className="mb-3 text-xs text-neutral-500">{t('settings.getDataInDesc')}</p>
      <ImportPanel onImported={() => { refreshProfile(); refreshPlan(); }} />

      <div className="mt-6">
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl border border-neutral-100 bg-white px-4 py-3 text-left shadow-card"
        >
          <span className="text-sm font-medium text-neutral-700">{t('settings.advancedSync')}</span>
          <span className="text-xs text-neutral-400">{advancedOpen ? '▲' : '▼'}</span>
        </button>
        {advancedOpen && (
          <div className="mt-2 rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
            <p className="text-xs text-neutral-500">{t('settings.advancedSyncDesc')}</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-900">{t('settings.strava')}</div>
                <div className="text-xs text-neutral-500">{stravaConnected ? t('settings.connected') : t('settings.notConnected')}</div>
              </div>
              {stravaConnected ? (
                <button onClick={disconnect} disabled={disconnecting} className="rounded-full border border-neutral-200 px-3 py-2 text-xs text-neutral-600">
                  {t('settings.disconnect')}
                </button>
              ) : (
                <a href={api.stravaConnectUrl()} className="rounded-full bg-neutral-900 px-3 py-2 text-xs font-medium text-white">
                  {t('settings.connect')}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-400">{t('settings.profile')}</h2>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className={label}>{t('settings.name')}</label>
          <input className={input} value={form.name || ''} onChange={set('name')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t('settings.sex')}</label>
            <select className={input} value={form.sex} onChange={set('sex')}>
              <option value="male">{t('settings.male')}</option>
              <option value="female">{t('settings.female')}</option>
            </select>
          </div>
          <div>
            <label className={label}>{t('settings.birthYear')}</label>
            <input className={input} type="number" value={form.birth_year || ''} onChange={set('birth_year')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t('settings.height')}</label>
            <input className={input} type="number" value={form.height_cm || ''} onChange={set('height_cm')} />
          </div>
          <div>
            <label className={label}>{t('settings.weight')}</label>
            <input className={input} type="number" step="0.1" value={form.weight_kg || ''} onChange={set('weight_kg')} />
          </div>
        </div>
        <div>
          <label className={label}>{t('settings.ftp')}</label>
          <input className={input} type="number" value={form.ftp_watts || ''} onChange={set('ftp_watts')} />
        </div>
        <div>
          <label className={label}>{t('settings.units')}</label>
          <select className={input} value={form.units} onChange={set('units')}>
            <option value="metric">{t('settings.unitsMetric')}</option>
            <option value="imperial">{t('settings.unitsImperial')}</option>
          </select>
        </div>
        <div>
          <label className={label}>{t('settings.goal')}</label>
          <select className={input} value={form.goal_type} onChange={set('goal_type')}>
            <option value="ftp_and_weight">{t('settings.goalFtpWeight')}</option>
            <option value="ftp">{t('settings.goalFtp')}</option>
            <option value="weight">{t('settings.goalWeight')}</option>
            <option value="endurance_event">{t('settings.goalEndurance')}</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t('settings.goalWeightKg')}</label>
            <input className={input} type="number" step="0.1" value={form.goal_weight_kg || ''} onChange={set('goal_weight_kg')} />
          </div>
          <div>
            <label className={label}>{t('settings.targetRate')}</label>
            <input className={input} type="number" step="0.5" value={form.goal_rate_pct_per_week} onChange={set('goal_rate_pct_per_week')} />
          </div>
        </div>
        <div>
          <label className={label}>{t('settings.hoursAvailable')}</label>
          <input className={input} type="number" step="0.5" value={form.weekly_hours_available} onChange={set('weekly_hours_available')} />
        </div>
        <div>
          <label className={label}>{t('settings.availableDays')}</label>
          <div className="mt-1.5">
            <WeekdayPicker
              value={form.available_days || [0, 1, 2, 3, 4, 5, 6]}
              onChange={(days) => setForm((f) => ({ ...f, available_days: days }))}
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-400">{t('settings.availableDaysHint')}</p>
        </div>
        {rescheduleMsg && <p className="text-xs font-medium text-brand-600">{rescheduleMsg}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-full bg-brand-600 py-3 font-semibold text-white shadow-pop disabled:opacity-50">
          {saving ? t('common.saving') : t('settings.save')}
        </button>
      </form>

      <button onClick={logout} className="mt-6 w-full rounded-full border border-neutral-200 py-2.5 text-xs text-neutral-500">
        {t('settings.logout')}
      </button>
    </div>
  );
}
