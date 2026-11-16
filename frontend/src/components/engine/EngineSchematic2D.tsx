"use client";

import { STATIONS, type Station } from "@/lib/stations";
import type { StationRisk } from "@/lib/risk";

// Same props as the 3D viewer: used when WebGL is unavailable.
const X: Record<Station, [number, number, number]> = { // x, width, half-height
  fan: [4, 18, 30], lpc: [24, 12, 24], hpc: [38, 18, 20], combustor: [58, 12, 22], hpt: [72, 9, 20], lpt: [83, 13, 24], nozzle: [98, 14, 16],
};
const fill = (r: number) => (r >= 0.55 ? "rgb(var(--crit-fill))" : r >= 0.2 ? "rgb(var(--warn-fill))" : "rgb(var(--elevated))");

export default function EngineSchematic2D({ stationRisk, selected, onSelect }: { stationRisk: StationRisk; selected: Station | null; onSelect: (s: Station | null) => void }) {
  return (
    <svg viewBox="0 0 120 70" className="h-full w-full" role="img" aria-label="Engine stations schematic">
      {STATIONS.map((s) => {
        const [x, w, h] = X[s.id];
        const on = selected === s.id;
        return (
          <g key={s.id} onClick={() => onSelect(on ? null : s.id)} style={{ cursor: "pointer" }}>
            <rect x={x} y={35 - h} width={w} height={h * 2} rx="2" fill={fill(stationRisk[s.id])} stroke={on ? "rgb(var(--brand-graphic))" : "rgb(var(--border))"} strokeWidth={on ? 1.2 : 0.6} opacity={selected && !on ? 0.55 : 1} />
            <text x={x + w / 2} y={37} textAnchor="middle" fontSize="3.2" fill="rgb(var(--fg))">{s.label}</text>
          </g>
        );
      })}
      <line x1="4" y1="35" x2="112" y2="35" stroke="rgb(var(--fg-3))" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
    </svg>
  );
}
