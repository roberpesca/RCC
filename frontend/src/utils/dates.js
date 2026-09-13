// Formats a Date as a local-calendar YYYY-MM-DD string.
//
// Don't use `date.toISOString().slice(0, 10)` for "today" or date-picker defaults:
// toISOString() converts to UTC first, so anyone in a timezone ahead of UTC (Spain
// included) can get yesterday's or tomorrow's date instead of today's, especially
// near midnight. This reads the Date object's own local fields instead.
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return localDateStr(new Date());
}
