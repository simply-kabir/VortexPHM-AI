export default function KpiTile({ label, value, foot, loading }: { label: string; value: string; foot: string; loading?: boolean }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="text-xs text-fg-2">{label}</div>
      {loading ? <div className="mt-2 h-8 w-24 animate-pulse rounded bg-elevated" /> : <div className="num mt-1 text-3xl font-semibold">{value}</div>}
      <div className="mt-1 text-[11px] text-fg-3">{foot}</div>
    </div>
  );
}
