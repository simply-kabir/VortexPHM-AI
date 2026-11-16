# VortexPHM-AI: Aero-Engine Telemetry Anomaly Detection & Decision Support Engine
## UI/UX Design Specification v2: "Titanium Industrial" Dual Theme (Next.js 15, TailwindCSS)

---

## 0. Design decisions at a glance

| Decision | Choice |
| :--- | :--- |
| Design language | Titanium Industrial, evolved: restrained engineering console, no neon, depth from surfaces and borders rather than glow |
| Themes | **Dual theme**: dark by default, light toggle (persisted) |
| Primary accent | **Warm aviation orange** (UI chrome: primary buttons, selection, focus, charts' lead series) |
| Status colours | Nominal = emerald, Tier 2 warning = **clear yellow**, Tier 1 critical = red, info/sensor-drift = sky blue. Orange is never a status colour. |
| Layout | **Hybrid**: top bar + persistent alert strip + full-width triage board (home); engine page is a mini-cockpit with a persistent hero row and tabs *Telemetry / Explain / Decide / Audit* |
| Density | **Balanced, optimised for 1366x768 to 1440x900 laptops**; tablets supported, phones read-only |
| Typography | Geist Sans (UI) + Geist Mono with tabular numerals (readouts) |
| Hero visuals | **Landing:** scroll-scrubbed photoreal image sequence (assembled to exploded). **Cockpit:** interactive 3D engine built from a processed GLB (Model: "Turbofan Engine" by Xieyn): hybrid look (brushed titanium + wireframe overlay on hot stations), station selection, orbit + idle auto-rotate, risk tinting (probability or SHAP), replay sync, exploded view; 2D schematic fallback. The earlier procedural geometry (section 5.2) remains the licence-safe fallback. |
| Landing page | `/`, always dark (independent of the theme toggle), scroll story in 4 chapters, then How it works / Acceptance targets / Human in the loop / CTAs (section 4.0) |
| Motion | **Subtle**: smooth state transitions only (no looping pulses), full `prefers-reduced-motion` support |
| Brand | Wordmark + turbine/vortex glyph (SVG, section 9) |

> Numbers shown in wireframes are illustrative. Real values come from the API and the benchmark results.

---

## 1. Design principles

1. **The engine is the interface.** The 3D engine shows the diagnosis (which station, how bad) and also navigates (click a station to filter telemetry and explanations).
2. **Evidence before action.** Alert, then why (SHAP), then decide, in one scrolling flow with tabs only for depth.
3. **Never colour alone.** Every status has colour + icon + text label.
4. **Numbers are first-class.** Tabular monospaced readouts so live values never shift the layout.
5. **Calm by default.** Motion only communicates state change.
6. **Same information in both themes.** The light theme is a full theme, not an afterthought; all contrast ratios are verified (section 7).

---

## 2. Colour system (CSS variables, both themes)

Colours are CSS variables stored as space-separated RGB so Tailwind opacity modifiers work (`bg-brand/15`). Light values are the `:root` defaults; the `.dark` class (set by `next-themes`) overrides them.

| Token | Dark | Light | Usage |
| :--- | :--- | :--- | :--- |
| `canvas` | `#0B0F19` | `#F5F6F8` | App background |
| `surface` | `#151C2C` | `#FFFFFF` | Cards, panels, table rows |
| `elevated` | `#1E293B` | `#F1F5F9` | Hover, popovers, modal, inputs |
| `border` | `#28354D` | `#E2E8F0` | Dividers, outlines, gridlines |
| `fg` | `#F8FAFC` | `#0F172A` | Primary text and numbers |
| `fg-2` | `#94A3B8` | `#475569` | Secondary text, units, metadata |
| `fg-3` | `#8190A8` | `#64748B` | Captions (still AA on surfaces) |
| `brand` | `#F97316` | `#C2410C` | Text-safe brand colour, primary button fill (light), links |
| `brand-hover` | `#FB923C` | `#9A3412` | Hover state |
| `on-brand` | `#111827` | `#FFFFFF` | Text on a brand fill |
| `brand-graphic` | `#F97316` | `#EA580C` | Non-text graphics: chart lead series, 3D selection outline, focus ring |
| `ok` / `ok-fill` | `#10B981` / `#10B981` | `#047857` / `#10B981` | Nominal (text / graphic fill) |
| `warn` / `warn-fill` | `#EAB308` / `#EAB308` | `#A16207` / `#EAB308` | Tier 2 Elevated (text / fill), fill text uses `on-warn` `#422006` |
| `crit` / `crit-fill` | `#F87171` / `#EF4444` | `#B91C1C` / `#DC2626` | Tier 1 Critical (text / fill) |
| `info` / `info-fill` | `#38BDF8` / `#38BDF8` | `#0369A1` / `#0EA5E9` | Sensor drift, neutral chart series, negative SHAP |

**Semantic mapping**
- Tier 1 Critical = red, Tier 2 Elevated = yellow, Tier 3 Monitor = emerald.
- `FAULT_SENSOR_DRIFT` uses `info` (it is an instrumentation issue, not an engine hazard).
- Chart series: lead series `brand-graphic`, second series `info-fill`, threshold lines `warn-fill` (alert threshold) and `crit-fill` (Tier 1 line), nominal band `ok-fill` at 12% opacity.
- SHAP bars: positive (pushes toward the predicted fault) `crit-fill`, negative `info-fill`.

### 2.1 `globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  --canvas: 245 246 248;   --surface: 255 255 255;  --elevated: 241 245 249;  --border: 226 232 240;
  --fg: 15 23 42;          --fg-2: 71 85 105;       --fg-3: 100 116 139;
  --brand: 194 65 12;      --brand-hover: 154 52 18; --on-brand: 255 255 255;  --brand-graphic: 234 88 12;
  --ok: 4 120 87;         --ok-fill: 16 185 129;
  --warn: 161 98 7;       --warn-fill: 234 179 8;    --on-warn: 66 32 6;
  --crit: 185 28 28;      --crit-fill: 220 38 38;
  --info: 3 105 161;      --info-fill: 14 165 233;
  --shadow-card: 0 1px 2px rgb(15 23 42 / 0.06), 0 4px 16px -4px rgb(15 23 42 / 0.08);
}
.dark {
  color-scheme: dark;
  --canvas: 11 15 25;      --surface: 21 28 44;      --elevated: 30 41 59;      --border: 40 53 77;
  --fg: 248 250 252;       --fg-2: 148 163 184;      --fg-3: 129 144 168;
  --brand: 249 115 22;     --brand-hover: 251 146 60; --on-brand: 17 24 39;     --brand-graphic: 249 115 22;
  --ok: 16 185 129;       --ok-fill: 16 185 129;
  --warn: 234 179 8;      --warn-fill: 234 179 8;    --on-warn: 66 32 6;
  --crit: 248 113 113;    --crit-fill: 239 68 68;
  --info: 56 189 248;     --info-fill: 56 189 248;
  --shadow-card: 0 0 0 1px rgb(40 53 77 / 0.6), 0 8px 24px -8px rgb(0 0 0 / 0.5);
}
html { background: rgb(var(--canvas)); color: rgb(var(--fg)); }
body { font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased; }
.num { font-family: var(--font-geist-mono), ui-monospace, monospace; font-variant-numeric: tabular-nums; }
*:focus-visible { outline: 2px solid rgb(var(--brand-graphic)); outline-offset: 2px; border-radius: 6px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition-duration: 0.01ms !important; } }
```

### 2.2 `tailwind.config.ts` (Tailwind v3 style; for Tailwind v4 move the same tokens into `@theme` in CSS)
```ts
import type { Config } from "tailwindcss";
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: v("canvas"), surface: v("surface"), elevated: v("elevated"), line: v("border"),
        fg: { DEFAULT: v("fg"), 2: v("fg-2"), 3: v("fg-3") },
        brand: { DEFAULT: v("brand"), hover: v("brand-hover"), on: v("on-brand"), graphic: v("brand-graphic") },
        ok: { DEFAULT: v("ok"), fill: v("ok-fill") },
        warn: { DEFAULT: v("warn"), fill: v("warn-fill"), on: v("on-warn") },
        crit: { DEFAULT: v("crit"), fill: v("crit-fill") },
        info: { DEFAULT: v("info"), fill: v("info-fill") },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { card: "12px", control: "8px", chip: "6px" },
      boxShadow: { card: "var(--shadow-card)" },
      transitionDuration: { fast: "120ms", base: "180ms", slow: "240ms" },
      transitionTimingFunction: { out: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    },
  },
  plugins: [],
};
export default config;
```

### 2.3 Theme wiring (`next-themes`, dark default)
```tsx
// src/app/layout.tsx
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-fg">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="vortex-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```
Packages: `npm i next-themes geist recharts lucide-react three @react-three/fiber @react-three/drei`.

---

## 3. Typography, spacing, shape, motion tokens

| Role | Spec |
| :--- | :--- |
| Display numeral (urgency) | Geist Mono 44/48, semibold, tabular |
| Page title (h1) | Geist Sans 24/32, semibold, tracking tight |
| Section title (h2) | 16/24, semibold |
| Body | 14/22 (laptop-balanced) |
| Small / captions | 12/16, `fg-3` |
| Readouts | Geist Mono 13-14, `num` class |
| Spacing | 4 px grid; card padding 16-20; page gutters 24 (16 below 1024) |
| Radius | Cards 12, controls 8, chips 6 |
| Borders | 1 px `border`; dark theme adds subtle ring shadow, light theme soft shadow |
| Icons | Lucide 16/20 px: `ShieldCheck` (nominal), `AlertTriangle` (Tier 2), `Flame`/`OctagonAlert` (Tier 1), `Gauge`, `Thermometer`, `Activity`, `Wrench` (AMM), `FileSignature` (decision), `Link2` (hash chain), `Sun`/`Moon` (theme) |
| Motion | 120 ms (hover, focus), 180 ms (state/colour/tab underline), 240 ms (panels, exploded view); easing `cubic-bezier(.2,.8,.2,1)`; number tween 300 ms; **no infinite animations** |

---

## 4. App shell and layouts (reference viewport 1440x900; minimum comfortable 1366x768)

### 4.0 Landing page `/` (implemented)
- **Always dark stage** (`#111b1f`, the median edge colour of the frames) wrapped in the `.dark` class, so the app theme toggle does not affect it. A gradient transitions into the page canvas below the hero.
- **Hero**: a 520vh scroll track with a sticky 16:9 stage. The scroll position maps to a frame of the image sequence (eased, with adjacent frames cross-faded). Four chapters fade in and out: *Every flight cycle*, *Open it up*, *Two models, two jobs*, *Detect. Diagnose. Decide.* Station label pins appear on the final exploded frame. Progress rail, "Skip intro" button, loading percentage and a scroll hint.
- **Frame sets**: desktop 120 frames at 1280x720 (5.9 MB), mobile 80 frames at 854x480 (2.0 MB), chosen by viewport and Save-Data; first 10 frames load first, then a coarse pass, then the rest. `prefers-reduced-motion` shows the final frame and all copy as a normal page.
- **Sections below the hero**: How it works (Detect, Diagnose, Decide), Acceptance targets (targets only, results come from the benchmark), Human in the loop (illustrative hash chain), CTAs to `/fleet` and `/viewer`, footer with the prototype disclaimer and credits.
- **Honesty rules**: hero frames are captioned as an illustrative generic render; no measured results are shown on the landing page.

### 4.1 Shell (all pages)
```
+------------------------------------------------------------------------------------------------------+
| [glyph] VortexPHM        Fleet   Models   Audit                     [search engine/tail]  [Sun/Moon] |  56 px top bar
+------------------------------------------------------------------------------------------------------+
| * 1 Tier 1   * 2 Tier 2   |  Last decision #49  [chain verified]  |  Model: FAR x% - Macro-F1 y   |  36 px alert strip
+------------------------------------------------------------------------------------------------------+
|  page content, max-width 1440, 24 px gutters                                                         |
```
- The alert strip is persistent on every page: tier counts (click to filter the board), latest audit entry with chain status, and live model KPIs (shown only when benchmark results are available).
- Nav: *Fleet* (`/fleet`), *3D engine* (`/viewer`, test bench), *Models* (`/models`), *Audit* (`/audit`). Engine pages are reached from the board. The landing page (`/`) has its own transparent top bar.

### 4.2 Fleet board `/fleet`: triage board
```
+------------------------------------------------------------------------------------------------------+
| KPI STRIP (4 tiles)                                                                                  |
| [Fleet Health Index] [Active Alerts: T1 / T2] [Cost at Risk $] [Avg Lead Time Gained (cycles)]       |
+-------------------------------------------------------------------------+----------------------------+
| PRIORITY MAINTENANCE QUEUE (ranked by Urgency U)           [filters]   | FLEET TIME                  |
| +---------------------------------------------------------------------+ | [=====o=========] 75% life  |
| | [T1] 84.6  ENG-042  HPC efficiency  91%   RUL 38+/-9   AMM 72-00-00 | |                            |
| |       3D mini-glyph: HPC highlighted         [Open cockpit ->]      | | TIER DISTRIBUTION          |
| +---------------------------------------------------------------------+ | [##### ###  ########]      |
| | [T2] 62.1  ENG-109  Fan/LPC  77%   RUL 72+/-14  AMM 72-21-00        | |                            |
| +---------------------------------------------------------------------+ | RECENT DECISIONS           |
| | [T3] 18.0  ENG-217  Nominal                                          | | #49 ACCEPT ENG-042 ...     |
+-------------------------------------------------------------------------+----------------------------+
```
- Layout: 12-column grid; queue spans 8, right rail 4 (stacks below 1100 px).
- **KPI tiles** (chosen for usefulness; each has a label, value, one-line footnote):
  1. **Fleet Health Index** = 100 - mean(U) across the fleet at the selected fleet time.
  2. **Active Alerts** = count of Tier 1 and Tier 2 engines with icons.
  3. **Cost at Risk** = sum over engines of P(fail within horizon) x C_UER (footnote: assumption-based, see Canonical_Parameters).
  4. **Median RUL** = median predicted remaining useful life across engines at the fleet time (implemented). Detection lead time is a benchmark metric and is shown on the Models page instead of the fleet board.
- Each queue row: tier badge (icon + label), U in mono, engine id, diagnosis chip, confidence, RUL +/- sigma, AMM reference, tiny engine glyph with the affected station highlighted, and an *Open cockpit* button. Rows are 72 px with hover to `elevated`.
- The **fleet-time slider** moves every engine to the same point in its life so the demo can show the fleet turning from calm to alarmed.

### 4.3 Engine cockpit `/engine/[id]`
```
+------------------------------------------------------------------------------------------------------+
| < Fleet / ENG-042                                                  Cycle 118 / 142   [T1 CRITICAL]   |
+------------------------------------------------------------+-----------------------------------------+
| 3D ENGINE (hero, ~360 px tall)                             | URGENCY            84.6  /100           |
|   [Fan][LPC][HPC][Comb][HPT][LPT][Nozzle]  <- station chips| [semi-circle gauge, tier colour]        |
|   HPC tinted red + wireframe overlay                       | DIAGNOSIS  HPC efficiency   91%         |
|   [Auto-rotate] [Exploded] [Colour by: Probability|SHAP]   | RUL        38 +/- 9 cycles              |
+------------------------------------------------------------+ COST-BENEFIT  defer ~ $X vs inspect $Y  |
| REPLAY  [>] [1x] [=======o==========] onset - alarm - fail | AMM TASKS     Wrench AMM 72-00-00 ...   |
+------------------------------------------------------------+-----------------------------------------+
| [ Telemetry ]  [ Explain ]  [ Decide ]  [ Audit ]                          <- sticky tab bar          |
+------------------------------------------------------------------------------------------------------+
| tab content                                                                                          |
+------------------------------------------------------------------------------------------------------+
```
- Hero row (3D + replay bar + diagnosis card) is always visible; only the lower tab area changes.
- **Telemetry tab**: urgency + anomaly timeline (threshold line, onset marker, first-alarm marker), then sparkline cards for the *selected station's* sensors (default: top-3 SHAP sensors) against the nominal band. Selecting a station in 3D changes the cards.
- **Explain tab**: top-3 driver chips (e.g. `T30 up`), SHAP waterfall bars (positive/negative colouring), class-probability bars, a plain-language causality sentence generated from the top drivers, and a latency chip ("TreeSHAP 18 ms").
- **Decide tab**: AI recommendation summary (class, urgency, AMM tasks, cost-benefit), segmented control `ACCEPT / OVERRIDE / DEFER`, licence ID field, justification textarea with live counter (`37/50`), submit disabled until valid, and on success a receipt showing `#audit_id`, `entry_hash` (short) and `prev_hash`.
- **Audit tab**: this engine's entries in a compact table with the chain-verified badge.

### 4.4 `/models`: model governance
Benchmark tables and charts read from `results/*.json`: lead-time distribution, FAR vs lead trade-off, confusion matrix, baseline vs Isolation Forest vs LSTM-AE, RUL metrics, latency chip. Shows "Run the benchmark to populate" when files are missing. Honest empty states are part of the design.

### 4.5 `/audit`
Fleet-wide table (id, time, engine/cycle, action, licence, justification truncated with expand, short hash), filter by engine/action, chain-verified banner, and a "Verify now" button calling `/audit/verify`.

---

## 5. Interactive 3D engine specification

### 5.1 Concept and stack
A **procedural** (code-generated) twin-spool turbofan rendered with `@react-three/fiber` + `@react-three/drei`. No external model files, so the bundle is tiny, nothing is downloaded at runtime (works air-gapped), and every station is an addressable group.

```ts
type Station = "fan" | "lpc" | "hpc" | "combustor" | "hpt" | "lpt" | "nozzle";

interface EngineViewerProps {
  stationRisk: Record<Station, number>;           // 0..1, from probability or SHAP mode
  sensorPins?: { sensor: string; station: Station; severity: number }[]; // drift pins (info colour)
  selected: Station | null;
  onSelect: (s: Station | null) => void;
  exploded: boolean;
  autoRotate: boolean;
  colorMode: "probability" | "shap";
  theme: "dark" | "light";
}
```

**Implemented asset path (GLB).** `frontend/public/models/engine.glb` (0.9 MB, meshopt-compressed, about 110k triangles after decimation from 296k) is the processed version of the supplied model. Its 29 parts are named `<station>__<part>` and tagged in glTF extras. `EngineViewer3D.tsx` regroups them into station groups (preserving world transforms), normalises the longest side to 10 units, assigns one material per station, adds an invisible wireframe overlay per mesh, and implements all five interactions. Meshopt decoding ships with three.js, so nothing is fetched from a CDN. Check the model's Sketchfab licence before publishing the file publicly (see `public/models/CREDITS.txt`).

### 5.2 Geometry (all primitives, instanced where repeated)
| Station | Geometry |
| :--- | :--- |
| Fan | Spinner cone + 22-24 blades (`InstancedMesh`, twisted boxes) on a hub disc, inside a nacelle ring |
| LPC | 4 stator/rotor ring stages (short cones, 12-16 blades each) |
| HPC | 6 stages with decreasing radius (core narrowing) |
| Combustor | Annular chamber (torus-like lathe) with 12 small fuel-nozzle cylinders |
| HPT | 2 stages, small radius, dense blades |
| LPT | 3 stages with increasing radius |
| Nozzle | Truncated cone + centre plug |
| Casing | Half-open nacelle shell (`thetaLength` about 1.5 pi) at 10% opacity so the internals are visible (cutaway) |

Budget: under 60k triangles, device pixel ratio capped at 1.5, `frameloop="demand"` with `invalidate()` on changes (switch to `always` only while auto-rotate or a transition runs), render pauses when the tab is hidden or the canvas is off-screen (`IntersectionObserver`).

### 5.3 Look: hybrid
- **Body**: `MeshStandardMaterial` brushed titanium (`metalness` 0.85, `roughness` 0.38). Lighting is procedural (hemisphere + key directional + rim light; optional drei `Lightformer` environment built in-scene). **Do not use drei HDR presets** (they download from a CDN and break offline use).
- **Risk tint** (per station): blend from titanium to `warn-fill` at risk 0.5 and to `crit-fill` at risk 1.0 using damped colour transitions (about 240 ms).
- **Wireframe overlay**: stations with risk >= 0.5 get a second wireframe mesh (emissive `crit-fill`, opacity ramps from 0 to 0.55 with risk). No looping pulse; changes ease in.
- **Selection**: selected station gets an outline in `brand-graphic` (orange) and the others dim to 55% opacity; the station chip row mirrors the selection.
- **Sensor pins** (sensor drift class): small spheres on the affected sensor taps in `info-fill` with a tooltip (sensor, drift %).
- **Theme**: transparent canvas over the page background; light theme uses a lighter titanium base and a subtle ground shadow; tints stay the same hues.

### 5.4 Interactions (all five enabled)
| Interaction | Behaviour | Implementation notes |
| :--- | :--- | :--- |
| **Click a station** | Selects it, filters Telemetry cards and SHAP bars to that station's sensors, outlines it; click empty space or press Esc to clear | `onClick` raycast per station group; selection lives in page state |
| **Orbit + auto-rotate** | Drag to orbit, wheel/pinch to zoom (clamped), idle auto-rotate at ~0.12 rad/s resuming 4 s after the last interaction | `OrbitControls` (`enablePan={false}`, min/max distance, polar limits); toggle button |
| **Colour by risk** | Toggle *Probability* (classifier class probability mapped to stations) or *SHAP* (normalised attribution of each station's sensors) | Mapping in 5.5 |
| **Replay sync** | While replaying, `stationRisk` updates every cycle; colours ease between cycles; scrubbing the replay bar updates the engine instantly | Replay stream (SSE) drives the same state as the scrubber |
| **Exploded view** | Toggle slides the stations apart along the engine axis (gap proportional to station length), labels with leader lines appear; toggling again re-assembles | Per-station group x-offset with damped easing (240 ms); camera auto-frames the wider model |

Hover: tooltip with station name, risk %, and top-1 sensor (mono readout). Accessibility: a visually adjacent *station list* (the chip row) provides the same selection by keyboard (arrow keys, Enter), with `aria-pressed` and live-region announcements for tier changes.

### 5.5 Mapping between model output and stations
| Station | N-CMAPSS sensors (SHAP mode) | Probability mode (class -> station) |
| :--- | :--- | :--- |
| Fan | Nf, P2, P21, P15 | `FAULT_FAN_LPC` -> Fan and LPC |
| LPC | T24, P24 | `FAULT_FAN_LPC` -> Fan and LPC |
| HPC | T30, Ps30, Nc | `FAULT_HPC_EFFICIENCY` -> HPC |
| Combustor | Wf | none (shown as context) |
| HPT | T48, P40 | `FAULT_HPT_THERMAL` -> HPT |
| LPT | T50, P50 | none (LPT faults are outside the 5 classes) |
| Nozzle | (none) | none |
| Sensor pins | the sensors with top drift attribution | `FAULT_SENSOR_DRIFT` -> pins, not stations |

- Probability mode: `risk(station) = sum over classes P(class) * [class maps to station]`.
- SHAP mode: `risk(station) = min(1, sum |SHAP of its sensors| / max over stations)` for the predicted class.
- C-MAPSS replay (fewer sensors): same mapping restricted to available sensors.

### 5.5.1 GLB part-to-station map (as implemented; parts are named by the model author, so the mapping is a judgement call)
| Station | Parts |
| :--- | :--- |
| fan | Primary_Turbine (fan rotor), Primary_Turbine_Case, Primary_Turbine_Bushing, Front_Rim, Nose Cone |
| lpc | Bearing_Case, Bearing_One, Air_Turbine_One, Air_Turbine_Two |
| hpc | Air_Turbine_Case, Air_Turbine_Bracket, Air_Turbine_Three, Four, Five |
| combustor | Pipe_Array, Petrol_Intake_Case, Petrol_Intake_Bracket |
| hpt | Petrol_Turbine_One, Petrol_Turbine_Two |
| lpt | Petrol_Turbine_Three, Four, Five, Petrol_Turbine_Case, Petrol_Turbine_Bracket |
| nozzle | Rear_Case, Exhaust_Case, End_Cone |
| shaft (structural, never tinted or selected) | Central_Mounting_Shaft, Rear_Mounting_Shaft |

To change the mapping edit the `STATION` table in the model-processing script (kept in the build guide, module M10) and re-export; `stations.json` lists the resulting parts and axial positions.

### 5.6 Fallbacks
- No WebGL, GPU too weak (frame time > 40 ms for 2 s), or user preference -> **2D SVG schematic** with the same seven stations, tint, selection and chips (same props).
- `prefers-reduced-motion` -> auto-rotate off, exploded view snaps without animation.
- Loading state: skeleton with the schematic outline while the 3D chunk loads (`next/dynamic`, `ssr: false`).

---

## 6. Component inventory and states

| Component | Notes |
| :--- | :--- |
| `AppShell`, `TopBar`, `AlertStrip`, `ThemeToggle` | Shell, persistent strip, Sun/Moon toggle |
| `KpiTile` | Label, mono value, delta/footnote; skeleton and error states |
| `TierBadge` | Icon + label + tinted fill (`bg-crit-fill/15 text-crit`); sizes sm/md |
| `UrgencyGauge` | 180-degree arc, tier-coloured, mono numeral with 300 ms tween |
| `TriageRow` | 72 px row, engine mini-glyph, hover and focus states |
| `EngineViewer3D` / `EngineSchematic2D` | Section 5 |
| `StationChips` | Seven chips with risk dots, keyboard navigable |
| `ReplayBar` | Play/pause, speed (0.5x/1x/2x), scrubber with onset/alarm/fail markers |
| `Timeline` | Recharts line chart: urgency (brand-graphic), anomaly score (info-fill), threshold lines, markers |
| `SensorSparkCard` | Sparkline vs nominal band, mono value, deviation chip |
| `ShapBars` | Horizontal bars, positive/negative colours, top-3 chips |
| `ProbBars` | Class-probability bars with the 0.60 uncertainty marker |
| `CostCard` | P(fail), expected cost of deferring vs inspecting, suggestion chip |
| `AmmList` | Task code (mono, brand) + description; "illustrative references" footnote |
| `DecisionForm` | Segmented control, licence field, justification with counter, submit, receipt |
| `AuditTable`, `ChainBadge` | Table with expandable justification; verified/broken badge |
| `Skeleton`, `EmptyState`, `ErrorState` | Every data component has all three |

---

## 7. Accessibility and contrast (computed WCAG 2.1 ratios)

| Pair | Dark (on surface `#151C2C`) | Light (on surface `#FFFFFF`) |
| :--- | :--- | :--- |
| `fg` primary text | 16.3:1 | 17.9:1 |
| `fg-2` secondary text | 6.6:1 | 7.6:1 |
| `fg-3` captions | 5.3:1 | 4.8:1 |
| `brand` text/links | 6.1:1 | 5.2:1 |
| `ok` text | 6.7:1 | 5.5:1 |
| `warn` text | 8.9:1 | 4.9:1 |
| `crit` text | 6.2:1 | 6.5:1 |
| `info` text | 7.9:1 | 5.9:1 |
| Button text `on-brand` on `brand` | 6.3:1 (dark text on orange) | 5.2:1 (white on burnt orange) |

- All text pairs meet **WCAG AA (4.5:1)**; primary text exceeds AAA. Non-text graphics (`brand-graphic` on light, 3.6:1 on white) meet the 3:1 graphics requirement. **The previous "AAA everywhere" claim is withdrawn: this spec claims AA, with AAA for primary text.**
- Yellow fills (`warn-fill`) always carry dark text (`on-warn`, 7.6:1) in badges.
- Focus: 2 px `brand-graphic` ring with 2 px offset on every interactive element, keyboard order follows visual order.
- Minimum target size 40 px (44 px on touch devices); tier changes announced through `aria-live="polite"`.
- 3D is never the only way to do anything: station chips, tables and tabs provide the same functions.

---

## 8. Responsive behaviour

| Viewport | Behaviour |
| :--- | :--- |
| >= 1366 (target) | Layouts as in section 4; cockpit hero is 7/5 columns |
| 1024-1365 | Right rail moves under the queue; cockpit hero stacks diagnosis card under the 3D engine at 60% height |
| Tablet (768-1023) | Single column, 44 px targets, 3D height 300 px, tabs scroll horizontally |
| Phone (< 768) | Read-only triage list and diagnosis card; 3D replaced by the 2D schematic; Decide tab remains usable but is not a design target |

---

## 9. Brand mark

Wordmark: **Vortex** (Geist Sans semibold, `fg`) + **PHM** (Geist Mono, `brand`). Glyph: a six-blade turbine inside a thin ring, blades in `brand-graphic`, ring in `fg-3`.

```tsx
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="VortexPHM">
      <circle cx="24" cy="24" r="21" fill="none" stroke="rgb(var(--fg-3))" strokeWidth="1.5" opacity="0.6" />
      <g fill="rgb(var(--brand-graphic))">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <path key={a} transform={`rotate(${a} 24 24)`} d="M24 24 C24 15 29 9 37 9 C34 15 30 20.5 24 24 Z" />
        ))}
      </g>
      <circle cx="24" cy="24" r="3.2" fill="rgb(var(--canvas))" stroke="rgb(var(--brand-graphic))" strokeWidth="1.5" />
    </svg>
  );
}
```
Use the glyph alone as the favicon (export a 32x32 SVG).

---

## 10. Content and tone
- Plain, specific engineering language: "HPC efficiency degradation, 91% confidence" rather than marketing phrases.
- Units next to every number (cycles, degR/K toggle, psia); temperatures default to the dataset unit with a K/degC display option.
- Always show uncertainty (RUL +/- sigma) and label assumption-based values (cost model) and illustrative values (AMM codes).
- Empty and error states say what to run or check (for example "Run the benchmark to populate this page").

---

## 11. File structure (frontend)

```
frontend/src/
├── app/ (layout.tsx, globals.css, page.tsx = landing, viewer/page.tsx, fleet/page.tsx, engine/[id]/page.tsx, models/page.tsx, audit/page.tsx)
├── components/
│   ├── landing/ (LandingNav, ScrollEngine, Sections)            [implemented]
│   ├── shell/ (Logo [implemented], AppShell, TopBar, AlertStrip, ThemeToggle)
│   ├── fleet/ (KpiTile, TriageRow, FleetTimeSlider, TierDistribution)
│   ├── engine/ (EngineViewer3D, EngineSchematic2D, StationChips [implemented], ReplayBar, Timeline, SensorSparkCard,
│   │            ShapBars, ProbBars, CostCard, AmmList, DecisionForm, UrgencyGauge)
│   └── audit/ (AuditTable, ChainBadge)
└── lib/ (api.ts, stations.ts, risk.ts, format.ts)
```
`lib/stations.ts` holds the station-to-sensor mapping (section 5.5); `lib/risk.ts` converts a diagnosis into `stationRisk` for both colour modes; `lib/sequence.ts` and `lib/story.ts` configure the landing hero.

---

## 12. Implementation status (frontend package)

| Page / component | Status |
| :--- | :--- |
| `/` landing (scroll-driven engine, sections) | Implemented, production build verified |
| `/viewer` 3D engine test bench (all five interactions) | Implemented, build verified; visual QA still needed in a browser |
| `/fleet` board (KPI strip, ranked queue, fleet-time slider, tier distribution, recent decisions) | Implemented, API contract verified |
| `/engine/[id]` cockpit (3D hero, replay + scrubber, diagnosis card, tabs Telemetry / Explain / Decide / Audit) | Implemented, API contract verified |
| `/models` (reads `results/*.json` through `/metrics/benchmark`) | Implemented, empty state included |
| `/audit` (table, filter, verify) | Implemented |
| Alert strip, theme toggle, shell | Implemented |
| Not yet built | Sensor-pin markers for the sensor-drift class in 3D; PDF work-order export; Playwright/visual tests |
