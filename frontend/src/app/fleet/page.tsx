"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  LayoutDashboard,
  Cpu,
  ChevronDown,
  ChevronUp,
  Sliders,
  PieChart,
  FileText,
  Wrench,
  DollarSign,
} from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import FlightLineRibbon from "@/components/fleet/FlightLineRibbon";
import TierBadge from "@/components/fleet/TierBadge";
import AddEngineModal from "@/components/fleet/AddEngineModal";
import { faultLabel, getJSON, usd, type AuditRow, type FleetRow } from "@/lib/api";

export default function FleetPage() {
  const [frac, setFrac] = useState(0.75);
  const [rows, setRows] = useState<FleetRow[] | null>(null);
  const [err, setErr] = useState("");
  const [recent, setRecent] = useState<AuditRow[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTier, setActiveTier] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"executive" | "detailed">("executive");
  const [expandedEngineId, setExpandedEngineId] = useState<string | null>(null);

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

  const togglePeek = (e: React.MouseEvent, engineId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedEngineId((prev) => (prev === engineId ? null : engineId));
  };

  return (
    <AppShell>
      {/* Top Header: Title, Progressive Disclosure Switcher, and Commission Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Fleet board</h1>
          <p className="mt-1 text-sm text-fg-2">
            Commercial aero-engine health management and priority airworthiness triage (NASA N-CMAPSS fleet).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Progressive Disclosure Mode Switcher */}
          <div
            className="flex items-center gap-1 rounded-control border border-line bg-surface p-1 shadow-sm text-xs"
            role="group"
            aria-label="Screen information density"
          >
            <button
              onClick={() => setViewMode("executive")}
              aria-pressed={viewMode === "executive"}
              className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-1 font-medium transition-all ${
                viewMode === "executive"
                  ? "bg-elevated text-fg font-semibold shadow-sm"
                  : "text-fg-3 hover:text-fg"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Executive View</span>
            </button>
            <button
              onClick={() => setViewMode("detailed")}
              aria-pressed={viewMode === "detailed"}
              className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-1 font-medium transition-all ${
                viewMode === "detailed"
                  ? "bg-brand/15 text-brand font-semibold shadow-sm"
                  : "text-fg-3 hover:text-fg"
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Detailed Engineering</span>
            </button>
          </div>

          {/* Commission Engine Button */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-on hover:bg-brand-hover shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Commission Engine</span>
          </button>
        </div>
      </div>

      {/* Flight-Line Dispatch & Airworthiness Ribbon (Option 1) */}
      <FlightLineRibbon
        rows={rows}
        loading={!rows && !err}
        activeTier={activeTier}
        onSelectTier={setActiveTier}
        viewMode={viewMode}
      />

      {/* Main Content Layout */}
      <div
        className={`mt-6 grid gap-6 transition-all ${
          viewMode === "detailed" ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1"
        }`}
      >
        {/* Priority Maintenance Queue */}
        <section
          aria-label="Priority maintenance queue"
          className="rounded-card border border-line bg-surface shadow-card overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Priority maintenance queue</span>
              {activeTier !== null && (
                <span className="inline-flex items-center gap-1 rounded bg-elevated border border-line px-2 py-0.5 text-xs text-brand font-medium">
                  Tier {activeTier}
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

            <div className="flex items-center gap-3 text-xs text-fg-3">
              {displayedRows && (
                <span className="font-mono">
                  {displayedRows.length} of {rows?.length ?? 0} airframes
                </span>
              )}
            </div>
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
            <ul className="divide-y divide-line/60">
              {displayedRows.map((r) => {
                const isExpanded = expandedEngineId === r.engine_id;

                return (
                  <li key={r.engine_id} className="transition-colors hover:bg-elevated/40">
                    <div className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Core Airframe Identification */}
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <TierBadge tier={r.urgency.tier} short />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-fg">
                                {r.engine_id}
                              </span>
                              <span className="font-mono text-xs text-fg-3">
                                Cycle {r.cycle}
                              </span>
                            </div>
                            <div className="text-xs text-fg-2 mt-0.5">
                              {faultLabel(r.fault_class)}
                            </div>
                          </div>
                        </div>

                        {/* Mid Section: Telemetry / Status */}
                        <div className="flex items-center gap-6 text-xs">
                          <div className="text-right">
                            <span className="text-[10px] uppercase tracking-wider text-fg-3 block">
                              Urgency Score
                            </span>
                            <span className="font-mono font-bold text-sm text-fg">
                              {r.urgency.index.toFixed(0)}/100
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase tracking-wider text-fg-3 block">
                              Projected RUL
                            </span>
                            <span className="font-mono font-semibold text-xs text-fg">
                              ~{r.rul.toFixed(0)} cycles
                            </span>
                          </div>

                          {/* Quick Peek Drawer Trigger (Progressive Disclosure) */}
                          <button
                            onClick={(e) => togglePeek(e, r.engine_id)}
                            className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2.5 py-1 text-xs text-fg-2 hover:bg-elevated hover:text-fg transition-colors"
                            title="Quick preview telemetry and maintenance action"
                          >
                            <span>{isExpanded ? "Hide" : "Peek"}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>

                          {/* Primary CTA: Open Cockpit */}
                          <Link
                            href={`/engine/${encodeURIComponent(r.engine_id)}`}
                            className="inline-flex items-center gap-1 rounded-control bg-brand/10 border border-brand/20 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand hover:text-brand-on transition-colors shadow-sm"
                          >
                            <span>Cockpit →</span>
                          </Link>
                        </div>
                      </div>

                      {/* Progressive Disclosure: Inline Peek Drawer */}
                      {isExpanded && (
                        <div className="mt-3 rounded-control border border-line/70 bg-elevated/40 p-3 text-xs animate-in fade-in duration-150 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded bg-surface border border-line p-2.5">
                            <span className="text-[10px] uppercase text-fg-3 flex items-center gap-1">
                              <Wrench className="h-3 w-3 text-brand" />
                              Mandated AMM Task
                            </span>
                            <span className="font-medium text-fg block mt-1">
                              {r.amm[0] ? `${r.amm[0].code}: ${r.amm[0].task}` : "Routine Transit Check"}
                            </span>
                          </div>

                          <div className="rounded bg-surface border border-line p-2.5">
                            <span className="text-[10px] uppercase text-fg-3 flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-ok" />
                              Cost Deferral vs Boroscope
                            </span>
                            <span className="font-mono text-fg block mt-1">
                              Defer: {usd(r.cost?.expected_cost_defer ?? 0)} · Act: {usd(r.cost?.cost_act_now ?? 0)}
                            </span>
                          </div>

                          <div className="rounded bg-surface border border-line p-2.5">
                            <span className="text-[10px] uppercase text-fg-3 block">
                              Anomaly Flagging Status
                            </span>
                            <span
                              className={`font-semibold block mt-1 ${
                                r.anomalous ? "text-crit" : "text-ok"
                              }`}
                            >
                              {r.anomalous ? "⚠️ Alarm Triggered (Persistent)" : "✅ Nominal Envelope"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right Sidebar: Shown in Detailed Engineering Mode */}
        {viewMode === "detailed" && (
          <aside className="space-y-4 animate-in fade-in duration-200">
            {/* Fleet Time Scrubber */}
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                <Sliders className="h-4 w-4 text-brand" />
                <span>Fleet Time Horizon</span>
              </div>
              <input
                aria-label="Fleet time as percent of engine life"
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={frac}
                onChange={(e) => setFrac(+e.target.value)}
                className="mt-3 w-full accent-[rgb(var(--brand-graphic))] cursor-pointer"
              />
              <div className="num mt-1 text-sm text-fg-2 font-mono">
                {Math.round(frac * 100)}% of life cycle
              </div>
              <p className="text-[11px] text-fg-3 mt-1">
                Evaluates each airframe at this normalized percentage of its operational lifespan.
              </p>
            </div>

            {/* Tier Distribution Spectrum */}
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                <PieChart className="h-4 w-4 text-info" />
                <span>Tier Distribution Spectrum</span>
              </div>
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
              <div className="num mt-2 text-xs text-fg-2 font-mono">
                {k ? `${k.dist[0]} critical · ${k.dist[1]} elevated · ${k.dist[2]} monitor` : "–"}
              </div>
            </div>

            {/* Recent Certified Decisions */}
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                  <FileText className="h-4 w-4 text-brand" />
                  <span>Recent Certified Decisions</span>
                </div>
                <Link href="/audit" className="text-xs text-brand hover:underline">
                  All →
                </Link>
              </div>
              <ul className="mt-3 space-y-2 text-xs">
                {recent.length === 0 && (
                  <li className="text-fg-3">No decisions sealed yet.</li>
                )}
                {recent.map((a) => (
                  <li key={a.id} className="num text-fg-2 flex items-center justify-between">
                    <span>#{a.id} {a.engine_id}</span>
                    <span className="font-semibold text-brand">{a.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
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
