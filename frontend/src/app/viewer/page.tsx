"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCw, Boxes } from "lucide-react";
import { Wordmark } from "@/components/shell/Logo";
import StationChips from "@/components/engine/StationChips";
import { PRESETS, scaleRisk } from "@/lib/risk";
import { stationLabel, type Station } from "@/lib/stations";

const EngineViewer3D = dynamic(() => import("@/components/engine/EngineViewer3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-fg-2">Loading 3D engine…</div>,
});

// Standalone test bench for the 3D engine (no backend needed).
export default function ViewerPage() {
  const [preset, setPreset] = useState("hpc");
  const [level, setLevel] = useState(0.0);          // 0..1 "degradation", drives replay-style updates
  const [playing, setPlaying] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [spin, setSpin] = useState(true);
  const [selected, setSelected] = useState<Station | null>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setLevel((l) => { if (l >= 1) { setPlaying(false); return 1; } return Math.min(1, l + 0.01); }), 80);
    return () => clearInterval(id);
  }, [playing]);

  const base = PRESETS.find((p) => p.id === preset)!.risk;
  const risk = useMemo(() => scaleRisk(base, level), [base, level]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <header className="flex items-center justify-between">
        <Link href="/"><Wordmark /></Link>
        <Link href="/fleet" className="text-sm text-fg-2 hover:text-fg">Fleet →</Link>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="relative h-[520px] overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <EngineViewer3D className="h-full w-full" stationRisk={risk} selected={selected} onSelect={setSelected} exploded={exploded} autoRotate={spin} />
          <div className="absolute left-3 top-3 flex gap-2">
            <button onClick={() => setExploded((v) => !v)} aria-pressed={exploded} className={`flex items-center gap-2 rounded-control border px-3 py-1.5 text-xs ${exploded ? "border-brand-graphic bg-brand/10" : "border-line bg-canvas/70 hover:bg-elevated"}`}><Boxes className="h-3.5 w-3.5" aria-hidden /> Exploded</button>
            <button onClick={() => setSpin((v) => !v)} aria-pressed={spin} className={`flex items-center gap-2 rounded-control border px-3 py-1.5 text-xs ${spin ? "border-brand-graphic bg-brand/10" : "border-line bg-canvas/70 hover:bg-elevated"}`}><RotateCw className="h-3.5 w-3.5" aria-hidden /> Auto-rotate</button>
          </div>
          <p className="absolute bottom-3 left-3 text-[11px] text-fg-3">Drag to orbit · scroll to zoom · click a station</p>
        </section>

        <aside className="space-y-4">
          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Scenario</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => { setPreset(p.id); setLevel(p.id === "healthy" ? 0 : 1); setPlaying(false); }} aria-pressed={preset === p.id}
                  className={`rounded-chip border px-3 py-1.5 text-xs ${preset === p.id ? "border-brand-graphic bg-brand/10" : "border-line hover:bg-elevated"}`}>{p.label}</button>
              ))}
            </div>
            <label className="mt-4 block text-xs text-fg-2">Degradation <span className="num text-fg">{Math.round(level * 100)}%</span>
              <input type="range" min={0} max={1} step={0.01} value={level} onChange={(e) => { setLevel(+e.target.value); setPlaying(false); }} className="mt-2 w-full accent-[rgb(var(--brand-graphic))]" />
            </label>
            <button onClick={() => { if (level >= 1) setLevel(0); setPlaying((v) => !v); }} className="mt-3 flex items-center gap-2 rounded-control bg-brand px-3 py-1.5 text-sm font-medium text-brand-on hover:bg-brand-hover">
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />} {playing ? "Pause" : "Simulate replay"}
            </button>
          </div>
          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Stations</h2>
            <div className="mt-3"><StationChips risk={risk} selected={selected} onSelect={setSelected} /></div>
            <p className="num mt-3 text-xs text-fg-2">{selected ? `${stationLabel(selected)}: ${Math.round(risk[selected] * 100)}% risk` : "No station selected"}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
