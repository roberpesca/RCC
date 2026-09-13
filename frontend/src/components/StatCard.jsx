export default function StatCard({ label, value, sub, accent = 'text-neutral-900' }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}
