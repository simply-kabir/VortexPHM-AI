export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type Tier = 1 | 2 | 3;
export interface Urgency { index: number; tier: Tier; components: { anomaly: number; criticality: number; rul: number } }
export interface Bar { feature: string; raw: string; shap: number; value: number; arrow: string }
export interface Cost { p_fail_within_horizon: number; horizon_cycles: number; expected_cost_defer: number; cost_act_now: number; suggestion: string; note: string }
export interface Amm { code: string; task: string }
export interface Diagnosis {
  engine_id: string; cycle: number; n_cycles: number;
  anomaly_score: number; anomaly_score_raw: number; anomaly_threshold: number; is_anomalous: boolean; uncertain: boolean;
  fault_class: string; fault_probs: Record<string, number>;
  rul: number; rul_sigma: number;
  urgency: Urgency; cost: Cost; amm: Amm[];
  sensors: Record<string, number>;
  explain?: { base_value: number; top3: Bar[]; waterfall: Bar[] }; explain_ms?: number; latency_ms: number;
}
export interface FleetRow {
  engine_id: string; cycle: number; fault_class: string; urgency: Urgency; rul: number; anomalous: boolean; cost: Cost; amm: Amm[];
}
export interface AuditRow {
  id: number; ts: string; engine_id: string; cycle: number; action: string; engineer_license: string; justification: string; entry_hash: string; prev_hash: string;
  snapshot?: string | Record<string, any>;
}
export interface AvailableEngine {
  uid: string; split: string; fault_class: string; is_virtual: boolean; cycles: number; active: boolean;
}
export interface Chain { valid: boolean; broken_at_id: number | null }

async function parse<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

const inFlight = new Map<string, Promise<any>>();

export const getJSON = <T,>(path: string): Promise<T> => {
  const url = `${API}${path}`;
  if (inFlight.has(url)) {
    return inFlight.get(url)! as Promise<T>;
  }
  const promise = fetch(url, { cache: "no-store" })
    .then((r) => parse<T>(r))
    .finally(() => {
      setTimeout(() => inFlight.delete(url), 400);
    });
  inFlight.set(url, promise);
  return promise;
};
export const postJSON = <T,>(path: string, body: unknown) =>
  fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => parse<T>(r));

const ACRONYMS = new Set(["hpc", "hpt", "lpt", "lpc"]);
export const faultLabel = (c: string) =>
  c.replace("FAULT_", "").split("_").map((w, i) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : i === 0 ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase())).join(" ");
export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
