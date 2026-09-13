// Formats a Date as a local-calendar YYYY-MM-DD string.
//
// IMPORTANT: don't use `date.toISOString().slice(0, 10)` for this. toISOString()
// always converts to UTC first, so for anyone in a timezone ahead of UTC (Spain
// included, UTC+1/+2), local midnight of a chosen date rolls back into the
// *previous* UTC day — every date-only computation (plan start dates, "today",
// week-ahead nutrition dates) silently ends up one day earlier than intended.
// This formats from the Date object's own local fields instead, so what you see
// is what you get, regardless of server/browser timezone.
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return localDateStr(new Date());
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
