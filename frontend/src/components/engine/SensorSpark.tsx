"use client";
import { Line, LineChart, ReferenceArea, ResponsiveContainer, YAxis } from "recharts";
import type { Diagnosis } from "@/lib/api";

export default function SensorSpark({ sensor, hist, cursor }: { sensor: string; hist: Diagnosis[]; cursor: number }) {
  const data = hist.slice(0, cursor + 1).map((d) => ({ c: d.cycle, z: d.sensors?.[sensor] ?? 0 }));
  const now = data[data.length - 1]?.z ?? 0;
  const off = Math.abs(now) > 2;
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{sensor}</span>
        <span className={`num text-xs ${off ? "text-crit" : "text-fg-2"}`}>{now >= 0 ? "+" : ""}{now.toFixed(1)}σ</span>
      </div>
      <div className="h-16">
        <ResponsiveContainer>
          <LineChart data={data}>
            <YAxis hide domain={[-6, 6]} />
            <ReferenceArea y1={-2} y2={2} fill="rgb(var(--ok-fill))" fillOpacity={0.12} />
            <Line dataKey="z" stroke={off ? "rgb(var(--crit-fill))" : "rgb(var(--brand-graphic))"} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10px] text-fg-3">regime-normalised deviation; green band = nominal ±2σ</div>
    </div>
  );
}
