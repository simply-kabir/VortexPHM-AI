import numpy as np

CRITICALITY = {"NOMINAL": 0.0, "FAULT_SENSOR_DRIFT": 0.35, "FAULT_FAN_LPC": 0.6,
               "FAULT_HPC_EFFICIENCY": 0.8, "FAULT_LPT": 0.7, "FAULT_HPT_THERMAL": 1.0}
W_ANOM, W_CRIT, W_RUL = 0.35, 0.35, 0.30
TIER1, TIER2 = 70.0, 40.0          # tune by looking at the U distribution on validation engines


def urgency_index(anom: float, thr: float, anom_ref: float, probs: dict[str, float], rul: float, rul_cap: float = 125) -> dict:
    s_anom = float(np.clip((anom - thr) / max(anom_ref - thr, 1e-9), 0, 1))
    s_crit = float(sum(p * CRITICALITY.get(c, 0.5) for c, p in probs.items()))
    s_rul = float(1 - np.clip(rul / rul_cap, 0, 1))
    u = 100 * (W_ANOM * s_anom + W_CRIT * s_crit + W_RUL * s_rul)
    tier = 1 if u >= TIER1 else 2 if u >= TIER2 else 3      # 1 Critical, 2 Elevated, 3 Monitor
    return dict(index=round(u, 1), tier=tier, components=dict(anomaly=s_anom, criticality=s_crit, rul=s_rul))
