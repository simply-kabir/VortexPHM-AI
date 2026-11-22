import { STATIONS, type Station } from "./stations";

export type StationRisk = Record<Station, number>;

export const zeroRisk = (): StationRisk =>
  Object.fromEntries(STATIONS.map((s) => [s.id, 0])) as StationRisk;

/** Probability mode: sum the class probabilities that map to each station (0..1). */
export function riskFromProbabilities(probs: Record<string, number>): StationRisk {
  const risk = zeroRisk();
  for (const s of STATIONS) if (s.faultClass) risk[s.id] = Math.min(1, probs[s.faultClass] ?? 0);
  return risk;
}

/** SHAP mode: |SHAP| of each station's sensors, normalised by the largest station (0..1). */
export function riskFromShap(shapBySensor: Record<string, number>): StationRisk {
  const raw = zeroRisk();
  for (const s of STATIONS) raw[s.id] = s.sensors.reduce((a, c) => a + Math.abs(shapBySensor[c] ?? 0), 0);
  const max = Math.max(...Object.values(raw), 1e-9);
  const out = zeroRisk();
  for (const s of STATIONS) out[s.id] = Math.min(1, raw[s.id] / max);
  return out;
}

export const scaleRisk = (r: StationRisk, k: number): StationRisk =>
  Object.fromEntries(Object.entries(r).map(([id, v]) => [id, Math.max(0, Math.min(1, v * k))])) as StationRisk;

/** Demo presets for the Digital Twin & Models page. */
export const PRESETS: { id: string; label: string; risk: StationRisk; faultClass?: string }[] = [
  { id: "healthy", label: "Healthy (Nominal)", risk: zeroRisk(), faultClass: "NOMINAL" },
  { id: "hpt", label: "HPT Thermal Distress", risk: { ...zeroRisk(), hpt: 0.95, combustor: 0.25 }, faultClass: "FAULT_HPT_THERMAL" },
  { id: "lpt", label: "LPT Degradation", risk: { ...zeroRisk(), lpt: 0.9, hpt: 0.15 }, faultClass: "FAULT_LPT" },
  { id: "drift", label: "Sensor Drift (T48/P25)", risk: { ...zeroRisk(), hpt: 0.6, hpc: 0.5 }, faultClass: "FAULT_SENSOR_DRIFT" },
  { id: "hpc", label: "HPC Efficiency Drop", risk: { ...zeroRisk(), hpc: 0.95, lpc: 0.2 }, faultClass: "FAULT_HPC_EFFICIENCY" },
  { id: "fan", label: "Fan / LPC Aerodynamic", risk: { ...zeroRisk(), fan: 0.85, lpc: 0.65 }, faultClass: "FAULT_FAN_LPC" },
];
