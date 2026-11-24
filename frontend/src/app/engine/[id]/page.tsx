"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  ChevronLeft,
  Pause,
  Play,
  RotateCw,
  LayoutDashboard,
  SlidersHorizontal,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Wrench,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Layers,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import TierBadge from "@/components/fleet/TierBadge";
import StationChips from "@/components/engine/StationChips";
import UrgencyGauge from "@/components/engine/UrgencyGauge";
import Timeline from "@/components/engine/Timeline";
import SensorSpark from "@/components/engine/SensorSpark";
import ShapBars from "@/components/engine/ShapBars";
import DecisionForm from "@/components/engine/DecisionForm";
import AuditTable from "@/components/audit/AuditTable";
import ChainBadge from "@/components/audit/ChainBadge";
import { API, faultLabel, getJSON, postJSON, usd, type AuditRow, type Chain, type Diagnosis } from "@/lib/api";
import { riskFromProbabilities, riskFromShap } from "@/lib/risk";
import { STATIONS, type Station } from "@/lib/stations";

const EngineViewer3D = dynamic(() => import("@/components/engine/EngineViewer3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-fg-2">Loading 3D engine…</div>,
});

type Tab = "telemetry" | "explain" | "decide" | "audit";
const TABS: { id: Tab; label: string }[] = [{ id: "telemetry", label: "Telemetry" }, { id: "explain", label: "Explain" }, { id: "decide", label: "Decide" }, { id: "audit", label: "Audit" }];

export default function EnginePage() {
  const { id } = useParams<{ id: string }>();
  const engineId = decodeURIComponent(id);

  const [hist, setHist] = useState<Diagnosis[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<Tab>("telemetry");
  const [viewMode, setViewMode] = useState<"executive" | "detailed">("executive");
  const [selected, setSelected] = useState<Station | null>(null);
  const [exploded, setExploded] = useState(false);
  const [spin, setSpin] = useState(true);
  const [mode, setMode] = useState<"probability" | "shap">("probability");
  const [full, setFull] = useState<Diagnosis | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [chain, setChain] = useState<Chain | null>(null);
  const cache = useRef(new Map<number, Diagnosis>());

  // 1. load the whole replay quickly through the SSE endpoint (speed=0), then allow scrubbing/playing locally
  useEffect(() => {
    setHist([]); setLoadErr(""); setFull(null); cache.current.clear();
    const acc: Diagnosis[] = [];
    const es = new EventSource(`${API}/engines/${encodeURIComponent(engineId)}/replay?speed=0`);
    es.onmessage = (ev) => {
      const d = JSON.parse(ev.data) as Diagnosis & { done?: boolean };
      if (d.done) { es.close(); setHist(acc); setCursor(Math.floor(acc.length * 0.65)); }
      else acc.push(d);
    };
    es.onerror = () => { es.close(); if (!acc.length) setLoadErr("Could not load this engine from the API."); };
    return () => es.close();
  }, [engineId]);

  // 2. playback
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setCursor((c) => { if (c >= hist.length - 1) { setPlaying(false); return c; } return c + 1; }), 170 / speed);
    return () => clearInterval(t);
  }, [playing, speed, hist.length]);

  const cur = hist[cursor];

  // 3. full diagnosis with TreeSHAP for the paused cycle (cached, debounced)
  useEffect(() => {
    if (!cur || playing) return;
    const cached = cache.current.get(cur.cycle);
    if (cached) { setFull(cached); return; }
    const t = setTimeout(() => {
      postJSON<Diagnosis>("/diagnostics/evaluate", { engine_id: engineId, cycle: cur.cycle })
        .then((d) => { cache.current.set(d.cycle, d); setFull(d); }).catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [cur, playing, engineId]);
  const fullHere = full && cur && full.cycle === cur.cycle ? full : null;

  // 4. audit entries of this engine
  const loadAudit = () => {
    getJSON<AuditRow[]>("/audit?limit=200").then((a) => setAudit(a.filter((r) => r.engine_id === engineId))).catch(() => undefined);
    setChain(null); getJSON<Chain>("/audit/verify").then(setChain).catch(() => undefined);
  };
  useEffect(loadAudit, [engineId]); // eslint-disable-line react-hooks/exhaustive-deps

  // risk per station for the 3D engine
  const stationRisk = useMemo(() => {
    if (!cur) return riskFromProbabilities({});
    if (mode === "shap" && fullHere?.explain) {
      const bySensor: Record<string, number> = {};
      for (const b of fullHere.explain.waterfall) { const s = b.raw.split("_c_")[0]; bySensor[s] = (bySensor[s] ?? 0) + Math.abs(b.shap); }
      return riskFromShap(bySensor);
    }
    return riskFromProbabilities(cur.fault_probs);
  }, [cur, mode, fullHere]);

  const firstAlarm = useMemo(() => {
    for (let i = 0; i < hist.length; i++) {
      const win = hist.slice(Math.max(0, i - 4), i + 1);
      if (win.filter((d) => d.is_anomalous).length >= 3) return i;
    }
    return -1;
  }, [hist]);

  const sparkSensors = useMemo(() => {
    const avail = Object.keys(cur?.sensors ?? {});
    if (selected) { const s = STATIONS.find((x) => x.id === selected)!.sensors.filter((x) => avail.includes(x)); if (s.length) return s; }
    const top = fullHere?.explain?.top3.map((b) => b.raw.split("_c_")[0]) ?? [];
    const uniq = [...new Set(top)].filter((x) => avail.includes(x));
    return uniq.length ? uniq : avail.slice(0, 3);
  }, [cur, selected, fullHere]);

  if (loadErr) return <AppShell><p className="text-crit">{loadErr}</p><Link href="/fleet" className="mt-3 inline-block text-brand">← Back to fleet</Link></AppShell>;
  if (!cur) return <AppShell><div className="h-96 animate-pulse rounded-card bg-surface" /></AppShell>;

  const toggle = (on: boolean) => `flex items-center gap-2 rounded-control border px-3 py-1.5 text-xs transition-colors duration-fast ${on ? "border-brand-graphic bg-brand/10" : "border-line bg-canvas/70 hover:bg-elevated"}`;

  return (
    <AppShell>
      {/* Top Header: Title, Cycle, and Progressive Disclosure Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/fleet"
            aria-label="Back to fleet"
            className="grid h-8 w-8 place-items-center rounded-control border border-line hover:bg-elevated transition-colors"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-fg">{engineId}</h1>
              <TierBadge tier={cur.urgency.tier} />
            </div>
            <p className="text-xs text-fg-3">Commercial Turbofan Digital Twin & Prognostics Cockpit</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="num text-xs text-fg-2 bg-elevated/70 px-2.5 py-1 rounded-chip border border-line">
            Cycle {cur.cycle} / {cur.n_cycles}
          </span>
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
                  ? "bg-elevated text-fg font-semibold shadow-sm"
                  : "text-fg-3 hover:text-fg"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Detailed Engineering</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === "executive" ? (
        <div className="mt-4 space-y-4">
          {/* Operational Airworthiness Directive Banner */}
          <div
            className={`rounded-card border p-4.5 shadow-card transition-all ${
              cur.urgency.tier === 1
                ? "border-crit/40 bg-crit/10"
                : cur.urgency.tier === 2
                ? "border-warn/40 bg-warn/10"
                : "border-ok/40 bg-ok/10"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-control ${
                    cur.urgency.tier === 1
                      ? "bg-crit text-white"
                      : cur.urgency.tier === 2
                      ? "bg-warn text-black"
                      : "bg-ok text-white"
                  }`}
                >
                  {cur.urgency.tier === 1 ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : cur.urgency.tier === 2 ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-fg-2">
                      Operational Airworthiness Directive
                    </span>
                    <span className="text-xs text-fg-3">•</span>
                    <span className="num text-xs font-semibold">
                      Urgency Index {cur.urgency.index.toFixed(2)} / 1.00
                    </span>
                  </div>
                  <h2 className="mt-0.5 text-base font-bold text-fg">
                    {cur.urgency.tier === 1
                      ? "AOG DIRECTIVE: IMMEDIATE GROUND HOLD REQUIRED"
                      : cur.urgency.tier === 2
                      ? "MAINTENANCE WATCHLIST: SCHEDULED SHOP VISIT WITHIN DEFERRAL WINDOW"
                      : "NOMINAL STATUS: AIRWORTHY — CLEARED FOR PASSENGER REVENUE FLIGHT"}
                  </h2>
                  <p className="mt-1 text-xs text-fg-2 max-w-3xl">
                    {cur.urgency.tier === 1
                      ? "Predictive degradation has crossed the safety threshold. Dispatch is prohibited under FAR Part 121 / EASA Part-M until mandatory maintenance action is completed and signed off."
                      : cur.urgency.tier === 2
                      ? `Early degradation detected in core thermodynamic gas path. Operational deferral permissible for up to ${Math.max(
                          1,
                          Math.round(cur.rul * 0.35)
                        )} flight cycles before mandatory borescope inspection.`
                      : "All aerodynamic stations, vibration frequencies, and thermodynamic pressures are operating well within certified OEM envelope tolerances."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setViewMode("detailed");
                    setTab("decide");
                  }}
                  className="inline-flex items-center gap-2 rounded-control bg-brand px-3.5 py-2 text-xs font-semibold text-brand-on hover:bg-brand-hover shadow-sm transition-colors"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>Execute Sign-Off</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3 High-Level Executive Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Card 1: Prognostic Forecast */}
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-fg-3">
                  Prognostic Remaining Useful Life
                </span>
                <span className="num text-[11px] text-fg-3">95% Confidence</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="num text-3xl font-extrabold tracking-tight text-fg">
                  {cur.rul.toFixed(0)}
                </span>
                <span className="text-sm font-medium text-fg-2">flight cycles</span>
                <span className="num text-xs text-fg-3">± {cur.rul_sigma.toFixed(0)}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-line/70">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fg-2">Failure probability within {cur.cost.horizon_cycles} cycles</span>
                  <span
                    className={`num font-semibold ${
                      cur.cost.p_fail_within_horizon > 0.4
                        ? "text-crit"
                        : cur.cost.p_fail_within_horizon > 0.15
                        ? "text-warn"
                        : "text-ok"
                    }`}
                  >
                    {(cur.cost.p_fail_within_horizon * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-elevated overflow-hidden">
                  <div
                    className={`h-full transition-all duration-base ${
                      cur.cost.p_fail_within_horizon > 0.4
                        ? "bg-crit"
                        : cur.cost.p_fail_within_horizon > 0.15
                        ? "bg-warn"
                        : "bg-ok"
                    }`}
                    style={{ width: `${Math.min(100, cur.cost.p_fail_within_horizon * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: AI Root Cause Diagnosis */}
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-fg-3">
                  Root Cause Diagnosis
                </span>
                <span className="num text-[11px] text-brand font-medium">
                  {cur.uncertain ? "Uncertain" : `${((cur.fault_probs[cur.fault_class] ?? 0) * 100).toFixed(0)}% Conf.`}
                </span>
              </div>
              <div className="mt-3">
                <div className="text-lg font-bold text-fg">{faultLabel(cur.fault_class)}</div>
                <p className="mt-1 text-xs text-fg-2 leading-relaxed">
                  Identified via ensemble gradient-boosted trees and Shapley aerodynamic attribution on core gas-path stations.
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-line/70 flex items-center justify-between text-xs">
                <span className="text-fg-2">Suggested Action:</span>
                <span className="font-semibold text-fg uppercase">{cur.cost.suggestion.replace("_", " ")}</span>
              </div>
            </div>

            {/* Card 3: Financial Loss Avoidance ROI */}
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-fg-3">
                  Economic Loss Avoidance
                </span>
                <span className="rounded-chip bg-ok/10 border border-ok/30 px-2 py-0.5 text-[11px] font-semibold text-ok">
                  ROI Positive
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="num text-3xl font-extrabold tracking-tight text-ok">
                  +{usd(Math.max(0, cur.cost.expected_cost_defer - cur.cost.cost_act_now))}
                </span>
                <span className="text-xs text-fg-3">Net Avoided Loss</span>
              </div>
              <div className="mt-3 pt-3 border-t border-line/70 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-fg-3 text-[11px]">Inspect Now</div>
                  <div className="num font-semibold text-fg mt-0.5">{usd(cur.cost.cost_act_now)}</div>
                </div>
                <div>
                  <div className="text-fg-3 text-[11px]">Deferral Penalty</div>
                  <div className="num font-semibold text-fg mt-0.5">{usd(cur.cost.expected_cost_defer)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Row: Focused 3D Digital Twin + AMM Mandate */}
          <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
            {/* Visual Digital Twin (Simplified for Executive view) */}
            <div className="rounded-card border border-line bg-surface shadow-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-graphic" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-fg">
                    Interactive 3D Aero-Twin Preview
                  </span>
                </div>
                <span className="text-[11px] text-fg-3">
                  Station color indicates thermodynamic heat & stress
                </span>
              </div>
              <div className="relative h-[320px]">
                <EngineViewer3D
                  className="h-full w-full"
                  stationRisk={stationRisk}
                  selected={selected}
                  onSelect={setSelected}
                  exploded={exploded}
                  autoRotate={spin}
                />
                <div className="absolute left-3 top-3 flex gap-2">
                  <button
                    aria-pressed={spin}
                    onClick={() => setSpin((v) => !v)}
                    className={toggle(spin)}
                  >
                    <RotateCw className="h-3 w-3" /> Auto-rotate
                  </button>
                  <button
                    aria-pressed={exploded}
                    onClick={() => setExploded((v) => !v)}
                    className={toggle(exploded)}
                  >
                    <Boxes className="h-3 w-3" /> Exploded
                  </button>
                </div>
              </div>
              <div className="border-t border-line px-4 py-2.5 bg-canvas/40 flex items-center justify-between text-xs text-fg-2">
                <span>Click any station above to isolate telemetry</span>
                <button
                  onClick={() => {
                    setViewMode("detailed");
                    setTab("telemetry");
                  }}
                  className="text-brand hover:underline font-medium inline-flex items-center gap-1"
                >
                  Full 3D Station Telemetry ➔
                </button>
              </div>
            </div>

            {/* Executive Action Work Orders */}
            <div className="rounded-card border border-line bg-surface p-4 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-brand-graphic" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-fg">
                      Mandated Maintenance Actions
                    </span>
                  </div>
                  <span className="num text-xs text-fg-3">FAA / EASA Part 145</span>
                </div>

                <div className="mt-3.5 space-y-2.5">
                  {cur.amm.map((a, i) => (
                    <div
                      key={a.code + a.task}
                      className="rounded-control border border-line/80 bg-canvas/60 p-3 hover:border-line transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="num font-bold text-xs text-brand">{a.code}</span>
                        {i === 0 && (
                          <span className="rounded-chip bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10px] font-semibold text-brand">
                            Primary Directive
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-fg-2 font-medium">{a.task}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-line space-y-2">
                <button
                  onClick={() => {
                    setViewMode("detailed");
                    setTab("decide");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-control bg-elevated hover:bg-line border border-line py-2 text-xs font-semibold text-fg transition-all"
                >
                  <FileCheck className="h-4 w-4 text-brand-graphic" />
                  <span>Log Maintenance Action in Decision Form</span>
                </button>
                <button
                  onClick={() => {
                    setViewMode("detailed");
                    setTab("audit");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-control hover:bg-elevated/70 py-1.5 text-xs text-fg-3 hover:text-fg transition-all"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Verify Cryptographic Audit Trail ({audit.length} records)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Progressive Disclosure Footer Prompt */}
          <div className="rounded-control border border-line/90 bg-elevated/30 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-control bg-surface border border-line">
                <Sparkles className="h-4 w-4 text-brand-graphic" />
              </div>
              <div>
                <div className="text-xs font-semibold text-fg">Looking for in-depth engineering telemetry?</div>
                <div className="text-[11px] text-fg-3">
                  Switch to Detailed Engineering Mode to scrub cycle replay history, inspect TreeSHAP waterfall feature attributions, and view raw sensor graphs.
                </div>
              </div>
            </div>
            <button
              onClick={() => setViewMode("detailed")}
              className="inline-flex items-center gap-1.5 rounded-control bg-surface border border-line hover:border-fg-3 px-3 py-1.5 text-xs font-semibold text-fg shadow-sm transition-all"
            >
              <span>Unlock Detailed Engineering</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Detailed Engineering View (The full rich cockpit) */
        <div className="mt-4 space-y-6">
          {/* hero row: 3D engine + diagnosis */}
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <section className="rounded-card border border-line bg-surface shadow-card">
              <div className="relative h-[380px] overflow-hidden rounded-t-card">
                <EngineViewer3D className="h-full w-full" stationRisk={stationRisk} selected={selected} onSelect={setSelected} exploded={exploded} autoRotate={spin} />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <button aria-pressed={exploded} onClick={() => setExploded((v) => !v)} className={toggle(exploded)}><Boxes className="h-3.5 w-3.5" aria-hidden /> Exploded</button>
                  <button aria-pressed={spin} onClick={() => setSpin((v) => !v)} className={toggle(spin)}><RotateCw className="h-3.5 w-3.5" aria-hidden /> Auto-rotate</button>
                  <button aria-pressed={mode === "shap"} onClick={() => setMode((m) => (m === "shap" ? "probability" : "shap"))} className={toggle(mode === "shap")} title="Colour stations by class probability or by SHAP attribution">Colour: {mode === "shap" ? "SHAP" : "probability"}</button>
                </div>
              </div>
              <div className="space-y-3 border-t border-line p-3">
                <StationChips risk={stationRisk} selected={selected} onSelect={setSelected} />
                <div className="flex items-center gap-3">
                  <button onClick={() => { if (cursor >= hist.length - 1) setCursor(0); setPlaying((p) => !p); }} className="inline-flex items-center gap-2 rounded-control bg-brand px-3 py-1.5 text-sm font-medium text-brand-on hover:bg-brand-hover">
                    {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />} {playing ? "Pause" : "Replay"}
                  </button>
                  <select aria-label="Replay speed" value={speed} onChange={(e) => setSpeed(+e.target.value)} className="rounded-control border border-line bg-elevated px-2 py-1.5 text-xs">
                    {[0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}x</option>)}
                  </select>
                  <div className="relative flex-1">
                    <input aria-label="Scrub through engine life" type="range" min={0} max={hist.length - 1} value={cursor} onChange={(e) => { setPlaying(false); setCursor(+e.target.value); }} className="w-full accent-[rgb(var(--brand-graphic))]" />
                    {firstAlarm >= 0 && <span title={`First persistent alarm: cycle ${hist[firstAlarm].cycle}`} className="pointer-events-none absolute top-0 h-4 w-0.5 bg-warn-fill" style={{ left: `calc(${(firstAlarm / Math.max(1, hist.length - 1)) * 100}% * 0.97 + 6px)` }} />}
                  </div>
                </div>
                <p className="text-[11px] text-fg-3">{firstAlarm >= 0 ? `First persistent alarm (3 of last 5): cycle ${hist[firstAlarm].cycle}. ` : "No persistent alarm raised. "}Drag to orbit, click a station to filter the tabs below.</p>
              </div>
            </section>

            <section className="rounded-card border border-line bg-surface p-4 shadow-card">
              <UrgencyGauge value={cur.urgency.index} tier={cur.urgency.tier} />
              <div className="mt-4 text-center">
                <div className="text-sm text-fg-2">Diagnosis</div>
                <div className="text-lg font-semibold">{faultLabel(cur.fault_class)}</div>
                <div className="num text-xs text-fg-2">{cur.uncertain ? "classifier not confident" : `${((cur.fault_probs[cur.fault_class] ?? 0) * 100).toFixed(0)}% confidence`}</div>
              </div>
              <dl className="num mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-fg-2">RUL</dt><dd className="text-right">{cur.rul.toFixed(0)} ± {cur.rul_sigma.toFixed(0)} cycles</dd>
                <dt className="text-fg-2">P(fail ≤ {cur.cost.horizon_cycles} cyc)</dt><dd className="text-right">{(cur.cost.p_fail_within_horizon * 100).toFixed(0)}%</dd>
                <dt className="text-fg-2">Defer / inspect</dt><dd className="text-right">{usd(cur.cost.expected_cost_defer)} / {usd(cur.cost.cost_act_now)}</dd>
                <dt className="text-fg-2">Suggestion</dt><dd className="text-right font-semibold">{cur.cost.suggestion.replace("_", " ")}</dd>
              </dl>
              <ul className="mt-4 space-y-1 text-xs">{cur.amm.map((a) => <li key={a.code + a.task}><span className="num text-brand">{a.code}</span> <span className="text-fg-2">{a.task}</span></li>)}</ul>
              <p className="mt-3 text-[11px] text-fg-3">Cost figures are assumption-based; AMM references are illustrative.</p>
            </section>
          </div>

          {/* tabs */}
          <div role="tablist" aria-label="Engine detail" className="sticky top-[92px] z-30 flex gap-1 border-b border-line bg-canvas/90 backdrop-blur">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`relative px-4 py-2.5 text-sm transition-colors duration-base ${tab === t.id ? "text-fg" : "text-fg-2 hover:text-fg"}`}>
                {t.label}{tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-brand-graphic" />}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="mt-4">
            {tab === "telemetry" && (
              <div className="space-y-4">
                <div className="rounded-card border border-line bg-surface p-4"><h2 className="mb-2 text-sm font-semibold">Urgency and anomaly score</h2><Timeline hist={hist} cursor={cursor} /></div>
                <div>
                  <h2 className="mb-2 text-sm font-semibold">{selected ? `${STATIONS.find((s) => s.id === selected)!.label} sensors` : "Top driver sensors"}</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sparkSensors.map((s) => <SensorSpark key={s} sensor={s} hist={hist} cursor={cursor} />)}</div>
                </div>
              </div>
            )}

            {tab === "explain" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-card border border-line bg-surface p-4">
                  <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Why this diagnosis?</h2>{fullHere?.explain_ms !== undefined && <span className="num rounded-chip bg-elevated px-2 py-0.5 text-xs text-fg-2">TreeSHAP {fullHere.explain_ms} ms</span>}</div>
                  {!fullHere?.explain ? <p className="mt-4 text-sm text-fg-2">{playing ? "Pause the replay to compute the explanation." : "Computing explanation…"}</p> : (
                    <>
                      <p className="mt-3 text-sm">Top drivers: <b className="num">{fullHere.explain.top3.map((b) => `${b.feature} ${b.arrow}`).join(" · ")}</b> push the model toward <b>{faultLabel(cur.fault_class)}</b>.</p>
                      <ShapBars data={fullHere.explain.waterfall} />
                      <p className="text-[11px] text-fg-3">Red bars raise the predicted class probability, blue bars lower it. Arrows show whether the sensor is above or below its regime baseline.</p>
                    </>
                  )}
                </div>
                <div className="rounded-card border border-line bg-surface p-4">
                  <h2 className="text-sm font-semibold">Class probabilities</h2>
                  <ul className="mt-3 space-y-2">
                    {Object.entries(cur.fault_probs).sort((a, b) => b[1] - a[1]).map(([c, p]) => (
                      <li key={c}><div className="flex justify-between text-xs"><span>{faultLabel(c)}</span><span className="num">{(p * 100).toFixed(0)}%</span></div>
                        <div className="relative mt-1 h-2 rounded bg-elevated"><div className="h-2 rounded bg-brand-graphic transition-all duration-base" style={{ width: `${p * 100}%` }} /><span className="absolute top-[-2px] h-3 w-px bg-fg-3" style={{ left: "60%" }} title="0.60 confidence line" /></div></li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-fg-3">Below the 0.60 line, an anomalous cycle is labelled UNCERTAIN_ANOMALY.</p>
                </div>
              </div>
            )}

            {tab === "decide" && (fullHere ? <DecisionForm d={fullHere} onLogged={loadAudit} /> : <p className="text-sm text-fg-2">{playing ? "Pause the replay to decide on a cycle." : "Preparing the recommendation…"}</p>)}

            {tab === "audit" && (
              <div className="rounded-card border border-line bg-surface shadow-card">
                <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">Decisions for {engineId}</h2><ChainBadge chain={chain} /></div>
                <AuditTable rows={audit} />
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
