"use client";
import { useState } from "react";
import { FileSignature, Link2 } from "lucide-react";
import { postJSON, type Diagnosis } from "@/lib/api";
import TierBadge from "@/components/fleet/TierBadge";
import { faultLabel, usd } from "@/lib/api";

const ACTIONS = ["ACCEPT", "OVERRIDE", "DEFER"] as const;
type Action = (typeof ACTIONS)[number];

export default function DecisionForm({ d, onLogged }: { d: Diagnosis; onLogged?: () => void }) {
  const [action, setAction] = useState<Action>("ACCEPT");
  const [lic, setLic] = useState("");
  const [just, setJust] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const licOk = /^[A-Z0-9-]{6,20}$/.test(lic);
  const ok = licOk && just.trim().length >= 50;

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      const r = await postJSON<{ id: number; entry_hash: string; prev_hash: string }>("/decision/action", { engine_id: d.engine_id, cycle: d.cycle, action, engineer_license: lic, justification: just.trim() });
      setMsg({ ok: true, text: `Logged as #${r.id} · hash ${r.entry_hash.slice(0, 16)}… (prev ${r.prev_hash.slice(0, 8)}…)` });
      setJust(""); onLogged?.();
    } catch { setMsg({ ok: false, text: "The server rejected the entry. Check the licence format and the 50-character justification." }); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-card border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">AI recommendation (cycle {d.cycle})</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2"><TierBadge tier={d.urgency.tier} /><span className="text-sm">{faultLabel(d.fault_class)}</span></div>
        <dl className="num mt-3 grid grid-cols-2 gap-2 text-xs text-fg-2">
          <dt>Urgency</dt><dd className="text-fg">{d.urgency.index.toFixed(1)}</dd>
          <dt>RUL</dt><dd className="text-fg">{d.rul.toFixed(0)} ± {d.rul_sigma.toFixed(0)} cycles</dd>
          <dt>Defer vs inspect</dt><dd className="text-fg">{usd(d.cost.expected_cost_defer)} vs {usd(d.cost.cost_act_now)}</dd>
          <dt>Suggestion</dt><dd className="text-fg">{d.cost.suggestion}</dd>
        </dl>
        <ul className="mt-3 space-y-1 text-xs">{d.amm.map((a) => <li key={a.code + a.task}><span className="num text-brand">{a.code}</span> <span className="text-fg-2">{a.task}</span></li>)}</ul>
        <p className="mt-3 text-[11px] text-fg-3">AMM references are illustrative. Cost figures are assumption-based.</p>
      </div>

      <div className="rounded-card border border-line bg-surface p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><FileSignature className="h-4 w-4" aria-hidden /> Engineer decision</h3>
        <div role="radiogroup" aria-label="Action" className="mt-3 inline-flex overflow-hidden rounded-control border border-line">
          {ACTIONS.map((a) => (
            <button key={a} role="radio" aria-checked={action === a} onClick={() => setAction(a)} className={`px-4 py-1.5 text-sm transition-colors duration-fast ${action === a ? "bg-brand text-brand-on" : "bg-surface text-fg-2 hover:bg-elevated"}`}>{a}</button>
          ))}
        </div>
        <label className="mt-3 block text-xs text-fg-2">Licence ID
          <input value={lic} onChange={(e) => setLic(e.target.value.toUpperCase())} placeholder="LME-204981" className="num mt-1 w-full rounded-control border border-line bg-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--brand-graphic))]" />
        </label>
        {lic && !licOk && <p className="mt-1 text-xs text-crit">6-20 characters: A-Z, 0-9 and dashes.</p>}
        <label className="mt-3 block text-xs text-fg-2">Technical justification
          <textarea value={just} onChange={(e) => setJust(e.target.value)} rows={4} className="mt-1 w-full rounded-control border border-line bg-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--brand-graphic))]" placeholder="Explain the decision (min 50 characters)" />
        </label>
        <div className={`num text-xs ${just.trim().length >= 50 ? "text-ok" : "text-fg-3"}`}>{just.trim().length}/50</div>
        <button disabled={!ok || busy} onClick={submit} className="mt-3 inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-sm font-medium text-brand-on transition-colors duration-fast hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40">
          <Link2 className="h-4 w-4" aria-hidden /> {busy ? "Sealing…" : `Seal ${action} in audit log`}
        </button>
        {msg && <p role="status" className={`num mt-3 text-xs ${msg.ok ? "text-ok" : "text-crit"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
