# VortexPHM-AI: Canonical Parameters (Single Source of Truth)

Every document, config file and code module takes its constants from this table. If a number changes, change it here first, then in `backend/src/core/config.py` and `.env.example`.

## 1. Datasets and labels
| Item | Value |
| :--- | :--- |
| Primary dataset | N-CMAPSS (flight-by-flight, 1 Hz, aggregated to one record per cycle) |
| Benchmark dataset | C-MAPSS FD001-FD004 |
| Classes | `NOMINAL`, `FAULT_HPC_EFFICIENCY`, `FAULT_FAN_LPC` (Fan + LPC merged), `FAULT_HPT_THERMAL`, `FAULT_SENSOR_DRIFT` (synthetic) |
| Excluded from classifier | LPT-dominant engines (kept for RUL and anomaly detection) |
| Runtime flag | `UNCERTAIN_ANOMALY` when anomaly flag is set and max class probability < 0.60 |
| Label source | N-CMAPSS health parameters (dominant degrading module per engine, unhealthy-state cycles) |
| Splits | By engine (official dev/test units, GroupKFold by engine) |
| Seed | 42 |

## 2. Units and physics
| Item | Value |
| :--- | :--- |
| Native units | Temperatures in degrees Rankine, pressures in psia |
| Reference | 518.67 degR (= 288.15 K), 14.696 psia (= 101.325 kPa) |
| Correction | theta = T2/518.67, delta = P2/14.696; T/theta, P/delta, N/sqrt(theta), Wf/(delta*sqrt(theta)) |
| Physics rules N-CMAPSS | P2 < P24 < P30; T2 < T24 < T30 |
| Physics rules C-MAPSS | P2 < P15 < P30; T2 < T24 < T30 |

## 3. Detection
| Item | Value |
| :--- | :--- |
| Rolling window W | 10 cycles (configurable 5/10/20), past-only |
| Anomaly score A | min-max scaled to [0,1] (median nominal validation = 0, 95th percentile faulty validation = 1) |
| Threshold calibration | smallest threshold with persistent-alarm cycle-level FAR <= 1% on validation engines |
| Persistence | at least 3 flags in the last 5 cycles |
| Baselines | fixed 3-sigma, EWMA |
| Onset | N-CMAPSS: first unhealthy cycle; C-MAPSS: T_fail - 125; injected units: drift start |

## 4. Acceptance targets
| Item | Target |
| :--- | :--- |
| Lead time | >= 35 cycles (C-MAPSS headline; N-CMAPSS also % of life) |
| FAR | <= 2.0% (cycle-level, persistent alarm) |
| Macro-F1 / Macro-Precision | >= 0.91 / >= 0.90 |
| Completeness | >= 99.98% |
| Injected noise SNR | >= 32 dB (variance-based) |
| Injected drift | +0.05% per cycle |
| TreeSHAP latency | p95 <= 120 ms |
| NDCG@K | >= 0.92 (K per fleet size) |

## 5. Urgency, tiers and cost
| Item | Value |
| :--- | :--- |
| Formula | U = 100 * [0.35*S_anom + 0.35*S_crit + 0.30*(1 - RUL/RUL_ref)] |
| S_anom | clip((A - A_thr)/(1 - A_thr), 0, 1) |
| S_crit | sum over classes of P(class) * C(class) |
| Criticality C | HPT 1.0, HPC 0.8, Fan/LPC 0.6, Sensor Drift 0.35, Nominal 0 |
| RUL_ref | 125 cycles (RUL regression target capped at 125) |
| Tier 1 Critical | U >= 70 |
| Tier 2 Elevated | 40 <= U < 70 |
| Tier 3 Monitor | U < 40 |
| Cost model (assumptions) | C_UER = 450,000 USD, inspection = 15,000 USD, defer horizon = 30 cycles |

## 6. Decisions and audit
| Item | Value |
| :--- | :--- |
| Actions | ACCEPT, OVERRIDE, DEFER |
| Justification | required for every action, >= 50 characters |
| Licence ID pattern | `^[A-Z0-9-]{6,20}$` |
| Audit integrity | SHA-256 hash chain (prev_hash, entry_hash), DB triggers block UPDATE/DELETE, `/audit/verify` |
| Digital signatures / PKI | future work |
| Authentication / RBAC | future work (demo: open API + CORS allowlist) |

## 7. API and runtime
| Item | Value |
| :--- | :--- |
| Base path | `/api/v1` |
| Live updates | Server-Sent Events (replay stream), polling fallback |
| Python | 3.12 (Docker) / 3.12-3.13 (local) |
| Serving image | no PyTorch; Isolation Forest + XGBoost only |
| Frontend env | `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` |
