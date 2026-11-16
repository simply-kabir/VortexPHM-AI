"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, ChevronLeft, Pause, Play, RotateCw } from "lucide-react";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/fleet" aria-label="Back to fleet" className="grid h-8 w-8 place-items-center rounded-control border border-line hover:bg-elevated"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
          <h1 className="text-xl font-semibold tracking-tight">{engineId}</h1>
        </div>
        <div className="flex items-center gap-3"><span className="num text-sm text-fg-2">Cycle {cur.cycle} / {cur.n_cycles}</span><TierBadge tier={cur.urgency.tier} /></div>
      </div>

      {/* hero row: 3D engine + diagnosis */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
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
      <div role="tablist" aria-label="Engine detail" className="sticky top-[92px] z-30 mt-6 flex gap-1 border-b border-line bg-canvas/90 backdrop-blur">
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
    </AppShell>
  );
}
