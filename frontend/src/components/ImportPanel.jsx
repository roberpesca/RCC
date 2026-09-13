import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { IconUpload } from './icons.jsx';
import { todayStr } from '../utils/dates.js';

function ResultBanner({ result, error, t }) {
  if (error) return <p className="mt-2 text-sm text-rose-600">{error}</p>;
  if (!result) return null;
  const parts = [];
  if (typeof result.imported === 'number') parts.push(t('importPanel.rowsImported', result.imported));
  if (result.skipped) parts.push(t('importPanel.rowsSkipped', result.skipped));
  if (result.newFtp) parts.push(t('importPanel.ftpUpdated', result.newFtp));
  if (result.activity) parts.push(`"${result.activity.name}" — ${result.activity.tss_estimate} TSS`);
  return <p className="mt-2 text-sm font-medium text-brand-700">{parts.join(' · ') || t('importPanel.done')}</p>;
}

export default function ImportPanel({ onImported }) {
  const { t } = useApp();
  const SOURCE_LABEL = {
    strava_api: t('importPanel.sourceLive'),
    csv_import: t('importPanel.sourceCsv'),
    gpx_import: t('importPanel.sourceGpx'),
    tcx_import: t('importPanel.sourceTcx'),
    manual: t('importPanel.sourceManual'),
  };

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState(null);

  const [fileBusy, setFileBusy] = useState(false);
  const [fileResult, setFileResult] = useState(null);
  const [fileError, setFileError] = useState(null);

  const [manualBusy, setManualBusy] = useState(false);
  const [manualResult, setManualResult] = useState(null);
  const [manualError, setManualError] = useState(null);
  const [manual, setManual] = useState({ date: todayStr(), type: 'Ride', title: '', durationMin: '', distanceKm: '', avgWatts: '', avgHr: '', rpe: '' });

  const [recent, setRecent] = useState([]);
  const bulkInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadRecent = async () => {
    try {
      const rows = await api.getImportedActivities(8);
      setRecent(rows);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const afterImport = async () => {
    await loadRecent();
    onImported?.();
  };

  const handleBulkFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const isZip = /\.zip$/i.test(file.name);
      const result = isZip ? await api.importZip(file) : await api.importCsv(file);
      setBulkResult(result);
      await afterImport();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkBusy(false);
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    }
  };

  const handleActivityFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileBusy(true);
    setFileError(null);
    setFileResult(null);
    try {
      const result = await api.importActivityFile(file);
      setFileResult(result);
      await afterImport();
    } catch (err) {
      setFileError(err.message);
    } finally {
      setFileBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submitManual = async (e) => {
    e.preventDefault();
    if (!manual.durationMin) return;
    setManualBusy(true);
    setManualError(null);
    setManualResult(null);
    try {
      const result = await api.importManual({
        date: manual.date,
        type: manual.type,
        title: manual.title || undefined,
        durationMin: Number(manual.durationMin),
        distanceKm: manual.distanceKm ? Number(manual.distanceKm) : undefined,
        avgWatts: manual.avgWatts ? Number(manual.avgWatts) : undefined,
        avgHr: manual.avgHr ? Number(manual.avgHr) : undefined,
        rpe: manual.rpe ? Number(manual.rpe) : undefined,
      });
      setManualResult(result);
      setManual((m) => ({ ...m, title: '', durationMin: '', distanceKm: '', avgWatts: '', avgHr: '', rpe: '' }));
      await afterImport();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualBusy(false);
    }
  };

  const input = 'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-500';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
        <div className="text-sm font-semibold text-neutral-900">{t('importPanel.step1Title')}</div>
        <p className="mt-1 text-xs text-neutral-500">
          {t('importPanel.step1Desc1')} <span className="text-neutral-700">{t('importPanel.step1Desc2')}</span>{' '}
          {t('importPanel.step1Desc3')} <code className="text-neutral-700">activities.csv</code> {t('importPanel.step1Desc4')}
        </p>
        <label className="mt-3 block">
          <input ref={bulkInputRef} type="file" accept=".zip,.csv" onChange={handleBulkFile} disabled={bulkBusy} className="hidden" />
          <span className="flex items-center justify-center gap-2 rounded-full bg-brand-600 py-2.5 text-center text-sm font-semibold text-white shadow-pop cursor-pointer">
            <IconUpload />
            {bulkBusy ? t('importPanel.importing') : t('importPanel.uploadArchive')}
          </span>
        </label>
        <ResultBanner result={bulkResult} error={bulkError} t={t} />
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
        <div className="text-sm font-semibold text-neutral-900">{t('importPanel.step2Title')}</div>
        <p className="mt-1 text-xs text-neutral-500">
          {t('importPanel.step2Desc1')} <span className="text-neutral-700">{t('importPanel.step2Desc2')}</span>
          {t('importPanel.step2Desc3')} <code className="text-neutral-700">/export_tcx</code> {t('importPanel.step2Desc4')}
        </p>
        <label className="mt-3 block">
          <input ref={fileInputRef} type="file" accept=".gpx,.tcx" onChange={handleActivityFile} disabled={fileBusy} className="hidden" />
          <span className="block cursor-pointer rounded-full border border-neutral-200 py-2.5 text-center text-sm font-medium text-neutral-700">
            {fileBusy ? t('importPanel.importing') : t('importPanel.uploadRide')}
          </span>
        </label>
        <ResultBanner result={fileResult} error={fileError} t={t} />
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
        <div className="text-sm font-semibold text-neutral-900">{t('importPanel.step3Title')}</div>
        <p className="mt-1 text-xs text-neutral-500">{t('importPanel.step3Desc')}</p>
        <form onSubmit={submitManual} className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={input} value={manual.date} onChange={(e) => setManual((m) => ({ ...m, date: e.target.value }))} />
            <select className={input} value={manual.type} onChange={(e) => setManual((m) => ({ ...m, type: e.target.value }))}>
              <option value="Ride">{t('importPanel.typeRide')}</option>
              <option value="VirtualRide">{t('importPanel.typeVirtual')}</option>
              <option value="GravelRide">{t('importPanel.typeGravel')}</option>
            </select>
          </div>
          <input className={input} placeholder={t('importPanel.titlePlaceholder')} value={manual.title} onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className={input} type="number" placeholder={t('importPanel.durationPlaceholder')} value={manual.durationMin} onChange={(e) => setManual((m) => ({ ...m, durationMin: e.target.value }))} required />
            <input className={input} type="number" step="0.1" placeholder={t('importPanel.distancePlaceholder')} value={manual.distanceKm} onChange={(e) => setManual((m) => ({ ...m, distanceKm: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className={input} type="number" placeholder={t('importPanel.avgWattsPlaceholder')} value={manual.avgWatts} onChange={(e) => setManual((m) => ({ ...m, avgWatts: e.target.value }))} />
            <input className={input} type="number" placeholder={t('importPanel.avgHrPlaceholder')} value={manual.avgHr} onChange={(e) => setManual((m) => ({ ...m, avgHr: e.target.value }))} />
            <input className={input} type="number" min="1" max="10" placeholder={t('importPanel.rpePlaceholder')} value={manual.rpe} onChange={(e) => setManual((m) => ({ ...m, rpe: e.target.value }))} />
          </div>
          <button type="submit" disabled={manualBusy} className="w-full rounded-full border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 disabled:opacity-50">
            {manualBusy ? t('importPanel.saving') : t('importPanel.addRide')}
          </button>
        </form>
        <ResultBanner result={manualResult} error={manualError} t={t} />
      </div>

      {recent.length > 0 && (
        <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
          <div className="mb-2 text-sm font-semibold text-neutral-900">{t('importPanel.recentlyAdded')}</div>
          <div className="space-y-1.5">
            {recent.map((a) => (
              <div key={a.id} className="flex items-center justify-between font-mono text-xs">
                <span className="truncate text-neutral-700">{a.name}</span>
                <span className="ml-2 shrink-0 text-neutral-400">
                  {a.start_date?.slice(0, 10)} · {a.tss_estimate ?? '—'} TSS · {SOURCE_LABEL[a.source] || a.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
