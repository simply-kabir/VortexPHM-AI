"use client";
import { useState } from "react";
import type { AuditRow } from "@/lib/api";

export default function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!rows.length) return <p className="p-4 text-sm text-fg-2">No entries yet. Decisions made in the cockpit appear here.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs text-fg-3"><tr><th className="p-3">#</th><th>Time (UTC)</th><th>Engine · cycle</th><th>Action</th><th>Licence</th><th>Justification</th><th>Hash</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="num p-3">{r.id}</td>
              <td className="num text-xs text-fg-2">{r.ts.slice(0, 19).replace("T", " ")}</td>
              <td className="text-xs">{r.engine_id} · c{r.cycle}</td>
              <td><span className="rounded-chip bg-elevated px-2 py-0.5 text-xs">{r.action}</span></td>
              <td className="num text-xs">{r.engineer_license}</td>
              <td className="max-w-sm text-xs text-fg-2">
                {open === r.id || r.justification.length < 90 ? r.justification : `${r.justification.slice(0, 90)}…`}
                {r.justification.length >= 90 && <button className="ml-1 text-brand" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "less" : "more"}</button>}
              </td>
              <td className="num text-xs text-fg-3" title={`prev ${r.prev_hash}`}>{r.entry_hash.slice(0, 12)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
