// Shared Training Stress Score estimation, used regardless of where an activity's data
// came from (live Strava API sync, a Strava bulk-export CSV import, or manual entry).
//
// Power-based (most accurate): TSS = (seconds * NP * IF) / (FTP * 3600) * 100
// HR/effort fallback: Strava's "suffer_score" / Relative Effort tracks TSS reasonably
// well for a rider with well-set HR zones, so we use it directly when power is absent.
// Last-resort fallback: assume a moderate intensity factor for the ride duration.
export function computeTss({ weightedAvgWatts, avgWatts, movingTimeS, sufferScore }, ftp) {
  const np = weightedAvgWatts || avgWatts;
  if (np && ftp) {
    const ifactor = np / ftp;
    const hours = (movingTimeS || 0) / 3600;
    return { tss: Math.round(hours * ifactor * ifactor * 100), method: 'power' };
  }
  if (typeof sufferScore === 'number' && !Number.isNaN(sufferScore)) {
    return { tss: Math.round(sufferScore), method: 'suffer_score' };
  }
  const hours = (movingTimeS || 0) / 3600;
  const assumedIF = 0.65;
  return { tss: Math.round(hours * assumedIF * assumedIF * 100), method: 'duration_estimate' };
}
