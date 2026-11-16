# VortexPHM-AI: Aero-Engine Telemetry Anomaly Detection & Decision Support Engine
## Comprehensive System Requirements Specification (SRS)

---

## 1. Introduction & Scope
This document defines the complete functional requirements (FR), non-functional requirements (NFR), and operational constraints for the **VortexPHM-AI** system. These specifications align with standard aviation safety guidelines (ARP4754A, ARP4761) and software engineering best practices for mission-critical Decision Support Systems.

---

## 2. Functional Requirements (FR)

### 2.1 Telemetry Ingestion & Data Quality Assurance (FR-01 to FR-04)
- **FR-01 [Multi-Sensor Ingestion]**: The system shall ingest multivariate turbofan telemetry. C-MAPSS provides 21 sensor channels and 3 operating settings; N-CMAPSS provides 14 measured sensor channels (e.g. Wf, Nf, Nc, T24, T30, T48, T50, P15, P2, P21, P24, Ps30, P40, P50) and 4 flight-condition descriptors (altitude, Mach number, throttle resolver angle, T2) sampled at 1 Hz and aggregated to one record per flight cycle (mean, standard deviation, min, max).
- **FR-02 [Operational Regime Normalization]**: The system shall apply aerodynamic corrections using fan-inlet total conditions $T_2$ and $P_2$ in the native dataset units (Rankine and psia), referenced to ISA sea level (518.67 °R = 288.15 K; 14.696 psia = 101.325 kPa):
  $$\theta = \frac{T_2}{518.67\,^\circ\text{R}}, \quad \delta = \frac{P_2}{14.696\,\text{psia}}$$
  Corrected quantities: $T/\theta$, $P/\delta$, $N/\sqrt{\theta}$, $W_f/(\delta\sqrt{\theta})$. Remaining regime effects are removed by per-regime z-scoring fitted on nominal training data only (regimes: K-Means on operating settings for C-MAPSS; flight class `Fc` for N-CMAPSS).
- **FR-03 [Automated Data Quality Validation]**: The ingestion pipeline shall execute automated sanity audits prior to feature extraction:
  - Detect and flag NaN, null, or out-of-range physical values; report completeness (target $\ge 99.98\%$).
  - Detect stuck sensors: zero variance over a sliding window of $\ge 15$ cycles for sensors that vary elsewhere in the dataset (channels constant by design are excluded and documented).
  - Check the thermodynamic hierarchy with dataset-specific rule sets: N-CMAPSS $P_2 < P_{24} < P_{30}$ and $T_2 < T_{24} < T_{30}$; C-MAPSS $P_2 < P_{15} < P_{30}$ and $T_2 < T_{24} < T_{30}$. Hot-section orderings are not asserted unless verified on the data.
  - Emit a machine-readable `quality_report_*.json` per dataset build.
- **FR-04 [Feature Engineering & Rolling Statistics]**: The system shall compute past-only (leakage-free) rolling features per engine: rolling mean and slope over $W$ flight cycles (default $W = 10$, configurable $W \in \{5, 10, 20\}$), computed on regime-normalized z-scores. Skewness and kurtosis are optional extensions.

### 2.2 Unsupervised Anomaly Detection & Early Warning (FR-05 to FR-08)
- **FR-05 [Baseline Training on Nominal Cycles]**: The anomaly detection engine shall train exclusively on confirmed nominal (pre-onset) flight cycles of training engines using unsupervised architectures (Isolation Forest served in production; LSTM Autoencoder as an offline benchmark).
- **FR-06 [Continuous Anomaly Scoring]**: For every flight cycle the system shall compute an Anomaly Score $A_{\text{score}} \in [0, 1]$ by min-max scaling the raw detector score between the median nominal validation score (0) and the 95th percentile of faulty validation scores (1), clipped to $[0,1]$.
- **FR-07 [Calibrated Thresholding]**: The alarm threshold shall be calibrated on held-out validation engines to the smallest value achieving a persistent-alarm false-alarm rate $\le 1\%$ (safety margin below the 2% acceptance target). A fixed 3-sigma limit and an EWMA control chart shall be implemented as the traditional-CBM baselines for comparison.
- **FR-08 [Persistent Alarm & Lead-Time Calculation]**: An Early Warning Alert is raised when the anomaly flag is true in at least $k = 3$ of the last $n = 5$ cycles. The first persistent alarm at or after degradation onset defines $T_{\text{detect}}$:
  $$T_{\text{lead}} = T_{\text{fail}} - T_{\text{detect}}$$

### 2.3 Supervised Multi-Class Fault Classification (FR-09 to FR-12)
- **FR-09 [Fault Isolation Model]**: The system shall incorporate a supervised multi-class classifier (XGBoost) trained on N-CMAPSS-labelled degradation trajectories and injected sensor-drift units to identify specific failure modes.
- **FR-10 [Target Fault Class Taxonomy]**: The classifier shall categorize telemetry into 5 distinct operational states (fault labels derived from N-CMAPSS health parameters; sensor drift is injected synthetically):
  1. `NOMINAL`: Normal engine health degradation rate.
  2. `FAULT_HPC_EFFICIENCY`: High-Pressure Compressor aerodynamic fouling or blade tip erosion.
  3. `FAULT_FAN_LPC`: Fan blade impact damage, unbalance, or booster degradation.
  4. `FAULT_HPT_THERMAL`: High-Pressure Turbine thermal distress or nozzle guide vane erosion.
  5. `FAULT_SENSOR_DRIFT`: Instrumentation bias or thermocouple degradation without core mechanical damage.
- **FR-11 [Prediction Confidence & Probability Distribution]**: The classifier shall output calibrated probability distributions:
  $$P(\text{Class}_i) \quad \text{for } i \in [1, \dots, 5], \quad \sum P(\text{Class}_i) = 1.0$$
  Predictions with maximum confidence $< 0.60$ shall be flagged as `UNCERTAIN_ANOMALY`.
- **FR-12 [Dual-Branch Model Handshake]**: The system shall arbitrate between the Anomaly Detector and the Fault Classifier:
  - If Anomaly Score $< \text{Threshold}$, classification is bypassed or marked as `NOMINAL` to save computation.
  - If Anomaly Score $\ge \text{Threshold}$, the classification branch is activated to isolate the root failure mode.

### 2.4 Explainable AI (XAI) & Sensor Attribution (FR-13 to FR-15)
- **FR-13 [Local SHAP Attribution]**: For every flagged anomaly and fault classification, the system shall compute exact local TreeSHAP values (XGBoost native `pred_contribs`) to quantify the exact contribution of each sensor feature to the prediction.
- **FR-14 [Top-K Contributing Sensors Extraction]**: The system shall isolate and display the top-3 to top-5 dominant degraded sensors with their direction of impact (e.g., $T_{30}$ elevated by $+22\text{ K}$, $P_{30}$ dropped by $-1.8\text{ psi}$).
- **FR-15 [Thermodynamic Deviation Waterfall]**: The system shall provide an interactive waterfall breakdown comparing current sensor values against the expected baseline value for the current flight regime.

### 2.5 Maintenance Decision Support & Triage (FR-16 to FR-18)
- **FR-16 [Composite Urgency Score]**: The system shall rank all active fleet engines in a unified maintenance queue by a composite Urgency Index ($U \in [0, 100]$):
  $$U = 100 \cdot \left[ 0.35\, S_{\text{anom}} + 0.35\, S_{\text{crit}} + 0.30\left(1 - \frac{\text{RUL}}{\text{RUL}_{\text{ref}}}\right) \right], \quad \text{RUL}_{\text{ref}} = 125$$
  Where $S_{\text{anom}} = \text{clip}\left(\frac{A - A_{\text{thr}}}{1 - A_{\text{thr}}}, 0, 1\right)$ and $S_{\text{crit}} = \sum_c P(c)\, C_c$ with criticality weights HPT Thermal = 1.0, HPC = 0.8, Fan/LPC = 0.6, Sensor Drift = 0.35, Nominal = 0.
- **FR-17 [Action Recommendation Engine]**: The system shall map classified faults and urgency tiers to Aircraft Maintenance Manual (AMM) action cards. AMM references are illustrative task references; real references depend on the engine type and operator manual.
  - Tier 1 Critical ($U \ge 70$): Immediate borescope inspection (AMM 72-00-00), ground aircraft (AOG) pending findings.
  - Tier 2 Elevated ($40 \le U < 70$): Class-specific action (e.g. compressor core wash AMM 72-41-00) within 15 flight cycles.
  - Tier 3 Monitor ($U < 40$): Continue standard monitoring; sensor-drift class triggers transducer recalibration at the next A-check.
  - `UNCERTAIN_ANOMALY` (anomalous but classifier confidence $< 0.60$): general borescope review, no class-specific work order.
- **FR-18 [Human-in-the-Loop Decision & Audit Trail]**: The interface shall require the attending engineer to review the diagnosis and record an action, each with a mandatory technical justification of at least 50 characters and the engineer licence ID:
  - `ACCEPT`: Generates a maintenance work order stub with pre-filled AMM task codes.
  - `OVERRIDE`: Engineer reclassifies the fault or lowers urgency, with reason code.
  - `DEFER`: Defers action to the next flight leg with operational limitations.
  - Every action is appended to a hash-chained audit log (entry hash = SHA-256 of previous hash + canonical payload including the AI recommendation snapshot) and is verifiable through an integrity-check endpoint. PKI/HSM digital signatures are future work.

---

## 3. Non-Functional Requirements (NFR)

### 3.1 Performance & Latency
- **NFR-01 [Inference Latency]**: End-to-end evaluation latency (data quality check + feature extraction + dual-model inference + SHAP computation) shall not exceed **150 milliseconds** per engine flight cycle window.
- **NFR-02 [API Response Time]**: REST API endpoints for fleet dashboard queries shall respond within **200 milliseconds** for p95 requests under a load of 50 concurrent requests.
- **NFR-03 [Frontend Render Time]**: The Next.js dashboard shall achieve a First Contentful Paint (FCP) of $< 1.2\text{ s}$ and Time to Interactive (TTI) of $< 2.0\text{ s}$ on standard hangar workstations.

### 3.2 Reliability, Availability & Fault Tolerance
- **NFR-04 [System Availability]**: The backend API service shall maintain **99.9% uptime** during operational hours.
- **NFR-05 [Fail-Safe Fallback]**: If the XAI SHAP computation times out or encounters numerical divergence, the system shall fail gracefully by falling back to empirical z-score sensor deviation metrics without disrupting the core anomaly alert.
- **NFR-06 [Deterministic Replay]**: The system shall provide deterministic replay capability—re-evaluating identical telemetry data with identical model weights must yield identical anomaly scores and fault probabilities.

### 3.3 Scalability & Data Retention
- **NFR-07 [Fleet Capacity]**: The system architecture shall support concurrent monitoring of at least **250 commercial aircraft engines** in real-time (design target; the demonstration fleet contains about 8 replayed engines).
- **NFR-08 [Data Retention & Archival]**: Raw telemetry, calculated feature matrices, diagnostic inferences, and engineer sign-offs shall be retained in SQLite/PostgreSQL for a minimum of **24 months** of operational cycles.

### 3.4 Security & Auditability
- **NFR-09 [Role-Based Access Control (RBAC)]** *(planned, post-demo)*: The production system shall enforce three roles: `LINE_ENGINEER` (view alerts, accept/override/defer), `RELIABILITY_ANALYST` (fleet analytics, model governance), `SYSTEM_ADMIN` (credentials, tokens, backups). The demonstration build exposes an open API behind a CORS allowlist and identifies engineers by licence ID only.
- **NFR-10 [Immutability of Audit Trails]**: Audit entries shall be stored append-only: database triggers reject UPDATE and DELETE, each entry stores `prev_hash` and `entry_hash`, and `GET /audit/verify` recomputes the chain and reports the first broken entry. A unit test demonstrates tamper detection.

---

## 4. Operational & Aviation Regulatory Constraints

1. **Advisory Decision Support Boundary**: VortexPHM-AI is a non-certified prototype designed to be treated as an advisory decision-support system (the DO-178C-style traceability matrix in the evaluation evidence illustrates the intended process; no certification is claimed). It provides non-authoritative recommendations to certified Airframe & Powerplant (A&P) licensed engineers; all airworthiness release decisions remain under human authority.
2. **Standard Atmosphere Reference**: Thermodynamic normalization uses ISA sea-level reference conditions (518.67 °R / 14.696 psia, equivalent to 288.15 K / 101.325 kPa per ICAO Doc 7488/3) applied to measured fan-inlet total conditions.
3. **Offline Hangar Execution**: The application (packaged with Docker; the serving image excludes PyTorch) must be capable of running fully offline on local air-gapped airport line maintenance servers without active public cloud connectivity.
