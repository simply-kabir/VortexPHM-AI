"use client";

import { useMemo, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Plane,
  Activity,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Info,
} from "lucide-react";
import { usd, type FleetRow } from "@/lib/api";

interface Props {
  rows: FleetRow[] | null;
  loading?: boolean;
  activeTier: number | null;
  onSelectTier: (tier: number | null) => void;
  viewMode?: "executive" | "detailed";
}

export default function FlightLineRibbon({
  rows,
  loading,
  activeTier,
  onSelectTier,
  viewMode = "executive",
}: Props) {
  const [showEconomicsDrawer, setShowEconomicsDrawer] = useState(false);

  const stats = useMemo(() => {
    if (!rows || rows.length === 0) {
      return {
        total: 0,
        t1: 0,
        t2: 0,
        t3: 0,
        readinessPct: 100,
        riskCost: 0,
        preventCost: 0,
        netSavings: 0,
      };
    }

    const total = rows.length;
    const t1 = rows.filter((r) => r.urgency.tier === 1).length;
    const t2 = rows.filter((r) => r.urgency.tier === 2).length;
    const t3 = rows.filter((r) => r.urgency.tier === 3).length;
    const readinessPct = Math.round(((total - t1) / total) * 100);

    const riskCost = rows.reduce((acc, r) => acc + (r.cost?.expected_cost_defer ?? 0), 0);
    const preventCost = rows.reduce((acc, r) => acc + (r.cost?.cost_act_now ?? 0), 0);
    const netSavings = Math.max(0, riskCost - preventCost);

    return {
      total,
      t1,
      t2,
      t3,
      readinessPct,
      riskCost,
      preventCost,
      netSavings,
    };
  }, [rows]);

  if (loading || !rows) {
    return (
      <div className="mt-5 rounded-card border border-line bg-surface p-4 shadow-card animate-pulse space-y-3">
        <div className="h-6 w-1/3 rounded bg-elevated" />
        <div className="h-10 w-full rounded bg-elevated" />
      </div>
    );
  }

  const hasAog = stats.t1 > 0;
  const isEconomicsVisible = viewMode === "detailed" || showEconomicsDrawer;

  return (
    <div className="mt-5 rounded-card border border-line bg-surface p-4 shadow-card space-y-3.5 transition-all">
      {/* Top Banner: Airworthiness Dispatch Status & Compact Economics Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/70 pb-3">
        {/* Left: Operations Center Readiness */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
              hasAog
                ? "border-crit/40 bg-crit-fill/15 text-crit"
                : "border-ok/40 bg-ok-fill/15 text-ok"
            }`}
          >
            {hasAog ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  hasAog ? "bg-crit-fill animate-ping" : "bg-ok-fill animate-pulse"
                }`}
              />
              <span className="text-sm font-bold tracking-tight text-fg">
                {hasAog
                  ? `AIRWORTHINESS CAUTION: ${stats.t1} AIRFRAME${stats.t1 > 1 ? "S" : ""} GROUND-HELD (AOG)`
                  : "ALL POWERPLANTS AIRWORTHY · 100% DISPATCH READY"}
              </span>
              <span
                className={`rounded-chip border px-2 py-0.2 text-[10px] font-mono font-bold ${
                  hasAog
                    ? "border-crit/30 bg-crit-fill/10 text-crit"
                    : "border-ok/30 bg-ok-fill/10 text-ok"
                }`}
              >
                {stats.readinessPct}% DISPATCH RATE
              </span>
            </div>
            <p className="mt-0.5 text-xs text-fg-3">
              Commercial Flight Line Monitoring · FAA 14 CFR § 121 Operational Airworthiness Control
            </p>
          </div>
        </div>

        {/* Right: Inline Economics pill or trigger */}
        <div className="flex items-center gap-2">
          {viewMode === "executive" ? (
            <button
              onClick={() => setShowEconomicsDrawer((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-chip border border-ok/30 bg-ok-fill/10 px-3 py-1.5 text-xs text-ok hover:bg-ok-fill/20 transition-colors font-medium shadow-sm"
              title="Click to expand maintenance financial exposure analysis"
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>Net Avoided Loss: <strong>+{usd(stats.netSavings)}</strong></span>
              {showEconomicsDrawer ? (
                <ChevronUp className="h-3 w-3 ml-0.5" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-0.5" />
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-mono text-fg-3">
              <Info className="h-3.5 w-3.5 text-brand" />
              <span>UER Cost Model Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Maintenance Economics Strip (Progressive Disclosure) */}
      {isEconomicsVisible && (
        <div className="rounded-control border border-line/60 bg-elevated/40 p-3 text-xs animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded bg-surface border border-line px-2.5 py-1">
                <span className="block text-[10px] uppercase tracking-wider text-fg-3">
                  Avoidable Failure Risk
                </span>
                <span className="font-mono text-xs font-semibold text-fg">
                  {usd(stats.riskCost)}
                </span>
              </div>

              <div className="rounded bg-surface border border-line px-2.5 py-1">
                <span className="block text-[10px] uppercase tracking-wider text-fg-3">
                  Preventative Action
                </span>
                <span className="font-mono text-xs font-semibold text-fg">
                  {usd(stats.preventCost)}
                </span>
              </div>

              <div className="rounded border border-ok/30 bg-ok-fill/10 px-2.5 py-1 text-ok">
                <span className="block text-[10px] uppercase tracking-wider font-semibold">
                  Net Avoided Loss
                </span>
                <span className="font-mono text-xs font-bold">
                  +{usd(stats.netSavings)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-fg-3 max-w-sm">
              Expected cost avoidance modeled under FAA AC 120-78A: Σ P(fail within horizon) × $2.5M Unscheduled Engine Removal cost vs immediate boroscopy.
            </p>
          </div>
        </div>
      )}

      {/* Bottom Control Bar: Interactive Triage Flight-Line Segments */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-fg-3 font-medium">
          <Activity className="h-3.5 w-3.5 text-brand" />
          <span>Flight-Line Triage:</span>
        </div>

        {/* Filter Segment Buttons */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter queue by operational tier">
          <button
            onClick={() => onSelectTier(null)}
            aria-pressed={activeTier === null}
            className={`inline-flex items-center gap-1.5 rounded-chip border px-3 py-1.5 text-xs font-medium transition-all ${
              activeTier === null
                ? "border-brand-graphic bg-brand/15 text-brand font-semibold shadow-sm"
                : "border-line bg-surface text-fg-2 hover:bg-elevated hover:text-fg"
            }`}
          >
            <Plane className="h-3 w-3" />
            <span>All Airframes ({stats.total})</span>
          </button>

          <button
            onClick={() => onSelectTier(activeTier === 1 ? null : 1)}
            aria-pressed={activeTier === 1}
            className={`inline-flex items-center gap-1.5 rounded-chip border px-3 py-1.5 text-xs font-medium transition-all ${
              activeTier === 1
                ? "border-crit bg-crit-fill/20 text-crit font-semibold shadow-sm"
                : "border-line bg-surface text-fg-2 hover:bg-elevated hover:text-fg"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-crit-fill" />
            <span>Tier 1: Ground Hold ({stats.t1})</span>
          </button>

          <button
            onClick={() => onSelectTier(activeTier === 2 ? null : 2)}
            aria-pressed={activeTier === 2}
            className={`inline-flex items-center gap-1.5 rounded-chip border px-3 py-1.5 text-xs font-medium transition-all ${
              activeTier === 2
                ? "border-warn bg-warn-fill/20 text-warn font-semibold shadow-sm"
                : "border-line bg-surface text-fg-2 hover:bg-elevated hover:text-fg"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-warn-fill" />
            <span>Tier 2: Watchlist ({stats.t2})</span>
          </button>

          <button
            onClick={() => onSelectTier(activeTier === 3 ? null : 3)}
            aria-pressed={activeTier === 3}
            className={`inline-flex items-center gap-1.5 rounded-chip border px-3 py-1.5 text-xs font-medium transition-all ${
              activeTier === 3
                ? "border-ok bg-ok-fill/20 text-ok font-semibold shadow-sm"
                : "border-line bg-surface text-fg-2 hover:bg-elevated hover:text-fg"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-ok-fill" />
            <span>Tier 3: Nominal ({stats.t3})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
