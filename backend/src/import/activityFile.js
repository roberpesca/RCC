import { estimateTss } from '../shared/tss.js';

// Deterministic hash -> stable synthetic ID, always negative so it can never collide
// with a real (always-positive) Strava activity ID coming from a CSV/API import.
// Re-uploading the exact same file therefore updates the same row instead of
// creating a duplicate.
function hashToNegativeId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return -Math.abs(h);
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function tagValue(block, tag) {
  const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)<\\/(?:\\w+:)?${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function extractBlocks(xml, tagName) {
  const re = new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>[\\s\\S]*?<\\/(?:\\w+:)?${tagName}>`, 'gi');
  return xml.match(re) || [];
}

function parseGpx(xml, filename) {
  const points = extractBlocks(xml, 'trkpt').map((block) => {
    const latMatch = block.match(/lat="(-?\d+\.?\d*)"/i);
    const lonMatch = block.match(/lon="(-?\d+\.?\d*)"/i);
    return {
      lat: latMatch ? Number(latMatch[1]) : null,
      lon: lonMatch ? Number(lonMatch[1]) : null,
      ele: numOrNull(tagValue(block, 'ele')),
      time: tagValue(block, 'time'),
      hr: numOrNull(tagValue(block, 'hr')),
      watts: numOrNull(tagValue(block, 'power') || tagValue(block, 'watts')),
    };
  }).filter((p) => p.time);

  const nameMatch = xml.match(/<name>([^<]*)<\/name>/i);
  return buildFromPoints(points, {
    name: nameMatch ? nameMatch[1].trim() : null,
    filename,
    distanceFromPoints: true,
  });
}

function parseTcx(xml, filename) {
  const points = extractBlocks(xml, 'Trackpoint').map((block) => {
    const latMatch = block.match(/<LatitudeDegrees>(-?\d+\.?\d*)<\/LatitudeDegrees>/i);
    const lonMatch = block.match(/<LongitudeDegrees>(-?\d+\.?\d*)<\/LongitudeDegrees>/i);
    return {
      lat: latMatch ? Number(latMatch[1]) : null,
      lon: lonMatch ? Number(lonMatch[1]) : null,
      ele: numOrNull(tagValue(block, 'AltitudeMeters')),
      time: tagValue(block, 'Time'),
      hr: numOrNull(tagValue(block, 'Value')), // HeartRateBpm > Value
      watts: numOrNull(tagValue(block, 'Watts')),
      cumulativeDistance: numOrNull(tagValue(block, 'DistanceMeters')),
    };
  }).filter((p) => p.time);

  const sportMatch = xml.match(/<Activity[^>]*Sport="([^"]+)"/i);
  const type = sportMatch ? mapTcxSport(sportMatch[1]) : 'Ride';

  return buildFromPoints(points, {
    name: null,
    filename,
    type,
    distanceFromPoints: false,
  });
}

function mapTcxSport(sport) {
  const s = sport.toLowerCase();
  if (s.includes('bik')) return 'Ride';
  if (s.includes('run')) return 'Run';
  return 'Ride';
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildFromPoints(points, { name, filename, type = 'Ride', distanceFromPoints }) {
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const startMs = Date.parse(first.time);
  const endMs = Date.parse(last.time);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
  const elapsedS = Math.round((endMs - startMs) / 1000);

  let distance = 0;
  let elevGain = 0;
  const hrs = [];
  const watts = [];
  let prevEle = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.hr !== null) hrs.push(p.hr);
    if (p.watts !== null) watts.push(p.watts);
    if (p.ele !== null) {
      if (prevEle !== null && p.ele > prevEle) elevGain += p.ele - prevEle;
      prevEle = p.ele;
    }
    if (distanceFromPoints && i > 0) {
      const prev = points[i - 1];
      if (prev.lat !== null && prev.lon !== null && p.lat !== null && p.lon !== null) {
        distance += haversineMeters(prev.lat, prev.lon, p.lat, p.lon);
      }
    } else if (!distanceFromPoints && p.cumulativeDistance !== null) {
      distance = p.cumulativeDistance; // TCX gives cumulative distance directly
    }
  }

  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
  const maxHr = hrs.length ? Math.max(...hrs) : null;
  const avgWatts = watts.length ? Math.round(watts.reduce((a, b) => a + b, 0) / watts.length) : null;
  const maxWatts = watts.length ? Math.max(...watts) : null;

  return {
    id: hashToNegativeId(`${filename}|${first.time}|${points.length}`),
    start_date: new Date(startMs).toISOString(),
    type,
    name: name || filename.replace(/\.[a-z0-9]+$/i, ''),
    distance_m: distance || null,
    moving_time_s: elapsedS,
    elapsed_time_s: elapsedS,
    avg_watts: avgWatts,
    weighted_avg_watts: null, // true normalized power needs a 30s rolling average we don't compute here
    max_watts: maxWatts,
    avg_hr: avgHr,
    max_hr: maxHr,
    kilojoules: null,
    suffer_score: null,
    total_elevation_gain: Math.round(elevGain) || null,
  };
}

export function parseActivityFile(xmlText, filename, ftp = 200, userId) {
  const isTcx = /<TrainingCenterDatabase/i.test(xmlText) || /\.tcx$/i.test(filename);
  const parsed = isTcx ? parseTcx(xmlText, filename) : parseGpx(xmlText, filename);
  if (!parsed) return null;

  const { tss, method } = estimateTss(
    { average_watts: parsed.avg_watts, weighted_average_watts: parsed.weighted_avg_watts, suffer_score: parsed.suffer_score, moving_time: parsed.moving_time_s },
    ftp
  );
  return {
    ...parsed,
    // Re-namespaced by user id (on top of the file/timestamp hash already computed in
    // buildFromPoints) so two athletes uploading the exact same shared-ride file can't
    // collide with each other's rows.
    id: hashToNegativeId(`${userId}|${parsed.id}`),
    tss_estimate: tss,
    tss_method: method,
    source: isTcx ? 'tcx_import' : 'gpx_import',
  };
}
