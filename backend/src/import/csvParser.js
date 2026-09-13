// Minimal RFC4180-ish CSV parser (handles quoted fields, embedded commas/newlines,
// and "" escaped quotes). Strava's export CSVs are well-formed enough that we don't
// need a full spec-compliant parser, but activity names often contain commas and
// occasionally quotes, so a naive split(',') would break on real data.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // Normalize line endings up front so \r\n inside/outside quotes behaves the same.
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((cell) => cell !== ''))
    .map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? '';
      });
      return obj;
    });
}
