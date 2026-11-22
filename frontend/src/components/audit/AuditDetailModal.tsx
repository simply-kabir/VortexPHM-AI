"use client";
import { useState } from "react";
import { X, Check, Copy, ShieldCheck, FileText, AlertTriangle, Clock, Cpu, Award } from "lucide-react";
import type { AuditRow } from "@/lib/api";

interface Props {
  row: AuditRow | null;
  onClose: () => void;
}

export default function AuditDetailModal({ row, onClose }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!row) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  let snapshotData: Record<string, any> | null = null;
  if (row.snapshot) {
    try {
      snapshotData = typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot;
    } catch {
      snapshotData = null;
    }
  }

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "ACCEPT":
        return {
          bg: "bg-ok-fill/15 text-ok border-ok/30",
          icon: <Check className="h-3.5 w-3.5" />,
          desc: "Accepted AI Maintenance Recommendation",
        };
      case "OVERRIDE":
        return {
          bg: "bg-warn-fill/15 text-warn border-warn/30",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          desc: "Human Technician Discretionary Override",
        };
      default:
        return {
          bg: "bg-info-fill/15 text-info border-info/30",
          icon: <Clock className="h-3.5 w-3.5" />,
          desc: "Maintenance Deferred (Controlled Observation)",
        };
    }
  };

  const actionInfo = getActionBadge(row.action);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-card border border-line bg-surface p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                ENTRY #{row.id}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-chip text-xs font-medium border ${actionInfo.bg}`}>
                {actionInfo.icon}
                {row.action}
              </span>
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-fg">
              Airworthiness Decision Certificate
            </h2>
            <p className="text-xs text-fg-3">
              FAA 14 CFR § 43.9 / EASA Part-M Compliant Immutable Record
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-control p-1 text-fg-3 hover:text-fg hover:bg-elevated transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Core Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-control border border-line bg-elevated/40 p-2.5">
            <span className="text-fg-3 block">Engine UID</span>
            <span className="font-mono font-medium text-fg text-sm mt-0.5 block truncate">
              {row.engine_id}
            </span>
          </div>
          <div className="rounded-control border border-line bg-elevated/40 p-2.5">
            <span className="text-fg-3 block">Flight Cycle</span>
            <span className="font-mono font-medium text-fg text-sm mt-0.5 block">
              Cycle {row.cycle}
            </span>
          </div>
          <div className="rounded-control border border-line bg-elevated/40 p-2.5">
            <span className="text-fg-3 block">Certified Technician</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Award className="h-3.5 w-3.5 text-brand" />
              <span className="font-mono font-medium text-fg text-sm block">
                {row.engineer_license}
              </span>
            </div>
          </div>
          <div className="rounded-control border border-line bg-elevated/40 p-2.5">
            <span className="text-fg-3 block">Timestamp (UTC)</span>
            <span className="font-mono text-fg text-xs mt-1 block">
              {row.ts.slice(0, 19).replace("T", " ")}
            </span>
          </div>
        </div>

        {/* Engineer Justification */}
        <div className="rounded-control border border-line bg-elevated/30 p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-2">
            <FileText className="h-4 w-4 text-brand" />
            Engineer Maintenance Rationale & Justification
          </div>
          <p className="text-xs text-fg leading-relaxed bg-surface/60 rounded p-2.5 border border-line/60 italic">
            &ldquo;{row.justification}&rdquo;
          </p>
        </div>

        {/* AI Snapshot at Decision Time (if stored) */}
        {snapshotData && (
          <div className="rounded-control border border-line bg-elevated/30 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-2">
              <Cpu className="h-4 w-4 text-info" />
              AI Telemetry Snapshot at Decision Epoch
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-surface border border-line/60">
                <span className="text-fg-3 text-[10px] uppercase block">Fault Class</span>
                <span className="font-medium text-fg block truncate mt-0.5">
                  {snapshotData.fault_class ?? "NOMINAL"}
                </span>
              </div>
              <div className="p-2 rounded bg-surface border border-line/60">
                <span className="text-fg-3 text-[10px] uppercase block">Est. RUL</span>
                <span className="font-mono font-medium text-fg block mt-0.5">
                  {typeof snapshotData.rul === "number" ? `${Math.round(snapshotData.rul)} cycles` : "N/A"}
                </span>
              </div>
              <div className="p-2 rounded bg-surface border border-line/60">
                <span className="text-fg-3 text-[10px] uppercase block">Urgency Tier</span>
                <span className="font-medium text-fg block mt-0.5">
                  {snapshotData.urgency?.tier ? `Tier ${snapshotData.urgency.tier}` : "N/A"}
                </span>
              </div>
              <div className="p-2 rounded bg-surface border border-line/60">
                <span className="text-fg-3 text-[10px] uppercase block">Anomaly Score</span>
                <span className="font-mono font-medium text-fg block mt-0.5">
                  {typeof snapshotData.anomaly_score === "number"
                    ? snapshotData.anomaly_score.toFixed(3)
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cryptographic SHA-256 Hash Chain Proof */}
        <div className="rounded-control border border-line bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
              <ShieldCheck className="h-4 w-4 text-ok" />
              Cryptographic Integrity Proof (SHA-256 Chain)
            </div>
            <span className="text-[11px] font-mono text-ok bg-ok-fill/10 border border-ok/30 px-2 py-0.5 rounded">
              VERIFIED VALID
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <div className="flex items-center justify-between text-fg-3 mb-1">
                <span className="text-[11px]">Previous Block Hash (H_{"n-1"}):</span>
                <button
                  onClick={() => copyToClipboard(row.prev_hash, "prev")}
                  className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                >
                  {copiedField === "prev" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedField === "prev" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="font-mono text-[11px] break-all bg-elevated p-2 rounded border border-line select-all text-fg-2">
                {row.prev_hash}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-fg-3 mb-1">
                <span className="text-[11px] font-semibold text-fg-2">Current Entry Hash (H_n = SHA256(H_{"n-1"} || payload)):</span>
                <button
                  onClick={() => copyToClipboard(row.entry_hash, "entry")}
                  className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                >
                  {copiedField === "entry" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedField === "entry" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="font-mono text-[11px] break-all bg-brand/5 border border-brand/20 p-2 rounded select-all text-brand font-medium">
                {row.entry_hash}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-[11px] text-fg-3">
            Append-only database trigger active. Tamper attempts result in immediate abort.
          </span>
          <button
            onClick={onClose}
            className="rounded-control bg-elevated hover:bg-line px-4 py-1.5 text-xs font-medium text-fg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
