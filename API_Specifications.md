# VortexPHM-AI: Aero-Engine Telemetry Anomaly Detection & Decision Support Engine
## Comprehensive REST API Specifications (OpenAPI 3.0 Standard)

---

## 1. Overview & Base Configuration
- **Base URL**: `http://localhost:8000/api/v1`
- **Protocol**: HTTP/1.1 & HTTP/2 with JSON payloads
- **Authentication**: *Planned (post-demo)*: Bearer JWT (`Authorization: Bearer <token>`) with RBAC. The demonstration build exposes an open API behind a CORS allowlist; engineers are identified by licence ID in the request body.
- **Error Format**: RFC 7807 Problem Details Standard
- **Units**: temperatures in °R and pressures in psia (native NASA dataset units); the UI may convert to K. All payload values in this document are **illustrative examples**.
- **Implementation status**: see section 7 for the endpoint map between this target contract and the demonstration build.

---

## 2. Telemetry Ingestion Endpoints

### 2.1 `POST /telemetry/ingest`
Ingests a single flight cycle's multivariate sensor readings or a continuous streaming batch.

* **Request Headers**:
  - `Content-Type: application/json`
  - `X-Source-System: QAR_Gatelink_v2`
* **Request Body**:
```json
{
  "engine_id": "ENG-CFM-042",
  "cycle_number": 218,
  "flight_conditions": {
    "altitude_feet": 35000.0,
    "mach_number": 0.82,
    "throttle_resolver_angle": 78.5
  },
  "sensor_readings": {
    "T2_total_temp": 518.67,
    "T24_lpc_out_temp": 642.85,
    "T30_hpc_out_temp": 1592.40,
    "T50_lpt_out_temp": 1408.12,
    "P2_total_press": 14.62,
    "P24_lpc_press": 21.61,
    "P30_hpc_press": 553.75,
    "Nf_fan_speed": 2388.08,
    "Nc_core_speed": 9052.34,
    "Ps30_static_press": 47.45,
    "phi_fuel_ratio": 521.80,
    "BPR_bypass_ratio": 8.42,
    "htBleed_enthalpy": 393.0
  }
}
```
* **Response Status**: `201 Created`
```json
{
  "status": "SUCCESS",
  "telemetry_id": 948201,
  "cycle_id": "CYC-ENG042-0218",
  "data_quality_report": {
    "completeness": 1.0,
    "outliers_detected": 0,
    "is_stuck_sensor": false,
    "physical_consistency_valid": true
  },
  "ingested_at": "2026-09-14T10:14:22Z"
}
```

---

## 3. Dual-Model Diagnostic Endpoints

### 3.1 `POST /diagnostics/evaluate`
Executes dual-model inference on an engine's latest telemetry window (Unsupervised Anomaly Detection + Supervised Classification + Lead-Time calculation). If the anomaly flag is set but the maximum class probability is below 0.60, `predicted_fault_class` is `UNCERTAIN_ANOMALY` and `uncertain` is `true`.

* **Request Body**:
```json
{
  "engine_id": "ENG-CFM-042",
  "window_size": 15,
  "force_deep_classification": false
}
```
* **Response Status**: `200 OK`
```json
{
  "engine_id": "ENG-CFM-042",
  "cycle_number": 218,
  "anomaly_detection": {
    "anomaly_score": 0.842,
    "dynamic_threshold": 0.620,
    "is_anomaly": true,
    "persistence_counter": 4,
    "early_detection_lead_time_cycles": 38,
    "model_name": "IsolationForest_v1"
  },
  "supervised_classification": {
    "activated": true,
    "predicted_fault_class": "FAULT_HPC_EFFICIENCY",
    "uncertain": false,
    "confidence_score": 0.914,
    "class_probabilities": {
      "NOMINAL": 0.012,
      "FAULT_HPC_EFFICIENCY": 0.914,
      "FAULT_FAN_LPC": 0.038,
      "FAULT_HPT_THERMAL": 0.024,
      "FAULT_SENSOR_DRIFT": 0.012
    },
    "model_name": "XGBoost_Classifier_v1"
  },
  "evaluation_latency_ms": 34.2
}
```

---

## 4. Explainable AI (XAI) Endpoints

### 4.1 `GET /xai/explain/{case_id}`
Returns local TreeSHAP attribution breakdowns and top contributing sensors for the diagnostic alert.

* **Response Status**: `200 OK`
```json
{
  "case_id": "CASE-2026-8812",
  "engine_id": "ENG-CFM-042",
  "target_fault": "FAULT_HPC_EFFICIENCY",
  "base_value": 0.184,
  "prediction_value": 0.914,
  "top_contributing_sensors": [
    {
      "sensor_code": "T30",
      "sensor_name": "HPC Exit Total Temperature",
      "measured_value": 1592.40,
      "nominal_baseline": 1574.00,
      "deviation": "+18.40 degR",
      "shap_attribution": 0.342,
      "impact_direction": "DRIVING_ANOMALY"
    },
    {
      "sensor_code": "Ps30",
      "sensor_name": "HPC Exit Static Pressure",
      "measured_value": 47.45,
      "nominal_baseline": 49.30,
      "deviation": "-1.85 psi",
      "shap_attribution": 0.265,
      "impact_direction": "DRIVING_ANOMALY"
    },
    {
      "sensor_code": "Nc",
      "sensor_name": "Core Spool Rotational Speed",
      "measured_value": 9052.34,
      "nominal_baseline": 9090.00,
      "deviation": "-37.66 RPM",
      "shap_attribution": 0.188,
      "impact_direction": "DRIVING_ANOMALY"
    }
  ],
  "full_shap_attribution_vector": {
    "T2": 0.001,
    "T24": 0.042,
    "T30": 0.342,
    "T50": 0.081,
    "P30": -0.015,
    "Ps30": 0.265,
    "Nf": 0.012,
    "Nc": 0.188,
    "BPR": 0.021
  },
  "explanation_latency_ms": 78.5
}
```

---

## 5. Maintenance Triage & Decision Support Endpoints

### 5.1 `GET /decision/triage-queue`
Returns the active fleet maintenance queue ranked by urgency index.

* **Query Parameters**:
  - `tier`: `all` | `critical` | `moderate` (default: `all`)
  - `status`: `OPEN` | `ACCEPTED` | `OVERRIDDEN` (default: `OPEN`)
* **Response Status**: `200 OK`
```json
{
  "total_active_cases": 3,
  "queue": [
    {
      "case_id": "CASE-2026-8812",
      "engine_id": "ENG-CFM-042",
      "aircraft_tail": "N842AA",
      "urgency_score": 84.6,
      "urgency_tier": "TIER_1_CRITICAL",
      "estimated_rul_cycles": 38,
      "isolated_fault": "FAULT_HPC_EFFICIENCY",
      "confidence": 0.914,
      "recommended_action": {
        "action_code": "ACT-HPC-BORE",
        "task_name": "High-Pressure Compressor Borescope Inspection",
        "amm_chapter": "AMM 72-00-00",
        "dispatch_recommendation": "GROUND_AIRCRAFT_AOG"
      },
      "status": "OPEN",
      "opened_at": "2026-09-14T10:14:25Z"
    }
  ]
}
```

### 5.2 `POST /decision/{case_id}/action`
Submits an engineer's formal acceptance, override, or deferral for an alert. **Every** action requires a technical justification of at least 50 characters and a licence ID, and is appended to the hash-chained audit log.

* **Request Body (Accept Example)**:
```json
{
  "engineer_license_no": "LME-204981",
  "action": "ACCEPT",
  "justification_notes": "Borescope inspection scheduled for the 22:00 hangar shift per AMM task card.",
  "work_order_notes": "Optional free text for the work order stub."
}
```
* **Request Body (Override Example)**:
```json
{
  "engineer_license_no": "LME-204981",
  "action": "OVERRIDE",
  "override_category": "FALSE_ALARM_SENSOR_BIAS",
  "overridden_fault": "FAULT_SENSOR_DRIFT",
  "justification_notes": "T30 connector was loose during turnaround; visual inspection showed no blade erosion. Thermocouple re-seated and verified."
}
```
* **Validation**: `engineer_license_no` matches `^[A-Z0-9-]{6,20}$`; `action` in `ACCEPT | OVERRIDE | DEFER`; `justification_notes` length >= 50 (otherwise `422`).
* **Response Status**: `201 Created`
```json
{
  "status": "LOGGED_AND_SEALED",
  "case_id": "CASE-2026-8812",
  "audit_id": 49,
  "entry_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "prev_hash": "5f3a0c11d9e2b7c4a8f6e1d3b2c9a0f4e7d6c5b4a3928170f6e5d4c3b2a19087",
  "timestamp": "2026-09-14T10:28:10Z"
}
```
(`entry_hash` and `prev_hash` above are placeholder values.)

### 5.3 `GET /audit` and `GET /audit/verify`
`GET /audit?limit=100` returns the newest entries. `GET /audit/verify` recomputes the whole hash chain and returns `{"valid": true, "broken_at_id": null}` or the id of the first inconsistent entry.

---

## 6. Model Governance & Benchmarking Endpoints

### 6.1 `GET /metrics/lead-time-comparison`
Returns the comparison between unsupervised anomaly detection and supervised classification **read from the latest benchmark run** (`results/benchmark_*.json`). The JSON below shows the response *shape*; the real values are produced by the evaluation scripts, so they are `null` here.

* **Response Status**: `200 OK`
```json
{
  "benchmark_summary": {
    "baseline_fixed_3sigma":  { "far_cycle": null, "median_lead_detected": null, "detection_rate": null },
    "baseline_calibrated":    { "far_cycle": null, "median_lead_detected": null, "detection_rate": null },
    "isolation_forest":       { "far_cycle": null, "far_engine": null, "median_lead_detected": null, "share_lead_ge_35": null, "median_lead_pct_of_life": null, "detection_rate": null, "drift_detection_rate": null },
    "lstm_autoencoder":       { "far_cycle": null, "median_lead_detected": null, "detection_rate": null },
    "classifier":             { "test_macro_f1": null, "test_macro_precision": null, "cv_macro_f1": [] },
    "rul":                    { "rmse_last_cycle": null, "nasa_score_last_cycle": null }
  },
  "source_file": "results/benchmark_ncmapss.json",
  "generated_at": null
}
```

---

## 7. Endpoint Map: Target Contract vs Demonstration Build

The demonstration build (FastAPI, `/api/v1` prefix) implements a flattened subset. The exact response schemas are published at `/openapi.json`.

| Target contract (this document) | Demo build route | Status |
| :--- | :--- | :--- |
| `POST /telemetry/ingest` | none (data replayed from a Parquet demo fleet) | Planned |
| `POST /diagnostics/evaluate` | `POST /diagnostics/evaluate` (body: `engine_id`, `cycle`; returns diagnosis, urgency, cost, AMM tasks and TreeSHAP in one flattened response) | Implemented |
| `GET /xai/explain/{case_id}` | included in the `explain` field of the diagnosis response | Implemented (merged) |
| `GET /decision/triage-queue` | `GET /decision/triage-queue?frac=0.75` (fleet snapshot at a "fleet time") | Implemented |
| `POST /decision/{case_id}/action` | `POST /decision/action` (body carries `engine_id` and `cycle` instead of a case id) | Implemented (simplified) |
| none | `GET /engines/{engine_id}/replay` (Server-Sent Events: one diagnosis per cycle) | Implemented |
| none | `GET /audit`, `GET /audit/verify`, `GET /health` | Implemented |
| `GET /metrics/lead-time-comparison` | `GET /metrics/benchmark` (returns every JSON file in `results/` keyed by file name) | Implemented (simplified) |
