"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "./Logo";
import ThemeToggle from "./ThemeToggle";
import ChainBadge from "@/components/audit/ChainBadge";
import { getJSON, type AuditRow, type Chain, type FleetRow } from "@/lib/api";

const NAV = [
  { href: "/fleet", label: "Fleet" },
  { href: "/models", label: "3D Twin & Models" },
  { href: "/audit", label: "Audit" },
];

type Bench = Record<string, { isolation_forest?: { far_cycle: number }; classifier?: { test_macro_f1: number } }>;

function AlertStrip() {
  const [rows, setRows] = useState<FleetRow[] | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [last, setLast] = useState<AuditRow | null>(null);
  const [bench, setBench] = useState<Bench>({});
  useEffect(() => {
    getJSON<FleetRow[]>("/decision/triage-queue?frac=0.75").then(setRows).catch(() => setRows([]));
    getJSON<Chain>("/audit/verify").then(setChain).catch(() => undefined);
    getJSON<AuditRow[]>("/audit?limit=1").then((a) => setLast(a[0] ?? null)).catch(() => undefined);
    getJSON<Bench>("/metrics/benchmark").then(setBench).catch(() => undefined);
  }, []);
  const t1 = rows?.filter((r) => r.urgency.tier === 1).length ?? 0;
  const t2 = rows?.filter((r) => r.urgency.tier === 2).length ?? 0;
  const ncm = bench["benchmark_ncmapss"];
  return (
    <div className="border-b border-line bg-surface/70">
      <div className="mx-auto flex h-9 max-w-[1440px] items-center gap-4 overflow-x-auto whitespace-nowrap px-6 text-xs text-fg-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-crit-fill" aria-hidden /> <b className="num text-fg">{t1}</b> Tier 1</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warn-fill" aria-hidden /> <b className="num text-fg">{t2}</b> Tier 2</span>
        <span className="text-fg-3">|</span>
        <span className="inline-flex items-center gap-2">{last ? <>Last decision <b className="num text-fg">#{last.id}</b></> : "No decisions yet"} <ChainBadge chain={chain} /></span>
        {ncm?.isolation_forest && ncm.classifier && (<><span className="text-fg-3">|</span><span>Model: FAR <b className="num text-fg">{(ncm.isolation_forest.far_cycle * 100).toFixed(1)}%</b> · macro-F1 <b className="num text-fg">{ncm.classifier.test_macro_f1.toFixed(2)}</b></span></>)}
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
          <Link href="/" aria-label="Landing page"><Wordmark /></Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((n) => {
              const on =
                path === n.href ||
                (n.href === "/fleet" && path.startsWith("/engine")) ||
                (n.href === "/models" && (path.startsWith("/models") || path === "/viewer"));
              return <Link key={n.href} href={n.href} className={`rounded-control px-3 py-1.5 transition-colors duration-fast ${on ? "bg-elevated text-fg" : "text-fg-2 hover:text-fg"}`}>{n.label}</Link>;
            })}
          </nav>
          <ThemeToggle />
        </div>
        <AlertStrip />
      </header>
      <main className="mx-auto max-w-[1440px] px-6 py-6">{children}</main>
    </div>
  );
}
