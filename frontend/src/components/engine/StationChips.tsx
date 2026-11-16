"use client";

import { STATIONS, type Station } from "@/lib/stations";
import type { StationRisk } from "@/lib/risk";

const dot = (r: number) => (r >= 0.55 ? "bg-crit-fill" : r >= 0.2 ? "bg-warn-fill" : "bg-ok-fill");
const word = (r: number) => (r >= 0.55 ? "high risk" : r >= 0.2 ? "elevated" : "nominal");

/** Keyboard-accessible mirror of the 3D selection (the 3D view is never the only way to select). */
export default function StationChips({ risk, selected, onSelect }: { risk: StationRisk; selected: Station | null; onSelect: (s: Station | null) => void }) {
  return (
    <div role="group" aria-label="Engine stations" className="flex flex-wrap gap-2">
      {STATIONS.map((s) => {
        const on = selected === s.id;
        return (
          <button
            key={s.id}
            aria-pressed={on}
            onClick={() => onSelect(on ? null : s.id)}
            className={`flex items-center gap-2 rounded-chip border px-3 py-1.5 text-sm transition-colors duration-fast ${on ? "border-brand-graphic bg-brand/10 text-fg" : "border-line bg-surface text-fg-2 hover:bg-elevated hover:text-fg"}`}
          >
            <span className={`h-2 w-2 rounded-full ${dot(risk[s.id])}`} aria-hidden />
            {s.label}
            <span className="sr-only">{word(risk[s.id])}</span>
          </button>
        );
      })}
    </div>
  );
}
