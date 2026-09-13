import { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { api } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import StatCard from '../components/StatCard.jsx';

export default function Progress() {
  const { t } = useApp();
  const [ftpHistory, setFtpHistory] = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [load, setLoad] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    Promise.all([api.getFtpHistory(), api.getWeightHistory(), api.getLoad(180), api.getSnapshot()]).then(
      ([ftp, weight, loadData, snap]) => {
        setFtpHistory(ftp.map((r) => ({ date: r.date.slice(5), ftp: r.ftp_watts })));
        setWeightHistory(weight.map((r) => ({ date: r.date.slice(5), weight: r.weight_kg })));
        setLoad(loadData);
        setSnapshot(snap);
      }
    );
  }, []);

  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-4">
      <h1 className="text-lg font-semibold text-neutral-900">{t('progress.title')}</h1>
      <p className="text-sm text-neutral-500">{t('progress.subtitle')}</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard label="FTP" value={snapshot?.profile?.ftp_watts ? `${Math.round(snapshot.profile.ftp_watts)}w` : '—'} />
        <StatCard label={t('settings.weight')} value={snapshot?.profile?.weight_kg ? `${snapshot.profile.weight_kg}kg` : '—'} />
        <StatCard label={t('progress.wkg')} value={snapshot?.wattsPerKg ?? '—'} accent="text-brand-600" />
      </div>

      <Section title={t('progress.ftpOverTime')}>
        {ftpHistory.length > 1 ? (
          <MiniChart data={ftpHistory} dataKey="ftp" color="#0d9488" />
        ) : (
          <EmptyNote text={t('progress.ftpEmpty')} />
        )}
      </Section>

      <Section title={t('progress.weightOverTime')}>
        {weightHistory.length > 1 ? (
          <MiniChart data={weightHistory} dataKey="weight" color="#0891b2" />
        ) : (
          <EmptyNote text={t('progress.weightEmpty')} />
        )}
      </Section>

      <Section title={t('progress.loadTitle')}>
        {load?.series?.length > 1 ? (
          <div className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-card">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={load.series.filter((_, i) => i % 3 === 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#a3a3a3' }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tick={{ fontSize: 10, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="ctl" name="CTL" stroke="#0d9488" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="atl" name="ATL" stroke="#fb923c" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="tsb" name="TSB" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyNote text={t('progress.loadEmpty')} />
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
      {children}
    </div>
  );
}

function EmptyNote({ text }) {
  return <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-3 text-xs text-neutral-500">{text}</p>;
}

function MiniChart({ data, dataKey, color }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-card">
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 10, fontSize: 12 }} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
