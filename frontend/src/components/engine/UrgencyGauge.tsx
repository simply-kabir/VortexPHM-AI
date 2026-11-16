import type { Tier } from "@/lib/api";
import { tierColorVar } from "@/components/fleet/TierBadge";

/** 180-degree gauge with a numeral in the middle (colour = tier). */
export default function UrgencyGauge({ value, tier }: { value: number; tier: Tier }) {
  const r = 52, c = Math.PI * r, f = Math.max(0, Math.min(1, value / 100));
  return (
    <div className="relative mx-auto w-[150px]" role="img" aria-label={`Urgency ${value.toFixed(0)} out of 100`}>
      <svg viewBox="0 0 120 70" className="w-full">
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="rgb(var(--border))" strokeWidth="9" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={tierColorVar(tier)} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} style={{ transition: "stroke-dasharray 300ms cubic-bezier(.2,.8,.2,1), stroke 180ms" }} />
      </svg>
      <div className="num absolute inset-x-0 bottom-0 text-center text-4xl font-semibold leading-none">{value.toFixed(0)}</div>
    </div>
  );
}
