export type Station = "fan" | "lpc" | "hpc" | "combustor" | "hpt" | "lpt" | "nozzle";
export type GroupName = Station | "shaft"; // "shaft" is structural: never tinted or selected

export interface StationInfo {
  id: Station;
  label: string;
  sensors: string[];          // N-CMAPSS channels that characterise this station (SHAP mode)
  faultClass?: string;        // classifier class that maps to this station (probability mode)
}

export const STATIONS: StationInfo[] = [
  { id: "fan", label: "Fan", sensors: ["Nf", "P2", "P21", "P15"], faultClass: "FAULT_FAN_LPC" },
  { id: "lpc", label: "LPC", sensors: ["T24", "P24"], faultClass: "FAULT_FAN_LPC" },
  { id: "hpc", label: "HPC", sensors: ["T30", "Ps30", "Nc"], faultClass: "FAULT_HPC_EFFICIENCY" },
  { id: "combustor", label: "Combustor", sensors: ["Wf"] },
  { id: "hpt", label: "HPT", sensors: ["T48", "P40"], faultClass: "FAULT_HPT_THERMAL" },
  { id: "lpt", label: "LPT", sensors: ["T50", "P50"], faultClass: "FAULT_LPT" },
  { id: "nozzle", label: "Nozzle", sensors: [] },
];

export const STATION_IDS = STATIONS.map((s) => s.id);
export const stationLabel = (id: Station) => STATIONS.find((s) => s.id === id)!.label;
