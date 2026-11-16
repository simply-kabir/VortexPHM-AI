# VortexPHM-AI: Aero-Engine Telemetry Anomaly Detection & Decision Support Engine
## Comprehensive User Flows & Interaction Specifications

---

## 1. User Personas

VortexPHM-AI is designed around three primary user archetypes operating within airline technical operations:

| Persona | Role | Primary Goals | Key Pain Points |
| :--- | :--- | :--- | :--- |
| **Marcus Vance** | *Line Maintenance Engineer (LME)* | Perform fast turnaround inspections, make Go/No-Go dispatch decisions, clear fault alerts within 45-minute gate turns. | Overloaded by false alarms, lacks time to decipher complex ML models, needs clear AMM task recommendations. |
| **Dr. Elena Rostova** | *Fleet Reliability Analyst (FRA)* | Track fleet-wide wear trends, analyze recurring component degradation, monitor ML false alarm rates and model drift. | Siloed maintenance databases, difficulty correlating early sensor drift with long-term engine teardown results. |
| **David Chen** | *Maintenance Quality & Airworthiness Auditor* | Verify regulatory compliance (FAA/EASA), audit engineer overrides, ensure all maintenance actions have documented justifications. | Incomplete paper logs, lack of tamper-evident records for deferred maintenance, opaque AI decision processes. |

---

## 2. Core User Flows

> All numeric values in the flows below (scores, confidences, urgency, sensor deviations) are **illustrative**. Real values come from the benchmark and replay outputs. Temperatures are in the native dataset unit (°R); the UI may also show K.

### 2.1 Flow 1: Real-Time Telemetry Alert & Triage Flow
*Actor: Line Maintenance Engineer (Marcus Vance)*

```mermaid
sequenceDiagram
    autonumber
    actor LME as Line Maintenance Engineer
    participant UI as Next.js Dashboard
    participant API as FastAPI Backend
    participant ML as Dual-Model Inference Engine
    participant DB as System Database

    Note over LME, UI: Aircraft lands at gate; Telemetry offloaded via ACARS / Gatelink
    API->>ML: Evaluate batch telemetry (Engine SN: ENG-CFM-042)
    ML->>ML: Compute Anomaly Score (A_score = 0.84)
    ML->>ML: Classify Fault (HPC Efficiency Degradation, 91.4% confidence)
    ML->>API: Return Triage Urgency (U = 82 / 100, Tier 1 Urgent)
    API->>DB: Persist alert event and triage case
    API-->>UI: Push Real-Time Alert via SSE (polling fallback)
    UI->>LME: High-Priority Red Badge appears on Fleet Triage Board
    LME->>UI: Clicks on ENG-CFM-042 card in Urgency Queue
    UI->>LME: Displays Engine Health Cockpit with Dual-Model Summary
```

### 2.2 Flow 2: Deep-Dive Diagnostics & XAI Attribution Flow
*Actor: Line Maintenance Engineer (Marcus Vance)*

```mermaid
flowchart TD
    A["LME selects alerted engine on Triage Board"] --> B["System loads Engine Cockpit: 3D engine hero + Telemetry / Explain / Decide / Audit tabs"]
    B --> C["Review Dual-Model Comparison Panel"]
    C --> D{"Is Anomaly Lead-Time > 35 cycles?"}
    D -->|Yes| E["Early warning confirmed; gradual degradation pattern"]
    D -->|No| F["Sudden event warning; check for FOD or sensor malfunction"]
    E & F --> G["Navigate to Explainable AI (SHAP) Waterfall Panel"]
    G --> H["Inspect Top-3 Contributing Thermodynamic Sensors"]
    H --> I["View Sensor 1: HPC Exit Temp T30 (+24.2 °R deviation)"]
    H --> J["View Sensor 2: Static Pressure Ps30 (-1.9 psi deviation)"]
    H --> K["View Sensor 3: Core Spool Speed Nc (-38 RPM deviation)"]
    I & J & K --> L["Examine Historical Telemetry Sparklines against Nominal Envelope"]
    L --> M["LME verifies physical plausibility of HPC Core Degradation"]
    M --> N["Proceed to Maintenance Decision Action Modal"]
```

### 2.3 Flow 3: Maintenance Action Sign-off & Human Override Protocol
*Actor: Line Maintenance Engineer (Marcus Vance) & Quality Auditor (David Chen)*

```mermaid
flowchart TD
    A["LME opens Maintenance Action Modal"] --> B["System presents AI Recommendation: Urgent Borescope Inspection AMM 72-00-00, Ground Aircraft AOG"]
    B --> C{"Does Engineer Agree with AI Assessment?"}
    
    C -->|YES: Accept Recommendation| D["LME clicks 'Accept Recommendation'"]
    D --> E["System pre-populates Work Order WO-2026-8812 with AMM task codes"]
    E --> F["LME enters licence ID and technical justification (min 50 chars)"]
    F --> G["Work Order stub created (MRO ERP integration is future work)"]
    G --> H["Engine status transitions to 'MAINTENANCE_IN_PROGRESS'"]

    C -->|NO: Override AI Decision| I["LME clicks 'Override AI Diagnosis'"]
    I --> J["System prompts Mandatory Override Form"]
    J --> K["LME selects Override Category: False Alarm / Reclassified / Defer to Next Hub"]
    K --> L["LME inputs mandatory minimum 50-character technical justification"]
    L --> M["LME confirms licence ID"]
    M --> N["System appends the entry to the hash-chained audit log"]
    N --> O["High-priority notification sent to David Chen (Airworthiness Auditor)"]
    O --> P["Engine dispatched with MEL (Minimum Equipment List) restriction"]
```

### 2.4 Flow 4: Fleet-Wide Model Evaluation & Retraining Review
*Actor: Fleet Reliability Analyst (Dr. Elena Rostova)*

```mermaid
sequenceDiagram
    autonumber
    actor FRA as Fleet Reliability Analyst
    participant UI as Next.js Analytics Portal
    participant API as FastAPI Backend
    participant ML as Model Evaluation Suite
    participant DB as Database Audit Logs

    FRA->>UI: Navigates to 'Model Governance & Evaluation' Tab
    UI->>API: GET /api/v1/metrics/lead-time-comparison?timeframe=30d
    API->>DB: Query historical anomalies, actual failure cycles, and engineer overrides
    API->>ML: Compute Lead Time (T_lead), False Alarm Rate (FAR), and Macro-F1
    ML-->>API: Return benchmark metrics
    API-->>UI: Populate comparative ROC curves and Override Breakdown
    UI->>FRA: Displays Lead Time, FAR, Macro-F1 and Override Rate from the latest benchmark run (values shown are illustrative)
    FRA->>UI: Drills down into Overridden Cases
    UI->>FRA: Reveals 12 overrides caused by thermal sensor drift at high altitude
    FRA->>UI: Triggers 'Calibrate Sensor Drift Filter & Export Fine-Tuning Batch'
```

---

## 3. Interaction State Transitions

The state of an aero-engine within VortexPHM-AI follows a deterministic finite state machine (FSM):

```mermaid
stateDiagram-v2
    [*] --> NOMINAL : Engine Commissioned / Nominal Telemetry
    NOMINAL --> SENSING_ANOMALY : Anomaly flag set (score above calibrated threshold)
    SENSING_ANOMALY --> NOMINAL : Flags clear before persistence is reached (transient noise)
    SENSING_ANOMALY --> ACTIVE_ALERT : Flag set in >= 3 of the last 5 cycles
    
    ACTIVE_ALERT --> TRIAGE_PENDING : Dual-Model isolates fault, sets Urgency Score (Tier 1 >= 70, Tier 2 40-69, Tier 3 < 40)
    TRIAGE_PENDING --> WORK_ORDER_ISSUED : Engineer clicks ACCEPT
    TRIAGE_PENDING --> OVERRIDDEN : Engineer clicks OVERRIDE (Justified)
    TRIAGE_PENDING --> DEFERRED : Engineer clicks DEFER (1 Leg max)
    
    WORK_ORDER_ISSUED --> IN_MAINTENANCE : Hangar crew starts inspection
    IN_MAINTENANCE --> POST_MAINTENANCE_TEST : Component washed / replaced
    POST_MAINTENANCE_TEST --> NOMINAL : Telemetry verifies baseline recovery
    
    DEFERRED --> ACTIVE_ALERT : Flight leg completed; mandatory re-inspection
```
