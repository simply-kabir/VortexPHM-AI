"use client";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bar as ShapBar } from "@/lib/api";

export default function ShapBars({ data }: { data: ShapBar[] }) {
  const rows = data.map((b) => ({ ...b, label: `${b.feature} ${b.arrow}` }));
  return (
    <div className="h-72" role="img" aria-label="SHAP contributions of the top features">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" stroke="rgb(var(--fg-3))" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={150} stroke="rgb(var(--fg-3))" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgb(var(--elevated))" }} contentStyle={{ background: "rgb(var(--elevated))", border: "1px solid rgb(var(--border))", borderRadius: 8 }} formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))} />
          <Bar dataKey="shap" isAnimationActive={false} radius={3}>
            {rows.map((b, i) => <Cell key={i} fill={b.shap >= 0 ? "rgb(var(--crit-fill))" : "rgb(var(--info-fill))"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
