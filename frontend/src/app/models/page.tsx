"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/shell/AppShell";
import { getJSON } from "@/lib/api";

type Dict = Record<string, unknown>;
const DETECTORS = ["baseline_fixed_3sigma", "baseline_calibrated", "isolation_forest"];
const COLS: [string, string, (v: number) => string][] = [
  ["far_cycle", "FAR (cycle)", (v) => `${(v * 100).toFixed(2)}%`], ["far_engine", "FAR (engine)", (v) => `${(v * 100).toFixed(0)}%`],
  ["detection_rate", "Detection rate", (v) => `${(v * 100).toFixed(0)}%`], ["median_lead_detected", "Median lead (cyc)", (v) => v.toFixed(0)],
  ["share_lead_ge_35", "Lead ≥ 35", (v) => `${(v * 100).toFixed(0)}%`], ["median_lead_pct_of_life", "Lead % of life", (v) => `${(v * 100).toFixed(0)}%`],
  ["drift_detection_rate", "Drift detected", (v) => `${(v * 100).toFixed(0)}%`],
];
const fmt = (o: Dict | undefined, k: string, f: (v: number) => string) => (typeof o?.[k] === "number" && Number.isFinite(o[k] as number) ? f(o[k] as number) : "–");

export default function ModelsPage() {
  const [data, setData] = useState<Record<string, Dict> | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { getJSON<Record<string, Dict>>("/metrics/benchmark").then(setData).catch((e) => setErr(String(e.message ?? e))); }, []);
  const bench = Object.entries(data ?? {}).filter(([k]) => k.startsWith("benchmark_"));
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Model governance</h1>
      <p className="mt-1 text-sm text-fg-2">Read directly from <code className="num">results/*.json</code> written by the benchmark scripts. Nothing on this page is typed in by hand.</p>
      {err && <p className="mt-4 text-sm text-crit">Could not reach the API: {err}</p>}
      {data && bench.length === 0 && <div className="mt-6 rounded-card border border-line bg-surface p-6 text-sm text-fg-2">No benchmark results yet. Run <code className="num">python -m src.models.train_models --dataset ncmapss</code> and reload.</div>}
      {bench.map(([name, b]) => {
        const clf = b.classifier as Dict | undefined; const rul = b.rul as Dict | undefined;
        return (
          <section key={name} className="mt-6 space-y-4">
            <h2 className="num text-sm font-semibold text-brand">{name.replace("benchmark_", "")}</h2>
            <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs text-fg-3"><tr><th className="p-3">Detector</th>{COLS.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
                <tbody>{DETECTORS.map((d) => <tr key={d} className="border-t border-line"><td className="p-3 text-xs">{d.replaceAll("_", " ")}</td>{COLS.map(([k, l, f]) => <td key={l} className="num text-xs">{fmt(b[d] as Dict | undefined, k, f)}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {clf && (
                <div className="rounded-card border border-line bg-surface p-4">
                  <h3 className="text-sm font-semibold">Classifier (held-out engines)</h3>
                  <p className="num mt-2 text-sm">macro-F1 {fmt(clf, "test_macro_f1", (v) => v.toFixed(3))} · macro-precision {fmt(clf, "test_macro_precision", (v) => v.toFixed(3))}</p>
                  <p className="mt-1 text-[11px] text-fg-3">Targets: ≥ 0.91 / ≥ 0.90. Classes: {(clf.classes as string[] | undefined)?.join(", ")}</p>
                  {Array.isArray(clf.confusion) && (
                    <table className="num mt-3 text-xs"><tbody>{(clf.confusion as number[][]).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} className={`px-2 py-1 text-right ${i === j ? "font-semibold text-ok" : v ? "text-crit" : "text-fg-3"}`}>{v}</td>)}</tr>)}</tbody></table>
                  )}
                </div>
              )}
              {rul && (
                <div className="rounded-card border border-line bg-surface p-4">
                  <h3 className="text-sm font-semibold">RUL regressor</h3>
                  <p className="num mt-2 text-sm">RMSE (last cycle) {fmt(rul, "rmse_last_cycle", (v) => v.toFixed(1))} · NASA score {fmt(rul, "nasa_score_last_cycle", (v) => v.toFixed(0))}</p>
                  <p className="mt-1 text-[11px] text-fg-3">σ from validation residuals: {fmt(rul, "sigma_val", (v) => v.toFixed(1))} cycles (used for the uncertainty band and cost model)</p>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </AppShell>
  );
}
