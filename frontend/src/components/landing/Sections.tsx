import Link from "next/link";
import { Activity, FileSignature, Link2, ScanSearch } from "lucide-react";

const STEPS = [
  { icon: Activity, title: "Detect", body: "An Isolation Forest trained only on healthy cycles flags departures. A persistent-alarm rule (3 of the last 5 cycles) keeps false alarms low, and thresholds are calibrated on held-out engines." },
  { icon: ScanSearch, title: "Diagnose", body: "An XGBoost classifier separates HPC, fan/LPC, HPT and sensor-drift faults. Exact TreeSHAP names the top sensor drivers, and a RUL model with an uncertainty band estimates remaining life." },
  { icon: FileSignature, title: "Decide", body: "A 0-100 urgency index, a cost-of-waiting estimate and illustrative AMM task references go to the engineer, who accepts, overrides or defers with a written justification." },
];

const TARGETS = [
  { value: "≥ 35", unit: "cycles", label: "detection lead time" },
  { value: "≤ 2%", unit: "", label: "false-alarm rate" },
  { value: "≥ 0.91", unit: "", label: "macro-F1, held-out engines" },
  { value: "≤ 120", unit: "ms", label: "explanation latency (p95)" },
];

export default function Sections() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-24">
        <p className="num text-xs uppercase tracking-widest text-brand">How it works</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">From raw telemetry to a signed maintenance decision.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <Icon className="h-5 w-5 text-brand" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <p className="num text-xs uppercase tracking-widest text-brand">Acceptance targets</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Targets are stated up front. Results are generated, not quoted.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TARGETS.map((t) => (
            <div key={t.label} className="rounded-card border border-line bg-surface p-6">
              <div className="num text-4xl font-semibold">{t.value}<span className="ml-1 text-lg text-fg-2">{t.unit}</span></div>
              <div className="mt-2 text-sm text-fg-2">{t.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-fg-3">These are the acceptance criteria from the evaluation framework. Measured values are produced by the benchmark scripts and shown on the Models page.</p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid items-center gap-10 rounded-card border border-line bg-surface p-8 md:grid-cols-2 md:p-12">
          <div>
            <p className="num text-xs uppercase tracking-widest text-brand">Human in the loop</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">The AI advises. The engineer decides.</h2>
            <p className="mt-3 text-fg-2">Every ACCEPT, OVERRIDE and DEFER needs a licence ID and a justification of at least 50 characters. Each entry is chained to the previous one with SHA-256, and database triggers reject edits and deletes.</p>
            <Link href="/audit" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-hover"><Link2 className="h-4 w-4" aria-hidden /> See the audit trail</Link>
          </div>
          <div className="space-y-3" aria-hidden>
            {["#47  ACCEPT   ENG-042   9f3a…c1e0", "#48  DEFER    ENG-109   c1e0…77b2", "#49  OVERRIDE ENG-042   77b2…a4d9"].map((r, i) => (
              <div key={r} className="num rounded-control border border-line bg-elevated px-4 py-3 text-xs text-fg-2">
                {r}{i > 0 && <span className="ml-2 text-brand">← prev_hash</span>}
              </div>
            ))}
            <p className="text-xs text-fg-3">Illustrative entries.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Explore the engine, then the fleet.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/fleet" className="rounded-control bg-brand px-6 py-2.5 text-sm font-medium text-brand-on transition-colors duration-fast hover:bg-brand-hover">Open fleet board</Link>
          <Link href="/viewer" className="rounded-control border border-line bg-surface px-6 py-2.5 text-sm font-medium transition-colors duration-fast hover:bg-elevated">Try the 3D engine</Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl space-y-2 px-6 py-8 text-xs leading-relaxed text-fg-3">
          <p>VortexPHM-AI is a research prototype built on public NASA simulation data (N-CMAPSS, C-MAPSS). It is advisory only and is not certified for airworthiness decisions.</p>
          <p>Hero frames and the interactive 3D engine are rendered from the model &quot;Turbofan Engine&quot; by Xieyn (Sketchfab); see /models/CREDITS.txt for the licence terms. The model is illustrative and is not the simulated NASA engine.</p>
        </div>
      </footer>
    </>
  );
}