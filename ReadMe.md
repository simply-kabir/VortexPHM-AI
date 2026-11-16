# VortexPHM-AI: Aero-Engine Telemetry Anomaly Detection & Decision Support Engine

[![Python Version](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Maintenance Standards](https://img.shields.io/badge/Aviation-DO--178C%20%7C%20ARP4754A-red.svg)]()

> **VortexPHM-AI** is an advanced, industrial-grade Prognostics and Health Management (PHM) and Decision Support System (DSS) engineered for commercial turbofan aero-engines. It seamlessly unifies **unsupervised anomaly detection** for early fault warning, **supervised multi-class fault classification** for component-level diagnosis, **Explainable AI (TreeSHAP)** for root-cause evidence, and an **auditable Human-in-the-Loop maintenance cockpit** with engineer override capture.

---

## 1. System Architecture at a Glance

```
                  ┌────────────────────────────────────────────────────────┐
                  │               AIRCRAFT TELEMETRY INGEST                │
                  │   21 Turbofan Sensors (EGT, P30, Ps30, Nf, Nc, Wf)     │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │       PREPROCESSING & REGIME NORMALIZATION (θ, δ)      │
                  │       Sliding-Window Feature Extraction (W=10 cycles)  │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
         ┌───────────────────────────────┐         ┌───────────────────────────────┐
         │     UNSUPERVISED ANOMALY      │         │   SUPERVISED CLASSIFICATION   │
         │   (Isolation Forest / LSTM)   │         │    (XGBoost Multi-Class)      │
         │  Lead-Time: per benchmark    │         │  HPC, Fan, HPT, Sensor Drift  │
         └───────────────┬───────────────┘         └───────────────┬───────────────┘
                         │                                         │
                         └────────────────────┬────────────────────┘
                                              │ (Arbitrated Trigger)
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │        EXPLAINABLE AI ENGINE (TreeSHAP & RADAR)        │
                  │     Top-3 Sensor Attributions (T30: +18K, Ps30: -1.8)   │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │      HUMAN-IN-THE-LOOP MAINTENANCE DECISION COCKPIT    │
                  │      Urgency Ranking (0-100) | AMM Action Recommendations│
                  │      Engineer Acceptance & Cryptographic Override Log  │
                  └────────────────────────────────────────────────────────┘
```

---

## 2. Core Documentation Index

The complete engineering and design specifications are documented in the root and `docs/` folder:

| Document | Purpose & Core Content |
| :--- | :--- |
| **[Project_Overview.md](Project_Overview.md)** | Problem statement, aviation maintenance costs, turbofan physics, and faculty objectives. |
| **[Requirements.md](Requirements.md)** | Functional requirements (FR-01-18), non-functional requirements (NFR-01-12), and aviation constraints. |
| **[User_Flows.md](User_Flows.md)** | Personas (Line Engineer, Reliability Analyst, Auditor), sequence diagrams, and state transitions. |
| **[System_Architecture.md](System_Architecture.md)** | C4 container model, dual-branch inference pipeline, TreeSHAP formulation, and Next.js/FastAPI stack. |
| **[Database_Design.md](Database_Design.md)** | Entity-Relationship diagram, complete SQL DDL tables, indexing, and immutable audit logs. |
| **[API_Specifications.md](API_Specifications.md)** | OpenAPI 3.0 REST specifications, request/response JSON payloads, and error contracts. |
| **[UI_Design.md](UI_Design.md)** | Dual-theme Titanium Industrial design system (orange accent), laptop-optimised layouts, interactive 3D engine specification, components and accessibility. |
| **[Project_Plan.md](Project_Plan.md)** | 5-phase execution Gantt roadmap, Work Breakdown Structure (WBS), and risk matrix. |
| **[Evaluation_Framework.md](Evaluation_Framework.md)** | Metric definitions (lead time, FAR, Macro-F1, SHAP latency, NDCG), engine-level protocol, ablations, and empty result tables filled from `results/`. |
| **[Canonical_Parameters.md](Canonical_Parameters.md)** | Single source of truth for thresholds, weights, tiers, units, dataset rules and API/route conventions. |
| **[Master_Build_Guide.md](Master_Build_Guide.md)** | Step-by-step build guide (modules M0-M18): data, pipeline, models, API, frontend, 3D assets, integration, deployment, demo. |
| **[PROGRESS.md](PROGRESS.md)** | What has been done, what is verified, what is open. |
| **[docs/Backend_Code_Reference.md](docs/Backend_Code_Reference.md)** | Long-form walkthrough of the backend code. |
| **[CHANGELOG.md](CHANGELOG.md)** | What changed in this documentation revision and why. |

---

## 3. Directory Layout

```
VortexPHM-AI/
├── Project_Overview.md             # High-level mission, physics & objective mapping
├── Requirements.md                 # System Requirements Specification (SRS)
├── User_Flows.md                   # Interactive workflows & sequence diagrams
├── System_Architecture.md          # C4 design, dual-branch ML & pipeline
├── Database_Design.md              # Relational schema, ERD & SQL DDL
├── API_Specifications.md           # OpenAPI REST API specifications
├── UI_Design.md                    # Glass-cockpit dark HUD design system & wireframes
├── Project_Plan.md                 # 5-phase WBS & Gantt roadmap
├── Evaluation_Framework.md         # Objective 1, 2, 3 quantitative criteria & benchmarks
├── ReadMe.md                       # Project landing page & quickstart
├── docs/                           # Mirrored documentation copies
├── data/
│   ├── raw/                        # N-CMAPSS .h5 files + C-MAPSS FD001-FD004 text files (git-ignored)
│   ├── processed/                  # Parquet feature matrices (git-ignored)
│   ├── synthetic/                  # Optional exports of injected sensor-drift units
│   └── serving/                    # Compact demo fleet (Parquet) shipped with the deployment
├── notebooks/                      # Jupyter research & visualization notebooks
│   ├── 01_eda_and_sensor_profiling.ipynb
│   ├── 02_anomaly_detection_benchmarks.ipynb
│   ├── 03_supervised_fault_classification.ipynb
│   └── 04_xai_shap_decision_matrices.ipynb
├── results/                        # Generated benchmark + quality JSON files and figures
├── Dockerfile / docker-compose.yml # Slim serving image and local full-stack run
├── backend/                        # FastAPI REST API & Machine Learning Pipeline
│   ├── src/
│   │   ├── core/                   # Configuration, logging & thermodynamic constants
│   │   ├── data_pipeline/          # Ingestion, regime correction (θ, δ) & quality audits
│   │   ├── models/                 # Anomaly detectors (iForest/AE) & Classifiers (XGBoost)
│   │   ├── xai/                    # TreeSHAP explainer & sensor attribution logic
│   │   ├── decision_engine/        # Urgency scoring, AMM matrix & audit trail logic
│   │   └── api/                    # FastAPI routes & Pydantic schemas
│   ├── artifacts/                  # Trained XGBoost JSON, Isolation Forest joblib, meta.json (committed)
│   ├── scripts/                    # inspect_ncmapss.py, export_serving.py
│   └── tests/                      # Pytest unit & benchmark tests
└── frontend/                       # Modern Next.js 15 App Router Frontend
    └── src/
        ├── app/                    # App router pages (Fleet, Engine Cockpit, XAI, Audit)
        └── components/             # Reusable HUD cards, sparklines, waterfalls & modals
```

---

## 4. Quickstart Guide

### 4.1 Prerequisites
- **Python** 3.12 or 3.13 (3.12 is the safest for binary wheels; the Docker image uses 3.12)
- **Node.js** 20+ (24 works) and npm
- **Docker** (optional, for the packaged run)
- **Data**: download N-CMAPSS `.h5` files and C-MAPSS text files from the NASA Prognostics Center of Excellence data repository into `data/raw/ncmapss/` and `data/raw/cmapss/`. Keep the repository out of cloud-sync folders (e.g. OneDrive) or exclude `data/`.

### 4.2 Backend Setup (FastAPI & ML Engine)
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate          # Windows   (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt     # install the CUDA build of PyTorch separately if you want GPU training

# Build datasets, train and benchmark (see Evaluation_Framework.md section 5)
python -m scripts.inspect_ncmapss ../data/raw/ncmapss/<file>.h5
python -m src.data_pipeline.build_dataset --dataset ncmapss
python -m src.models.train_models --dataset ncmapss
python -m scripts.export_serving

# Start the API
uvicorn src.api.main:app --reload --port 8000
```
API: `http://localhost:8000/api/v1` (Swagger docs at `http://localhost:8000/docs`).

### 4.3 Frontend Setup (Next.js 15 dual-theme console)
```bash
cd frontend
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm run dev
```
Dashboard: `http://localhost:3000`.

### 4.4 Docker (packaged run) and deployment
```bash
docker compose up --build
```
Deployment outline: backend as a Docker web service (set `CORS_ORIGINS` and a persistent `DATABASE_URL`/disk for the audit log), frontend on Vercel with `NEXT_PUBLIC_API_URL`. See the Build Guide for details.

---

## 5. Faculty Objective Verification Mapping

> Benchmark results are generated into `results/`. No result numbers are quoted in this README.

| Objective | Target Requirement | VortexPHM-AI Metric / Verification Method | Verification Document |
| :--- | :--- | :--- | :--- |
| **Objective 1** | Reproducible Sensor Dataset & Quality Checks | Automated checks: Completeness $\ge 99.98\%$, SNR $> 32\text{ dB}$, $\Phi(x)$ thermodynamic consistency. | [Evaluation_Framework.md](Evaluation_Framework.md#2-objective-1-evaluation-sensor-feature-dataset-quality) |
| **Objective 2** | Anomaly Detection vs. Supervised Classification | Anomaly Lead Time ($T_{\text{lead}} \ge 35\text{ cycles}$), False Alarm Rate ($\le 2\%$), Classifier Macro-F1 ($\ge 0.91$). | [Evaluation_Framework.md](Evaluation_Framework.md#3-objective-2-evaluation-anomaly-detection-vs-supervised-classification) |
| **Objective 3** | Decision Interface, XAI Evidence & Override Audit | Dynamic Urgency score ($0-100$), TreeSHAP waterfall ($\le 120\text{ ms}$), 100% of engineer actions in a hash-chained audit log. | [Evaluation_Framework.md](Evaluation_Framework.md#4-objective-3-evaluation-decision-support--human-in-the-loop-interface) |

---

## 6. License & Citation
Developed for academic research and advanced industrial evaluation under the MIT License.
