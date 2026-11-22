"use client";
import { useState } from "react";
import { Check, Copy, ExternalLink, AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import type { AuditRow } from "@/lib/api";
import AuditDetailModal from "./AuditDetailModal";

interface Props {
  rows: AuditRow[];
  onSelectRow?: (row: AuditRow) => void;
}

export default function AuditTable({ rows, onSelectRow }: Props) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [internalModalRow, setInternalModalRow] = useState<AuditRow | null>(null);

  const handleRowClick = (row: AuditRow) => {
    if (onSelectRow) {
      onSelectRow(row);
    } else {
      setInternalModalRow(row);
    }
  };

  const copyHash = (hash: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="h-10 w-10 rounded-full bg-elevated flex items-center justify-center text-fg-3 mb-3">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-fg">No matching audit records</p>
        <p className="text-xs text-fg-3 mt-1 max-w-sm">
          No entries found. Decisions committed by licensed engineers will appear here with cryptographic SHA-256 verification.
        </p>
      </div>
    );
  }

  const renderActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "ACCEPT":
        return (
          <span className="inline-flex items-center gap-1 rounded-chip bg-ok-fill/15 border border-ok/30 px-2 py-0.5 text-xs font-medium text-ok">
            <Check className="h-3 w-3" />
            ACCEPT
          </span>
        );
      case "OVERRIDE":
        return (
          <span className="inline-flex items-center gap-1 rounded-chip bg-warn-fill/15 border border-warn/30 px-2 py-0.5 text-xs font-medium text-warn">
            <AlertTriangle className="h-3 w-3" />
            OVERRIDE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-chip bg-info-fill/15 border border-info/30 px-2 py-0.5 text-xs font-medium text-info">
            <Clock className="h-3 w-3" />
            DEFER
          </span>
        );
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-elevated/40 text-[11px] font-medium uppercase tracking-wider text-fg-3">
            <tr>
              <th className="py-3 pl-4 pr-2">ID</th>
              <th className="py-3 px-3">Timestamp (UTC)</th>
              <th className="py-3 px-3">Engine & Cycle</th>
              <th className="py-3 px-3">Disposition</th>
              <th className="py-3 px-3">Technician License</th>
              <th className="py-3 px-3">Justification Summary</th>
              <th className="py-3 px-3">Cryptographic Digest</th>
              <th className="py-3 pl-2 pr-4 text-right">Certificate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => handleRowClick(r)}
                className="cursor-pointer transition-colors hover:bg-elevated/50 group"
              >
                <td className="py-3.5 pl-4 pr-2 num font-mono text-xs font-semibold text-fg-2">
                  #{r.id}
                </td>
                <td className="py-3.5 px-3 num font-mono text-xs text-fg-2 whitespace-nowrap">
                  {r.ts.slice(0, 19).replace("T", " ")}
                </td>
                <td className="py-3.5 px-3">
                  <div className="font-mono text-xs font-medium text-fg">{r.engine_id}</div>
                  <div className="font-mono text-[11px] text-fg-3">Cycle {r.cycle}</div>
                </td>
                <td className="py-3.5 px-3">
                  {renderActionBadge(r.action)}
                </td>
                <td className="py-3.5 px-3 font-mono text-xs font-medium text-fg-2">
                  {r.engineer_license}
                </td>
                <td className="py-3.5 px-3 max-w-xs text-xs text-fg-2">
                  <span className="line-clamp-2 leading-relaxed" title={r.justification}>
                    {r.justification}
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-mono text-xs text-fg-3 bg-surface border border-line px-1.5 py-0.5 rounded"
                      title={`Full Entry Hash:\n${r.entry_hash}\n\nPrevious Block:\n${r.prev_hash}`}
                    >
                      {r.entry_hash.slice(0, 8)}…{r.entry_hash.slice(-4)}
                    </span>
                    <button
                      onClick={(e) => copyHash(r.entry_hash, r.id, e)}
                      className="text-fg-3 hover:text-brand p-1 rounded hover:bg-elevated transition-colors"
                      title="Copy full SHA-256 hash"
                    >
                      {copiedId === r.id ? (
                        <Check className="h-3.5 w-3.5 text-ok" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="py-3.5 pl-2 pr-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(r);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg-2 hover:border-brand-graphic hover:text-brand transition-colors group-hover:border-line group-hover:bg-elevated"
                  >
                    <span>Inspect</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Internal modal fallback when not controlled by parent */}
      {!onSelectRow && internalModalRow && (
        <AuditDetailModal row={internalModalRow} onClose={() => setInternalModalRow(null)} />
      )}
    </>
  );
}
