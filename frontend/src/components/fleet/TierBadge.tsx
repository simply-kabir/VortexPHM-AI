import { AlertTriangle, Flame, ShieldCheck } from "lucide-react";
import type { Tier } from "@/lib/api";

const T = {
  1: { label: "Tier 1 · Critical", cls: "bg-crit-fill/15 text-crit", Icon: Flame },
  2: { label: "Tier 2 · Elevated", cls: "bg-warn-fill/20 text-warn", Icon: AlertTriangle },
  3: { label: "Tier 3 · Monitor", cls: "bg-ok-fill/15 text-ok", Icon: ShieldCheck },
} as const;

export const tierColorVar = (t: Tier) => (t === 1 ? "rgb(var(--crit-fill))" : t === 2 ? "rgb(var(--warn-fill))" : "rgb(var(--ok-fill))");

export default function TierBadge({ tier, short = false }: { tier: Tier; short?: boolean }) {
  const { label, cls, Icon } = T[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {short ? label.split(" · ")[0] : label}
    </span>
  );
}
