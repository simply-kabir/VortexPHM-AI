# VortexPHM-AI Documentation Revision 2: Changelog

This revision removes inconsistencies between documents, replaces unsupported claims with reproducible-evidence rules, and upgrades the UI. Constants now live in `Canonical_Parameters.md`.

## Cross-cutting changes
| # | Change | Why |
| :--- | :--- | :--- |
| 1 | Dataset story: **N-CMAPSS (labels, fault modes) + C-MAPSS (benchmark)** | C-MAPSS has no HPT / sensor-drift / fan-vs-LPC labels |
| 2 | Units and corrections: degrees Rankine and psia, theta = T2/518.67, delta = P2/14.696 | NASA data units; inlet conditions instead of "ambient" |
| 3 | Physics rules are dataset-specific (P24 exists only in N-CMAPSS; C-MAPSS uses P15); hot-section orderings removed | Avoids asserting orderings that are false in the data |
| 4 | **All invented results removed** (38.4 cycles, FAR 1.85%, F1 0.924/0.938, override 4.8%) and replaced with "from `results/*.json`" | Metrics must come from the benchmark scripts |
| 5 | One urgency definition: weights 0.35/0.35/0.30, criticality HPT 1.0 / HPC 0.8 / Fan-LPC 0.6 / Drift 0.35, RUL_ref 125, tiers 70 / 40 | Previously three conflicting versions |
| 6 | Anomaly score scaled to [0,1], calibrated threshold, persistence 3-of-5, `UNCERTAIN_ANOMALY` (confidence < 0.60) | Consistent score semantics across docs, API and code |
| 7 | Audit trail: hash chain + append-only triggers + `/audit/verify`; all three actions logged; table renamed `decision_audit_log`; PIN/RSA token removed | "Immutable" was not enforced; scope mismatch |
| 8 | LightGBM removed (XGBoost only); TreeSHAP via XGBoost `pred_contribs`; WebSockets replaced by SSE; Python 3.12/3.13 | Matches the decided stack |
| 9 | Auth/RBAC and PKI marked future work; API base path `/api/v1` with an endpoint map between target contract and demo build | Spec described features the demo does not implement |
| 10 | Engine-level splits, past-only features, nominal-only fitting, held-out injections documented as protocol | Leakage controls |
| 11 | SMOTE removed from the risk plan (leakage risk); class weighting instead | Time-series feature leakage |
| 12 | SNR >= 32 dB (variance-based) everywhere (was 35 dB in one place, mean-based in another) | One definition |

## File-by-file
| File | Main changes |
| :--- | :--- |
| `Project_Overview.md` | New data-scope and limitations section, dataset roles, dataset-specific physics, canonical urgency, tech-stack table (Python, Three.js, TreeSHAP, no LightGBM), audit wording |
| `Requirements.md` | FR-01 to FR-08 rewritten (channels, units, rule sets, W=10, score scaling, calibrated thresholds, 3-of-5 persistence), FR-16 to FR-18 (canonical urgency, 3 tiers, justification on every action), NFR-09 planned, NFR-10 hash chain, constraints reworded |
| `System_Architecture.md` | Pipeline diagram rewritten (aggregation, correction, regime normalization, rolling features), score scaling and persistence, TreeSHAP implementation note, urgency and AMM tables, frontend/backend sections aligned with the new UI |
| `User_Flows.md` | Illustrative-values note, SSE, cockpit tabs, degR units, signature/PIN steps replaced by licence ID + hash-chained entry, FSM thresholds aligned, mock KPI values removed |
| `Database_Design.md` | Scope note (target schema vs demo), `decision_audit_log` with hash chain and triggers (PostgreSQL + SQLite), class and tier vocabularies aligned, integrity section rewritten |
| `API_Specifications.md` | Auth status, units, `UNCERTAIN_ANOMALY`, new action contract (licence ID, justification, hash fields), metrics response shape with nulls, new endpoint map for the demo build |
| `Evaluation_Framework.md` | Rewritten: reporting rule, engine-level protocol, dataset-specific metrics, precise lead-time/FAR definitions, empty result tables, ablations, NDCG with ground-truth relevance, pilot-study targets separated from automated tests |
| `Project_Plan.md` | Dates shifted, N-CMAPSS tasks, canonical parameters, Docker/deployment tasks, new risks RSK-06 to RSK-09 |
| `ReadMe.md` | Index updated, no quoted results, correct quickstart (venv, requirements, data download, run order, Docker), directory layout |
| `UI_Design.md` | **Redesigned** (see below) |
| `requirements.txt` / `requirements-serve.txt` | Full and slim environments; pinned minimums; LightGBM, requests, python-multipart removed; h5py, pyarrow, joblib, httpx added |
| `.gitignore` | Artifacts directory committed, data/parquet/h5 ignored (except serving fleet), `.env.example` preserved |
| `.env.example` | Added CORS, audit DB / DATABASE_URL, calibration and tier parameters, cost-model constants; frontend variable moved to `.env.local` |
| `Canonical_Parameters.md` | **New**: single source of truth |
| `VortexPHM-AI_Build_Guide.md` | Aligned with the above: `/api/v1`, tiers, score scaling, `UNCERTAIN_ANOMALY`, LSTM-AE scoring fix, requirements split |

## UI redesign summary
- Dual theme (dark default + light toggle) with verified WCAG contrast; AA claimed, AAA for primary text only.
- Warm aviation-orange primary; Tier-2 warning shifted to yellow so orange is never a status colour.
- Layout: top bar + persistent alert strip + triage board; engine page is a mini-cockpit (hero 3D engine + tabs Telemetry / Explain / Decide / Audit); added `/models`.
- Interactive procedural 3D engine: click station, orbit + auto-rotate, risk tint (probability or SHAP), replay sync, exploded view; 2D fallback.
- Geist Sans + Geist Mono, subtle motion only, SVG turbine/vortex brand glyph.

## Still to do on your side
1. Run the pipeline and fill the result tables from `results/*.json`.
2. Confirm N-CMAPSS column names with `scripts/inspect_ncmapss.py`.
3. Implement the new frontend per `UI_Design.md` (component code is the next deliverable).
4. Review the cost-model constants and tier thresholds against your validation distribution.

---

## Revision 2.1: implementation package

| Change | Why |
| :--- | :--- |
| Backend extracted from the guide into real files and run end to end on synthetic data; fixes: drift units for short nominal phases, float32/float64 under pandas 3, float-formatted C-MAPSS ids, physics-test assertion, LSTM-AE scoring loop, API test skip guard | Bugs found by actually running the code |
| API additions: `GET /metrics/benchmark`, per-sensor z-scores in the diagnosis, cost and AMM in fleet rows | Needed by the Models page, sensor sparklines and fleet KPIs |
| Frontend implemented: landing (scroll-driven hero), `/viewer`, `/fleet`, `/engine/[id]`, `/models`, `/audit` | Frontend modules M11-M14 |
| 3D asset pipeline: GLB processed and validated; hero frames cleaned and exported | Modules M10, M12, M13 |
| `UI_Design.md`: landing spec, GLB part-to-station map, implementation status, KPI 4 = median RUL | Matches what was built |
| New `Master_Build_Guide.md` and `PROGRESS.md`; ReadMe index updated; Docker copies `results/` | One guide for the whole project; status tracking |
