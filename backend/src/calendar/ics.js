// Renders the athlete's active training plan as an RFC 5545 .ics feed, so planned
// (and completed) sessions show up in Google Calendar, Apple Calendar, or any app
// that can subscribe to a calendar URL. Rest days are skipped — nobody wants a daily
// "Rest" entry cluttering their calendar.
import { db } from '../db.js';
import { DEFAULT_LANG, tWorkout, tSegmentNote, tSystem } from '../i18n/translations.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIcsDate(dateStr) {
  return dateStr.replace(/-/g, '');
}

function addOneDayIcs(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

// Escapes TEXT-type values per RFC 5545 §3.3.11 — backslash and the three
// structural punctuation characters, plus turning real newlines into the literal
// two-character sequence \n (not an actual line break, which would corrupt the feed).
function escapeIcsText(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// RFC 5545 §3.1 content lines must be folded at 75 octets; continuation lines start
// with a single space. Good enough for the ASCII-range content this feed produces.
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export function buildIcsForUser(userId, lang = DEFAULT_LANG) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Coach//Training Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(tSystem(lang, 'appName') || 'Coach')}`,
  ];

  const plan = db.prepare(`SELECT * FROM plans WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`).get(userId);

  if (plan) {
    const workouts = db
      .prepare(`SELECT * FROM plan_workouts WHERE plan_id = ? AND workout_key IS NOT NULL AND workout_key != 'rest' ORDER BY day_date ASC`)
      .all(plan.id);

    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(
      now.getUTCMinutes()
    )}${pad(now.getUTCSeconds())}Z`;

    for (const w of workouts) {
      const text = tWorkout(w.workout_key, lang);
      let structure = [];
      try {
        structure = JSON.parse(w.structure_json || '[]');
      } catch {
        // malformed structure — just omit the segment breakdown below
      }
      const structureLines = structure.map((s) => {
        const note = tSegmentNote(s.note, lang) || s.note || '';
        return `${s.minutes}min @ ${Math.round((s.ifLow ?? 0) * 100)}-${Math.round((s.ifHigh ?? 0) * 100)}% FTP (${note})`;
      });
      const statusLabel = w.status === 'completed' ? 'Completed' : w.status === 'missed' ? 'Missed' : 'Planned';
      const description = [
        text.description || '',
        '',
        `${statusLabel} — ${w.planned_duration_min || 0} min — ${Math.round(w.planned_tss || 0)} TSS`,
        ...structureLines,
      ]
        .filter((l) => l !== undefined && l !== null)
        .join('\n');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:workout-${w.id}@coach-app`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(w.day_date)}`);
      lines.push(`DTEND;VALUE=DATE:${addOneDayIcs(w.day_date)}`);
      lines.push(`SUMMARY:${escapeIcsText(text.title)}`);
      lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
