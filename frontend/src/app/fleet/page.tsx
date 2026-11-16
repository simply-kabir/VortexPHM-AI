"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/shell/AppShell";
import KpiTile from "@/components/fleet/KpiTile";
import TierBadge from "@/components/fleet/TierBadge";
import { faultLabel, getJSON, usd, type AuditRow, type FleetRow } from "@/lib/api";

export default function FleetPage() {
  const [frac, setFrac] = useState(0.75);
  const [rows, setRows] = useState<FleetRow[] | null>(null);
  const [err, setErr] = useState("");
  const [recent, setRecent] = useState<AuditRow[]>([]);

  useEffect(() => {
    setErr("");
    const id = setTimeout(() => getJSON<FleetRow[]>(`/decision/triage-queue?frac=${frac}`).then(setRows).catch((e) => setErr(String(e.message ?? e))), 120);
    return () => clearTimeout(id);
  }, [frac]);
  useEffect(() => { getJSON<AuditRow[]>("/audit?limit=5").then(setRecent).catch(() => undefined); }, []);

  const k = useMemo(() => {
    if (!rows || !rows.length) return null;
    const mean = rows.reduce((a, r) => a + r.urgency.index, 0) / rows.length;
    const sorted = [...rows].sort((a, b) => a.rul - b.rul);
    return {
      health: 100 - mean,
      t1: rows.filter((r) => r.urgency.tier === 1).length,
      t2: rows.filter((r) => r.urgency.tier === 2).length,
      risk: rows.reduce((a, r) => a + r.cost.expected_cost_defer, 0),
      medRul: sorted[Math.floor(sorted.length / 2)].rul,
      dist: [1, 2, 3].map((t) => rows.filter((r) => r.urgency.tier === t).length),
    };
  }, [rows]);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Fleet board</h1>
      <p className="mt-1 text-sm text-fg-2">Engines ranked by urgency at the selected point in their life (replayed N-CMAPSS test engines).</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {k ? (
          <>
            <KpiTile label="Fleet health index" value={k.health.toFixed(0)} foot="100 minus mean urgency" />
            <KpiTile label="Active alerts" value={`${k.t1} / ${k.t2}`} foot="Tier 1 / Tier 2 engines" />
            <KpiTile label="Cost at risk" value={usd(k.risk)} foot="Σ P(fail in horizon) × UER cost (assumption-based)" />
            <KpiTile label="Median RUL" value={`${k.medRul.toFixed(0)} cyc`} foot="across monitored engines" />
          </>
        ) : (
          <>
            <KpiTile loading label="Fleet health index" value="–" foot="100 minus mean urgency" />
            <KpiTile loading label="Active alerts" value="–" foot="Tier 1 / Tier 2 engines" />
            <KpiTile loading label="Cost at risk" value="–" foot="Σ P(fail in horizon) × UER cost (assumption-based)" />
            <KpiTile loading label="Median RUL" value="–" foot="across monitored engines" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <section aria-label="Priority maintenance queue" className="rounded-card border border-line bg-surface shadow-card">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">Priority maintenance queue</div>
          {err ? (
            <div className="p-4 text-sm text-crit">Could not reach the API: {err}. Is the backend running at the configured URL?</div>
          ) : !rows ? (
            <div className="space-y-2 p-4">
              <div key="skel-0" className="h-14 animate-pulse rounded bg-elevated" />
              <div key="skel-1" className="h-14 animate-pulse rounded bg-elevated" />
              <div key="skel-2" className="h-14 animate-pulse rounded bg-elevated" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-fg-2">No engines loaded. Run <code className="num">python -m scripts.export_serving</code> first.</div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.engine_id} className="border-b border-line last:border-0">
                  <Link href={`/engine/${encodeURIComponent(r.engine_id)}`} className="grid grid-cols-[110px_1fr_auto] items-center gap-4 px-4 py-3 transition-colors duration-fast hover:bg-elevated sm:grid-cols-[130px_70px_1fr_110px_auto]">
                    <TierBadge tier={r.urgency.tier} short />
                    <span className="num text-2xl font-semibold">{r.urgency.index.toFixed(0)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.engine_id}</span>
                      <span className="block truncate text-xs text-fg-2">{faultLabel(r.fault_class)}{r.amm[0] ? ` · ${r.amm[0].code}` : ""}</span>
                    </span>
                    <span className="num hidden text-sm text-fg-2 sm:block">RUL {r.rul.toFixed(0)}</span>
                    <span className="text-xs font-medium text-brand">Open cockpit →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Fleet time</h2>
            <input aria-label="Fleet time as percent of engine life" type="range" min={0.05} max={1} step={0.05} value={frac} onChange={(e) => setFrac(+e.target.value)} className="mt-3 w-full accent-[rgb(var(--brand-graphic))]" />
            <div className="num mt-1 text-sm text-fg-2">{Math.round(frac * 100)}% of life</div>
          </div>
          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Tier distribution</h2>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-elevated" role="img" aria-label="Tier distribution">
              {k && [["crit", k.dist[0]], ["warn", k.dist[1]], ["ok", k.dist[2]]].map(([c, n]) => (n as number) > 0 && <div key={c as string} style={{ flex: n as number, background: `rgb(var(--${c}-fill))` }} />)}
            </div>
            <div className="num mt-2 text-xs text-fg-2">{k ? `${k.dist[0]} critical · ${k.dist[1]} elevated · ${k.dist[2]} monitor` : "–"}</div>
          </div>
          <div className="rounded-card border border-line bg-surface p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Recent decisions</h2><Link href="/audit" className="text-xs text-brand">All →</Link></div>
            <ul className="mt-3 space-y-2 text-xs">
              {recent.length === 0 && <li className="text-fg-3">No decisions yet.</li>}
              {recent.map((a) => <li key={a.id} className="num text-fg-2">#{a.id} {a.action} {a.engine_id}</li>)}
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
