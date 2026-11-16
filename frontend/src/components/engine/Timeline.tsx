"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Diagnosis } from "@/lib/api";

export default function Timeline({ hist, cursor }: { hist: Diagnosis[]; cursor: number }) {
  const data = hist.slice(0, cursor + 1).map((d) => ({ cycle: d.cycle, urgency: d.urgency.index, anomaly: +(d.anomaly_score * 100).toFixed(1) }));
  const thr = hist[0] ? hist[0].anomaly_threshold * 100 : undefined;
  return (
    <div className="h-64" role="img" aria-label="Urgency and anomaly score over flight cycles">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid stroke="rgb(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="cycle" stroke="rgb(var(--fg-3))" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} stroke="rgb(var(--fg-3))" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "rgb(var(--elevated))", border: "1px solid rgb(var(--border))", borderRadius: 8 }} />
          <ReferenceLine y={70} stroke="rgb(var(--crit-fill))" strokeDasharray="4 4" label={{ value: "Tier 1", fill: "rgb(var(--fg-3))", fontSize: 10, position: "insideTopRight" }} />
          <ReferenceLine y={40} stroke="rgb(var(--warn-fill))" strokeDasharray="4 4" label={{ value: "Tier 2", fill: "rgb(var(--fg-3))", fontSize: 10, position: "insideTopRight" }} />
          {thr !== undefined && <ReferenceLine y={thr} stroke="rgb(var(--info-fill))" strokeDasharray="2 4" />}
          <Line type="monotone" dataKey="urgency" name="Urgency" stroke="rgb(var(--brand-graphic))" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="anomaly" name="Anomaly score (x100)" stroke="rgb(var(--info-fill))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
