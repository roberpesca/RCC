// Small hand-drawn line icons (no external icon package) — used in the nav bar and a
// few action buttons so the app reads as a designed product rather than emoji-and-text.
// All share the same stroke conventions so they sit consistently at any size.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconHome({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function IconBike({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M5.5 17.5 10 8h4l3 5.5" />
      <path d="M10 8 8.5 11h6.5" />
      <path d="M12 8l1.5-2.5H16" />
    </svg>
  );
}

export function IconFork({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M7 2v7a2 2 0 0 0 2 2v11" />
      <path d="M7 2v5M9.5 2v5" />
      <path d="M17 2c-2 0-3 2-3 5s1 4 3 4v11" />
    </svg>
  );
}

export function IconTrendingUp({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 17l6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </svg>
  );
}

export function IconSettings({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v3M12 18v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M3 12h3M18 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1" />
    </svg>
  );
}

export function IconUpload({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function IconRefresh({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
