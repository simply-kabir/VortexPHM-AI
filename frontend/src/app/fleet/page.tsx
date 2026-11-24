"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import FlightLineRibbon from "@/components/fleet/FlightLineRibbon";
import TierBadge from "@/components/fleet/TierBadge";
import AddEngineModal from "@/components/fleet/AddEngineModal";
import { faultLabel, getJSON, type AuditRow, type FleetRow } from "@/lib/api";

export default function FleetPage() {
  const [frac, setFrac] = useState(0.75);
  const [rows, setRows] = useState<FleetRow[] | null>(null);
  const [err, setErr] = useState("");
  const [recent, setRecent] = useState<AuditRow[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTier, setActiveTier] = useState<number | null>(null);

  const loadFleet = useCallback(() => {
    setErr("");
    getJSON<FleetRow[]>(`/decision/triage-queue?frac=${frac}`)
      .then(setRows)
      .catch((e) => setErr(String(e.message ?? e)));
  }, [frac]);

  useEffect(() => {
    const id = setTimeout(loadFleet, 120);
    return () => clearTimeout(id);
  }, [loadFleet]);

  useEffect(() => {
    getJSON<AuditRow[]>("/audit?limit=5").then(setRecent).catch(() => undefined);
  }, []);

  // Filtered rows based on interactive tier ribbon selection
  const displayedRows = useMemo(() => {
    if (!rows) return null;
    if (activeTier === null) return rows;
    return rows.filter((r) => r.urgency.tier === activeTier);
  }, [rows, activeTier]);

  const k = useMemo(() => {
    if (!rows || !rows.length) return null;
    return {
      t1: rows.filter((r) => r.urgency.tier === 1).length,
      t2: rows.filter((r) => r.urgency.tier === 2).length,
      dist: [1, 2, 3].map((t) => rows.filter((r) => r.urgency.tier === t).length),
    };
  }, [rows]);

  return (
    <AppShell>
      {/* Top Header with Commission Engine Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Fleet board</h1>
          <p className="mt-1 text-sm text-fg-2">
            Commercial aero-engine health management and priority airworthiness triage (NASA N-CMAPSS fleet).
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-xs font-semibold text-brand-on hover:bg-brand-hover shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Commission Engine</span>
        </button>
      </div>

      {/* Flight-Line Dispatch & Airworthiness Ribbon (Replaces the 4 generic KPI tiles) */}
      <FlightLineRibbon
        rows={rows}
        loading={!rows && !err}
        activeTier={activeTier}
        onSelectTier={setActiveTier}
      />

      {/* Main Content Layout: Priority Maintenance Queue & Fleet Controls */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left: Priority Maintenance Queue */}
        <section aria-label="Priority maintenance queue" className="rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Priority maintenance queue</span>
              {activeTier !== null && (
                <span className="inline-flex items-center gap-1 rounded bg-elevated border border-line px-2 py-0.5 text-xs text-brand font-medium">
                  Filtered: Tier {activeTier}
                  <button
                    onClick={() => setActiveTier(null)}
                    className="hover:text-fg ml-0.5"
                    title="Clear filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            {displayedRows && (
              <span className="text-xs font-mono text-fg-3">
                Showing {displayedRows.length} of {rows?.length ?? 0} airframes
              </span>
            )}
          </div>

          {err ? (
            <div className="p-4 text-sm text-crit">
              Could not reach the API: {err}. Is the backend running at the configured URL?
            </div>
          ) : !displayedRows ? (
            <div className="space-y-2 p-4">
              <div key="skel-0" className="h-14 animate-pulse rounded bg-elevated" />
              <div key="skel-1" className="h-14 animate-pulse rounded bg-elevated" />
              <div key="skel-2" className="h-14 animate-pulse rounded bg-elevated" />
            </div>
          ) : displayedRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-fg-2 space-y-2">
              <p>No airframes match Tier {activeTier} criteria.</p>
              <button
                onClick={() => setActiveTier(null)}
                className="text-brand hover:underline font-medium"
              >
                Reset to show all engines
              </button>
            </div>
          ) : (
            <ul>
              {displayedRows.map((r) => (
                <li key={r.engine_id} className="border-b border-line last:border-0">
                  <Link
                    href={`/engine/${encodeURIComponent(r.engine_id)}`}
                    className="grid grid-cols-[110px_1fr_auto] items-center gap-4 px-4 py-3 transition-colors duration-fast hover:bg-elevated sm:grid-cols-[130px_70px_1fr_110px_auto]"
                  >
                    <TierBadge tier={r.urgency.tier} short />
                    <span className="num text-2xl font-semibold">{r.urgency.index.toFixed(0)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.engine_id}</span>
                      <span className="block truncate text-xs text-fg-2">
                        {faultLabel(r.fault_class)}
                        {r.amm[0] ? ` · ${r.amm[0].code}` : ""}
                      </span>
                    </span>
                    <span className="num hidden text-sm text-fg-2 sm:block">RUL {r.rul.toFixed(0)}</span>
                    <span className="text-xs font-medium text-brand">Open cockpit →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right Sidebar: Fleet Timeline & Overview */}
        <aside className="space-y-4">
          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Fleet time</h2>
            <input
              aria-label="Fleet time as percent of engine life"
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={frac}
              onChange={(e) => setFrac(+e.target.value)}
              className="mt-3 w-full accent-[rgb(var(--brand-graphic))]"
            />
            <div className="num mt-1 text-sm text-fg-2">{Math.round(frac * 100)}% of life</div>
          </div>

          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Tier distribution</h2>
            <div
              className="mt-3 flex h-3 overflow-hidden rounded-full bg-elevated"
              role="img"
              aria-label="Tier distribution"
            >
              {k &&
                [["crit", k.dist[0]], ["warn", k.dist[1]], ["ok", k.dist[2]]].map(
                  ([c, n]) =>
                    (n as number) > 0 && (
                      <div
                        key={c as string}
                        style={{ flex: n as number, background: `rgb(var(--${c}-fill))` }}
                      />
                    )
                )}
            </div>
            <div className="num mt-2 text-xs text-fg-2">
              {k ? `${k.dist[0]} critical · ${k.dist[1]} elevated · ${k.dist[2]} monitor` : "–"}
            </div>
          </div>

          <div className="rounded-card border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent decisions</h2>
              <Link href="/audit" className="text-xs text-brand">
                All →
              </Link>
            </div>
            <ul className="mt-3 space-y-2 text-xs">
              {recent.length === 0 && <li className="text-fg-3">No decisions yet.</li>}
              {recent.map((a) => (
                <li key={a.id} className="num text-fg-2">
                  #{a.id} {a.action} {a.engine_id}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Commission Engine Modal */}
      <AddEngineModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onEngineAdded={loadFleet}
        currentFleetUids={rows ? rows.map((r) => r.engine_id) : []}
      />
    </AppShell>
  );
}
