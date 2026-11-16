import { Link2, Link2Off } from "lucide-react";
import type { Chain } from "@/lib/api";

export default function ChainBadge({ chain }: { chain: Chain | null }) {
  if (!chain) return <span className="text-xs text-fg-3">verifying…</span>;
  return chain.valid
    ? <span className="inline-flex items-center gap-1.5 rounded-chip bg-ok-fill/15 px-2 py-1 text-xs font-medium text-ok"><Link2 className="h-3.5 w-3.5" aria-hidden /> Chain verified</span>
    : <span className="inline-flex items-center gap-1.5 rounded-chip bg-crit-fill/15 px-2 py-1 text-xs font-medium text-crit"><Link2Off className="h-3.5 w-3.5" aria-hidden /> Broken at #{chain.broken_at_id}</span>;
}
