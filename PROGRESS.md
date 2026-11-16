# VortexPHM-AI: Progress Report (what we have done)

Last updated with the delivery of the full project package. Companion files: `Master_Build_Guide.md` (how to build and run everything), `CHANGELOG.md` (documentation revisions), `Canonical_Parameters.md` (single source of truth for constants).

---

## 1. Summary

| Area | State |
| :--- | :--- |
| Documentation set (10 design docs + configs) | **Done**: reviewed, corrected and patched; one canonical parameter sheet |
| Backend (pipeline, models, XAI, decision engine, API, audit log) | **Done and tested on synthetic data**; needs a run on the real NASA data |
| Frontend (landing, fleet, cockpit, models, audit, 3D viewer) | **Done**, type-checks and builds; needs visual QA in a browser |
| 3D engine asset (GLB) and hero frames | **Done** (processed, validated, mapped to stations) |
| Docker, CI, deployment recipe | **Written**; not run on a real host |
| Real-data results and benchmark numbers | **Not done** (requires your machine and the NASA files) |
| Deployment to public URLs | **Not done** |

---

## 2. Timeline of what was done

### Stage A: Understanding and planning
1. Extracted the project context from the master brief (VortexPHM-AI: aero-engine anomaly detection, fault classification, XAI, human-in-the-loop maintenance decisions).
2. Produced advice and improvements before building: dataset labelling problem (C-MAPSS has no fault-mode labels), physics-rule errors, unit and correction-factor issues, leakage risks, missing baselines, missing RUL model, audit-trail weaknesses.
3. Agreed the extras: cost-benefit engine, streaming replay, fleet overview, Docker + CI; conformal prediction and drift monitoring parked as stretch goals.
4. Settled the dataset scope: **N-CMAPSS (labels, fault modes) + C-MAPSS (benchmark)**.

### Stage B: First build guide
5. Wrote a step-by-step build guide with complete backend code, tests, Docker and deployment notes (later superseded by `Master_Build_Guide.md`; the code walkthrough is kept as `docs/Backend_Code_Reference.md`).
6. Corrected one of my own earlier mistakes (the claim that T50 > T30; the safe orderings are P2<P24<P30 and T2<T24<T30).

### Stage C: Review and patch of the 13 project files
7. Rated every uploaded file and listed required changes.
8. Patched all of them: honest evaluation framework (no invented results), unit and physics fixes, one urgency/tier definition, hash-chained audit log, endpoint map between spec and demo, corrected requirements, new `.gitignore`, `.env.example`, split requirements files.
9. Added `Canonical_Parameters.md` and `CHANGELOG.md`.

### Stage D: UI redesign through questions
10. Design decisions you made or delegated:

| Decision | Choice |
| :--- | :--- |
| Theme | Dual: dark by default + light toggle |
| Layout | Hybrid: top bar + persistent alert strip + triage board; engine page as a mini-cockpit with tabs (my recommendation, accepted) |
| Density / device | Balanced, optimised for laptop screens |
| Accent colour | Warm aviation orange (Tier 2 warning moved to yellow so they never clash) |
| Typography | Geist Sans + Geist Mono (delegated to me) |
| Hero visual | Interactive 3D engine with fault hotspots |
| 3D interactions | All five: click a station, orbit + auto-rotate, risk tint, replay sync, exploded view |
| Motion | Subtle |
| Brand | Wordmark + turbine/vortex glyph (SVG) |
| Fleet KPI tiles | Delegated to me (fleet health, alerts, cost at risk, median RUL) |

11. Wrote the new `UI_Design.md` (colour tokens for both themes with computed contrast ratios, typography, layouts, components, 3D specification, accessibility, brand mark).

### Stage E: Assets
12. **Hero frames**: inspected the 300-frame sequence, removed the corner AI-generator watermark by inpainting, trimmed the static head and tail, exported a desktop set (120 frames, 5.9 MB) and a mobile set (80 frames, 2.0 MB) plus a poster.
13. **3D model**: compared the two supplied models; chose Model 1 ("Turbofan Engine", separable named parts). Processed it: parts mapped to 7 stations + structural shaft, decimated from 296k to 110k triangles, merged materials, meshopt-compressed to 0.9 MB, validated with the Khronos glTF validator (0 errors). The scripts are kept in `frontend/tools/`.

### Stage F: Code, with testing
14. **Backend extracted into real files** (22 Python files) and tested on synthetic N-CMAPSS-format and C-MAPSS-format data:
    - dataset build, quality report, drift injection, labelling, training, benchmark, serving export;
    - found and fixed real bugs along the way: short nominal phases for drift units, float32/float64 handling under pandas 3, float-formatted C-MAPSS ids, a wrong assertion in a physics test, a broken LSTM-AE scoring loop, an unguarded API test;
    - API contract checked end to end: triage queue, diagnosis with TreeSHAP (p95 about 6 ms on the fake data), SSE replay, decision flow, audit chain verification.
    - Added `GET /metrics/benchmark`, per-sensor z-scores in the diagnosis, and cost/AMM in fleet rows to support the UI.
15. **Frontend written** (Next.js 15, React 19, Tailwind 3, react-three-fiber):
    - landing page with a scroll-scrubbed image-sequence hero, four story chapters, pins, skip link, reduced-motion fallback;
    - `/viewer` 3D engine test bench; `EngineViewer3D` with all five interactions and a 2D fallback;
    - `/fleet`, `/engine/[id]` cockpit (replay, scrubber, gauge, tabs Telemetry / Explain / Decide / Audit), `/models`, `/audit`, app shell with alert strip and theme toggle.
    - Verified: `tsc --noEmit` clean; `next build` OK (7 routes); production server returns HTTP 200 for every page and asset; CORS verified; every API response shape used by the pages checked against the live API.
16. **Packaging**: unified repository folder with Dockerfile, docker-compose, `.dockerignore`, CI workflow and the master guide.

---

## 3. Deliverables

| Path | What |
| :--- | :--- |
| `Master_Build_Guide.md` | Step-by-step guide, modules M0 to M18 |
| `PROGRESS.md` | This file |
| `Project_Overview.md`, `Requirements.md`, `User_Flows.md`, `System_Architecture.md`, `Database_Design.md`, `API_Specifications.md`, `UI_Design.md`, `Project_Plan.md`, `Evaluation_Framework.md`, `ReadMe.md` | Patched design documents |
| `Canonical_Parameters.md`, `CHANGELOG.md` | Constants and change log |
| `backend/` | Source, scripts, tests, requirements |
| `frontend/` | Next.js app, assets (`public/engine-seq`, `public/models`), asset tools |
| `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`, `.env.example`, `.gitignore` | Run, test and deploy files |
| `docs/Backend_Code_Reference.md` | Long-form code walkthrough |

---

## 4. Honest status of verification

**Verified here**
- Backend tests: 6 passed (physics rules, stuck sensors, alarm and lead-time metrics, NASA score, audit tamper detection, API including TreeSHAP latency and the decision flow).
- Pipeline end to end on synthetic data in the N-CMAPSS and C-MAPSS formats.
- Frontend type check and production build; HTTP 200 for all pages and assets; API shapes against the live backend.
- GLB validity and station grouping.

**Not verified (needs you)**
- Anything with the **real NASA data**: column names (`hs`, `*_mod`), engines per fault class, accuracy, lead time, false-alarm rate. The numbers produced on my synthetic data are meaningless.
- **How it looks and feels** in a browser: WebGL rendering, scroll smoothness, mobile, label pin positions, the part-to-station mapping on the 3D model.
- Docker image build, deployment to a host, free-tier limits.
- Licences: the hero frames (AI-generator watermark) and the Sketchfab model must be checked before public publishing.

---

## 5. Open items and decisions to confirm

| Item | Note |
| :--- | :--- |
| Landing-page look | The landing page shipped in this package is the **always-dark** version (stage colour `#111b1f`, four chapters, sections below). If you prefer a different background, layout or copy (for example an off-white page with a two-column hero), it is a contained change in `frontend/src/app/page.tsx`, `ScrollEngine.tsx`, `lib/sequence.ts` and `lib/story.ts`; frames with a different background need to replace `public/engine-seq` and the counts in `sequence.ts` |
| Tier thresholds 70/40 and cost constants | Placeholders: tune after the first real validation run |
| Fan vs LPC split and combustor parts in the 3D model | Judgement calls from part names; check visually |
| Data sufficiency | Need about 3+ engines per fault class in the N-CMAPSS files you choose |
| Targets (lead ≥ 35, FAR ≤ 2 %, macro-F1 ≥ 0.91) | May not be reachable on N-CMAPSS; the plan is to report honestly with ablations and the % of life metric |

---

## 6. What comes next (in order)

1. Unzip, set up the environments, run the tests (`Master_Build_Guide.md` M0).
2. Download the NASA data and run the inspection script (M1).
3. Build datasets, train, benchmark (M2 to M6) and send me any errors or surprising numbers.
4. Visual QA of the landing page, `/viewer` and the cockpit (M12 to M14); send screenshots or notes and I will adjust pin positions, station mapping, copy and styling.
5. Integration run and demo rehearsal (M15, M17).
6. Docker, CI and deployment (M16).
7. Stretch: drift monitor, conformal intervals, sensor pins in 3D, PDF work orders, Playwright tests.
