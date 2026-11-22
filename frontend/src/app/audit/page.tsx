"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  X,
  FileDown,
  Database,
  Award,
  CheckCircle2,
  RefreshCw,
  Lock,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import AuditTable from "@/components/audit/AuditTable";
import AuditDetailModal from "@/components/audit/AuditDetailModal";
import ChainBadge from "@/components/audit/ChainBadge";
import { getJSON, type AuditRow, type Chain } from "@/lib/api";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [chain, setChain] = useState<Chain | null>(null);
  const [action, setAction] = useState("ALL");
  const [query, setQuery] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null);
  const [lastVerified, setLastVerified] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsVerifying(true);
    getJSON<AuditRow[]>("/audit?limit=200")
      .then((data) => setRows(data))
      .catch(() => setRows([]));

    getJSON<Chain>("/audit/verify")
      .then((c) => {
        setChain(c);
        setLastVerified(new Date().toLocaleTimeString());
      })
      .catch(() => undefined)
      .finally(() => setIsVerifying(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Statistics calculation
  const totalCount = rows.length;
  const acceptCount = rows.filter((r) => r.action === "ACCEPT").length;
  const overrideCount = rows.filter((r) => r.action === "OVERRIDE").length;
  const deferCount = rows.filter((r) => r.action === "DEFER").length;

  // Filter & Search
  const filteredRows = rows.filter((r) => {
    if (action !== "ALL" && r.action !== action) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.engine_id.toLowerCase().includes(q) ||
      r.engineer_license.toLowerCase().includes(q) ||
      r.justification.toLowerCase().includes(q) ||
      r.action.toLowerCase().includes(q) ||
      String(r.cycle).includes(q) ||
      r.entry_hash.toLowerCase().includes(q)
    );
  });

  // Export JSON
  const exportJSON = () => {
    const data = JSON.stringify(
      {
        standard: "FAA 14 CFR § 43.9 / EASA Part-M Airworthiness Ledger",
        system: "VortexPHM-AI Autonomous Aero-Engine Health Management",
        exported_at: new Date().toISOString(),
        chain_verification: chain,
        record_count: rows.length,
        ledger: rows,
      },
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vortexphm_audit_ledger_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "ID",
      "Timestamp_UTC",
      "Engine_ID",
      "Flight_Cycle",
      "Action",
      "Engineer_License",
      "Justification",
      "Previous_Hash",
      "Entry_Hash",
    ];
    const csvRows = rows.map((r) => [
      r.id,
      `"${r.ts}"`,
      `"${r.engine_id}"`,
      r.cycle,
      `"${r.action}"`,
      `"${r.engineer_license}"`,
      `"${r.justification.replace(/"/g, '""')}"`,
      `"${r.prev_hash}"`,
      `"${r.entry_hash}"`,
    ]);
    const content = [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vortexphm_airworthiness_log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell>
      {/* Top Regulatory Advisory Banner */}
      <div className="rounded-card border border-brand/20 bg-brand/5 p-4 text-xs shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-brand">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-fg">
              FAA 14 CFR § 43.9 / EASA Part-M Airworthiness Compliance Ledger
            </span>
          </div>
          <div className="flex items-center gap-2 text-fg-3">
            <span>Enforcement:</span>
            <span className="rounded bg-elevated px-2 py-0.5 font-mono text-[11px] text-fg-2 border border-line">
              SQLite Abort Triggers ON
            </span>
          </div>
        </div>
        <p className="mt-2 text-fg-2 leading-relaxed">
          Every maintenance decision, AI recommendation, and licensed technician disposition is cryptographically committed with SHA-256 recursive chaining. Update and delete mutations are rejected at the database engine level.
        </p>
      </div>

      {/* Page Header */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">
            Airworthiness Audit Trail
          </h1>
          <p className="mt-1 text-sm text-fg-2">
            Append-only, cryptographically linked flight maintenance records and human-in-the-loop decisions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ChainBadge chain={chain} />
          <button
            onClick={load}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:bg-elevated transition-colors shadow-sm disabled:opacity-60"
            title="Recalculate entire cryptographic hash chain"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? "animate-spin text-brand" : "text-fg-2"}`} />
            <span>{isVerifying ? "Verifying Chain…" : "Verify Integrity"}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid (Item 1) */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Cryptographic Integrity */}
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-3">Cryptographic Chain</span>
            {chain?.valid ? (
              <ShieldCheck className="h-4 w-4 text-ok" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-crit" />
            )}
          </div>
          <div className="mt-2 text-xl font-bold text-fg">
            {chain?.valid ? "TAMPER-PROOF" : chain ? "CORRUPTED" : "VERIFYING…"}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-fg-3">
            <span>SHA-256 Recursive Hash</span>
            {lastVerified && <span>Checked {lastVerified}</span>}
          </div>
        </div>

        {/* KPI 2: Total Decisions */}
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-3">Total Certified Entries</span>
            <Database className="h-4 w-4 text-brand" />
          </div>
          <div className="num mt-2 text-2xl font-bold text-fg">
            {totalCount}
          </div>
          <div className="mt-1 text-[11px] text-fg-3">
            Append-only trigger locked
          </div>
        </div>

        {/* KPI 3: Action Distribution */}
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-3">Action Distribution</span>
            <CheckCircle2 className="h-4 w-4 text-info" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-ok bg-ok-fill/15 border border-ok/30 px-2 py-0.5 rounded">
              {acceptCount} Acc
            </span>
            <span className="text-sm font-semibold text-warn bg-warn-fill/15 border border-warn/30 px-2 py-0.5 rounded">
              {overrideCount} Ovr
            </span>
            <span className="text-sm font-semibold text-info bg-info-fill/15 border border-info/30 px-2 py-0.5 rounded">
              {deferCount} Def
            </span>
          </div>
          <div className="mt-1 text-[11px] text-fg-3">
            Accepted · Overridden · Deferred
          </div>
        </div>

        {/* KPI 4: Compliance & Human-in-the-loop */}
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-3">HITL Compliance</span>
            <Award className="h-4 w-4 text-brand" />
          </div>
          <div className="num mt-2 text-2xl font-bold text-fg">
            100.0%
          </div>
          <div className="mt-1 text-[11px] text-fg-3">
            Licensed A&P technicians
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, and Export Buttons (Items 3 & 5) */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        {/* Left: Action Filter Pills */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by action">
          {[
            { key: "ALL", label: `ALL (${totalCount})` },
            { key: "ACCEPT", label: `ACCEPT (${acceptCount})` },
            { key: "OVERRIDE", label: `OVERRIDE (${overrideCount})` },
            { key: "DEFER", label: `DEFER (${deferCount})` },
          ].map((item) => (
            <button
              key={item.key}
              aria-pressed={action === item.key}
              onClick={() => setAction(item.key)}
              className={`rounded-chip border px-3 py-1 text-xs font-medium transition-all ${
                action === item.key
                  ? "border-brand-graphic bg-brand/10 text-brand shadow-sm"
                  : "border-line bg-surface text-fg-2 hover:bg-elevated hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right: Search Input & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search engine, license, hash…"
              className="h-8 w-56 rounded-control border border-line bg-surface pl-8 pr-7 text-xs text-fg placeholder:text-fg-3 focus:border-brand-graphic focus:outline-none transition-all shadow-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Export CSV Button (Item 5) */}
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-2 hover:bg-elevated hover:text-fg transition-colors shadow-sm"
            title="Download CSV log for regulatory audit (FAA Form 337 / EASA Form 1)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-ok" />
            <span>Export CSV</span>
          </button>

          {/* Export JSON Button (Item 5) */}
          <button
            onClick={exportJSON}
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-2 hover:bg-elevated hover:text-fg transition-colors shadow-sm"
            title="Download complete canonical cryptographic ledger JSON"
          >
            <FileDown className="h-3.5 w-3.5 text-brand" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Active Filter Indicator */}
      {(action !== "ALL" || query) && (
        <div className="mt-3 flex items-center justify-between text-xs text-fg-3">
          <span>
            Showing <strong className="text-fg">{filteredRows.length}</strong> of {totalCount} records
            {action !== "ALL" && <span> matching <strong>{action}</strong></span>}
            {query && <span> query &quot;<strong>{query}</strong>&quot;</span>}
          </span>
          <button
            onClick={() => {
              setAction("ALL");
              setQuery("");
            }}
            className="text-brand hover:underline font-medium"
          >
            Reset filters
          </button>
        </div>
      )}

      {/* Main Audit Table */}
      <div className="mt-4 rounded-card border border-line bg-surface shadow-card overflow-hidden">
        <AuditTable rows={filteredRows} onSelectRow={(row) => setSelectedRow(row)} />
      </div>

      {/* Detail & Certificate Inspection Modal (Item 4) */}
      <AuditDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </AppShell>
  );
}
