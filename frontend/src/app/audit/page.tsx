"use client";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import AuditTable from "@/components/audit/AuditTable";
import ChainBadge from "@/components/audit/ChainBadge";
import { getJSON, type AuditRow, type Chain } from "@/lib/api";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [chain, setChain] = useState<Chain | null>(null);
  const [action, setAction] = useState("ALL");
  const load = useCallback(() => {
    getJSON<AuditRow[]>("/audit?limit=200").then(setRows).catch(() => setRows([]));
    setChain(null); getJSON<Chain>("/audit/verify").then(setChain).catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  const shown = action === "ALL" ? rows : rows.filter((r) => r.action === action);
  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1><p className="mt-1 text-sm text-fg-2">Append-only and hash-chained. Each entry commits to the previous one.</p></div>
        <div className="flex items-center gap-3"><ChainBadge chain={chain} /><button onClick={load} className="inline-flex items-center gap-2 rounded-control border border-line px-3 py-1.5 text-sm hover:bg-elevated"><ShieldCheck className="h-4 w-4" aria-hidden /> Verify now</button></div>
      </div>
      <div className="mt-4 flex gap-2" role="group" aria-label="Filter by action">
        {["ALL", "ACCEPT", "OVERRIDE", "DEFER"].map((a) => <button key={a} aria-pressed={action === a} onClick={() => setAction(a)} className={`rounded-chip border px-3 py-1 text-xs ${action === a ? "border-brand-graphic bg-brand/10" : "border-line text-fg-2 hover:bg-elevated"}`}>{a}</button>)}
      </div>
      <div className="mt-4 rounded-card border border-line bg-surface shadow-card"><AuditTable rows={shown} /></div>
    </AppShell>
  );
}
