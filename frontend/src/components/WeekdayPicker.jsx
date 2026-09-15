import { useApp } from '../context/AppContext.jsx';

// Mon=0 .. Sun=6, matching the backend's weekday numbering (see scheduler.js).
const KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// A row of 7 toggle pills for picking which weekdays the athlete can train.
// `value` is an array of ints 0-6 (Mon..Sun); at least one day always stays selected.
export default function WeekdayPicker({ value, onChange }) {
  const { t } = useApp();
  const selected = new Set(value);

  const toggle = (day) => {
    const next = new Set(selected);
    if (next.has(day)) {
      if (next.size === 1) return; // keep at least one day available
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange([...next].sort((a, b) => a - b));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {KEYS.map((key, day) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(day)}
          className={`h-10 w-10 rounded-full text-xs font-semibold transition-colors ${
            selected.has(day) ? 'bg-brand-600 text-white shadow-pop' : 'bg-neutral-100 text-neutral-400'
          }`}
        >
          {t(`weekday.${key}`)}
        </button>
      ))}
    </div>
  );
}
