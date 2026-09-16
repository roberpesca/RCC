import { parseCsv } from './csvParser.js';
import { estimateTss } from '../shared/tss.js';

const RIDE_TYPES = new Set(['ride', 'virtualride', 'gravelride', 'mountainbikeride', 'ebikeride', 'handcycle', 'velomobile']);

// Well-known non-cycling types, in English — a fast, confident "definitely skip"
// check. Not exhaustive; anything not on either list falls through to the
// watts-based heuristic below rather than being guessed at.
const NON_RIDE_TYPES = new Set([
  'run', 'trailrun', 'walk', 'hike', 'swim', 'workout', 'weighttraining', 'yoga',
  'alpineski', 'nordicski', 'snowboard', 'rowing', 'stairstepper', 'elliptical',
  'golf', 'inlineskate', 'iceskate', 'rockclimbing', 'kayaking', 'canoeing',
  'standuppaddling', 'surfing', 'windsurf', 'kitesurf', 'sail', 'skateboard',
  'soccer', 'tennis', 'badminton', 'squash', 'tabletennis', 'pickleball',
  'racquetball', 'wheelchair', 'crossfit', 'crosscountryskiing',
]);

// Strips accents before stripping non-alphanumerics, so "Vatios máximos" and a
// hypothetical accent-free "Vatios maximos" both normalize to "vatiosmaximos"
// instead of the accented version losing its "a" entirely.
function normalizeHeader(h) {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Strava's bulk-export activities.csv header names have shifted slightly over the
// years, AND — like the Activity Date/Type cell values (see parseDate and the type
// check below) — the header labels themselves follow the athlete's Strava display
// language, not just the data. So each field lists English variants plus a
// best-effort Spanish translation (Coach's other supported language); id/date/type
// are the fields that actually gate whether anything imports at all, and standard
// technical terms like these are the least likely translations to be wrong. A
// missed header on a secondary field (e.g. relative effort) just means that one
// column's data is unavailable, not that the import fails.
const FIELD_CANDIDATES = {
  id: ['activityid', 'id', 'iddeactividad'],
  date: ['activitydate', 'starttime', 'startdatelocal', 'startdate', 'date', 'fechadelaactividad', 'fecha'],
  name: ['activityname', 'name', 'nombredelaactividad', 'nombre'],
  type: ['activitytype', 'type', 'sporttype', 'tipodeactividad', 'tipo'],
  elapsedTime: ['elapsedtime', 'tiempotranscurrido'],
  movingTime: ['movingtime', 'tiempoenmovimiento', 'tiempoenmarcha'],
  distance: ['distance', 'distancia'],
  avgWatts: ['averagewatts', 'vatiospromedio', 'potenciapromedio', 'potenciamedia'],
  weightedAvgWatts: ['weightedaveragepower', 'weightedaveragewatts', 'potenciamediaponderada', 'potenciapromedioponderada'],
  maxWatts: ['maxwatts', 'vatiosmaximos', 'potenciamaxima'],
  avgHr: ['averageheartrate', 'frecuenciacardiacapromedio', 'frecuenciacardiacamedia'],
  maxHr: ['maxheartrate', 'frecuenciacardiacamaxima'],
  calories: ['calories', 'calorias'],
  elevationGain: ['elevationgain', 'desnivelpositivo', 'desnivelacumulado', 'elevacionganada'],
  relativeEffort: ['relativeeffort', 'perceivedrelativeeffort', 'esfuerzorelativo', 'esfuerzorelativopercibido'],
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

// Strava's CSV "Activity Date" column is rendered in the athlete's Strava display
// language (Settings > Display Preferences > Language), not always English — e.g.
// "5 sept 2026, 18:03:12" for a Spanish account. JS's Date() only understands
// English month names, so it silently fails to parse those rows, which used to mean
// the whole import came back "0 rides imported" for every non-English Strava
// account. Rather than requiring athletes to switch their Strava language just to
// import a spreadsheet, extract the pieces (time, year, month name, day) with
// targeted regexes and a small multi-language month lookup, independent of word
// order or separators.
const MONTH_LOOKUP = {
  jan: 1, january: 1, ene: 1, enero: 1, janv: 1, janvier: 1, gen: 1, gennaio: 1, januar: 1, janeiro: 1,
  feb: 2, february: 2, febr: 2, febrero: 2, fevr: 2, fevrier: 2, febbraio: 2, fevereiro: 2, februar: 2,
  mar: 3, march: 3, marzo: 3, mars: 3, marco: 3,
  apr: 4, april: 4, abr: 4, abril: 4, avr: 4, avril: 4, aprile: 4,
  may: 5, mayo: 5, mai: 5, maggio: 5, maio: 5,
  jun: 6, june: 6, junio: 6, juin: 6, giugno: 6, junho: 6, juni: 6,
  jul: 7, july: 7, julio: 7, juil: 7, juillet: 7, luglio: 7, julho: 7, juli: 7,
  aug: 8, august: 8, ago: 8, agosto: 8, aout: 8,
  sep: 9, sept: 9, september: 9, septiembre: 9, setiembre: 9, septembre: 9, settembre: 9, setembro: 9,
  oct: 10, october: 10, octubre: 10, octobre: 10, ottobre: 10, outubro: 10, oktober: 10,
  nov: 11, november: 11, noviembre: 11, novembre: 11, novembro: 11,
  dec: 12, december: 12, dic: 12, diciembre: 12, dec_fr: 12, decembre: 12, dicembre: 12, dezembro: 12, dezember: 12,
};

function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseDate(v) {
  if (!v) return null;
  const native = new Date(v);
  if (!Number.isNaN(native.getTime())) return native.toISOString();

  let rest = String(v).trim();

  const timeMatch = rest.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  let hour = 0, minute = 0, second = 0;
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    second = timeMatch[3] ? Number(timeMatch[3]) : 0;
    const ampm = timeMatch[4]?.toUpperCase();
    if (ampm === 'AM' && hour === 12) hour = 0;
    if (ampm === 'PM' && hour < 12) hour += 12;
    rest = rest.replace(timeMatch[0], ' ');
  }

  const yearMatch = rest.match(/\b(20\d{2}|19\d{2})\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);
  rest = rest.replace(yearMatch[0], ' ');

  const wordMatch = rest.match(/\p{L}+/u);
  if (!wordMatch) return null;
  const month = MONTH_LOOKUP[stripDiacritics(wordMatch[0].toLowerCase())];
  if (!month) return null;
  rest = rest.replace(wordMatch[0], ' ');

  const dayMatch = rest.match(/\b(\d{1,2})\b/);
  if (!dayMatch) return null;
  const day = Number(dayMatch[1]);

  const d = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
    if (typeNorm && !RIDE_TYPES.has(typeNorm)) {
      if (NON_RIDE_TYPES.has(typeNorm)) {
        skipped++;
        continue; // confidently a run/swim/etc.
      }
      // Unrecognized type string — likely a non-English Strava display language
      // (Strava's CSV "Activity Type" column, like the date column, follows the
      // athlete's language setting, so "Ride" might arrive as "Salida en bici" or
      // similar). Rather than guess translations for every language, fall back to
      // a locale-independent signal: a power reading is something runs, walks, and
      // swims essentially never have, while most cyclists using a coaching app do.
      const wattsRaw = headerIndex.avgWatts ? row[headerIndex.avgWatts] : null;
      const hasWatts = wattsRaw !== null && wattsRaw !== undefined && wattsRaw !== '' && num(wattsRaw) !== null;
      if (!hasWatts) {
        skipped++;
        continue;
      }
    }

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
