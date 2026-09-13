import { parseCsv } from './csvParser.js';
import { estimateTss } from '../shared/tss.js';

const RIDE_TYPES = new Set(['ride', 'virtualride', 'gravelride', 'mountainbikeride', 'ebikeride', 'handcycle', 'velomobile']);

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Strava's bulk-export activities.csv header names have shifted slightly over the
// years, so we match on a normalized (lowercased, punctuation-stripped) header and
// accept several known variants for each field rather than one exact string.
const FIELD_CANDIDATES = {
  id: ['activityid', 'id'],
  date: ['activitydate', 'starttime', 'startdatelocal', 'startdate', 'date'],
  name: ['activityname', 'name'],
  type: ['activitytype', 'type', 'sporttype'],
  elapsedTime: ['elapsedtime'],
  movingTime: ['movingtime'],
  distance: ['distance'],
  avgWatts: ['averagewatts'],
  weightedAvgWatts: ['weightedaveragepower', 'weightedaveragewatts'],
  maxWatts: ['maxwatts'],
  avgHr: ['averageheartrate'],
  maxHr: ['maxheartrate'],
  calories: ['calories'],
  elevationGain: ['elevationgain'],
  relativeEffort: ['relativeeffort', 'perceivedrelativeeffort'],
};

function buildHeaderIndex(sampleRow) {
  const keys = Object.keys(sampleRow);
  const normalizedToOriginal = new Map();
  for (const k of keys) {
    const norm = normalizeHeader(k);
    if (!normalizedToOriginal.has(norm)) normalizedToOriginal.set(norm, k);
  }
  const resolved = {};
  for (const [field, candidates] of Object.entries(FIELD_CANDIDATES)) {
    for (const c of candidates) {
      if (normalizedToOriginal.has(c)) {
        resolved[field] = normalizedToOriginal.get(c);
        break;
      }
    }
  }
  return resolved;
}

function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Time fields are seconds in Strava's export, but be defensive in case a locale
// variant hands us "hh:mm:ss" formatted text instead.
function parseSeconds(v) {
  if (v === undefined || v === null || v === '') return null;
  const str = String(v).trim();
  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    if (parts.some(Number.isNaN)) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  return num(str);
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  // Strava sometimes formats as "Jan 5, 2026, 6:03:12 AM" — Date() usually handles
  // this in Node, but fall back to null (row gets skipped) if it truly can't parse.
  return null;
}

// Distance/elevation units follow the athlete's Strava display preference (km/m for
// metric accounts, miles/ft for imperial) — unlike time/power/HR/effort, which are
// always seconds/watts/bpm/unitless regardless of preference. We only use distance
// for display, never for training-load math, so we convert using the app's own
// Settings > units preference as a best-effort guess.
function toMeters(value, units) {
  if (value === null) return null;
  return units === 'imperial' ? value * 1609.344 : value * 1000;
}

export function parseStravaActivitiesCsv(csvText, { units = 'metric', ftp = 200 } = {}) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return { activities: [], skipped: 0, total: 0 };

  const headerIndex = buildHeaderIndex(rows[0]);
  const activities = [];
  let skipped = 0;

  for (const row of rows) {
    const typeRaw = headerIndex.type ? row[headerIndex.type] : '';
    const typeNorm = (typeRaw || '').toLowerCase().replace(/[^a-z]/g, '');
    if (typeNorm && !RIDE_TYPES.has(typeNorm)) continue; // skip runs/swims/etc.

    const idRaw = headerIndex.id ? row[headerIndex.id] : null;
    const id = num(idRaw);
    const dateIso = headerIndex.date ? parseDate(row[headerIndex.date]) : null;
    if (!id || !dateIso) {
      skipped++;
      continue;
    }

    const movingTimeS = headerIndex.movingTime ? parseSeconds(row[headerIndex.movingTime]) : null;
    const elapsedTimeS = headerIndex.elapsedTime ? parseSeconds(row[headerIndex.elapsedTime]) : movingTimeS;
    const avgWatts = headerIndex.avgWatts ? num(row[headerIndex.avgWatts]) : null;
    const weightedAvgWatts = headerIndex.weightedAvgWatts ? num(row[headerIndex.weightedAvgWatts]) : null;
    const relativeEffort = headerIndex.relativeEffort ? num(row[headerIndex.relativeEffort]) : null;
    const distanceRaw = headerIndex.distance ? num(row[headerIndex.distance]) : null;
    const elevationRaw = headerIndex.elevationGain ? num(row[headerIndex.elevationGain]) : null;

    const activityLike = {
      average_watts: avgWatts,
      weighted_average_watts: weightedAvgWatts,
      suffer_score: relativeEffort,
      moving_time: movingTimeS || elapsedTimeS || 0,
    };
    const { tss, method } = estimateTss(activityLike, ftp);

    activities.push({
      id,
      start_date: dateIso,
      type: typeRaw || 'Ride',
      name: (headerIndex.name ? row[headerIndex.name] : '') || 'Ride',
      distance_m: toMeters(distanceRaw, units),
      moving_time_s: movingTimeS,
      elapsed_time_s: elapsedTimeS,
      avg_watts: avgWatts,
      weighted_avg_watts: weightedAvgWatts,
      max_watts: headerIndex.maxWatts ? num(row[headerIndex.maxWatts]) : null,
      avg_hr: headerIndex.avgHr ? num(row[headerIndex.avgHr]) : null,
      max_hr: headerIndex.maxHr ? num(row[headerIndex.maxHr]) : null,
      kilojoules: headerIndex.calories ? num(row[headerIndex.calories]) : null,
      suffer_score: relativeEffort,
      total_elevation_gain: units === 'imperial' ? (elevationRaw !== null ? elevationRaw * 0.3048 : null) : elevationRaw,
      tss_estimate: tss,
      tss_method: method,
      source: 'csv_import',
    });
  }

  return { activities, skipped, total: rows.length, matchedFields: Object.keys(headerIndex) };
}
