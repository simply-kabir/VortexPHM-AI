// Scroll story for the landing hero. `from`/`to` are fractions of the hero scroll (0..1).
export interface Chapter { from: number; to: number; kicker: string; title: string; body: string }

export const CHAPTERS: Chapter[] = [
  {
    from: 0, to: 0.22, kicker: "01 · Every flight cycle",
    title: "A turbofan talks all the time.",
    body: "Fourteen sensor channels per flight, from fan inlet to exhaust. Most of the signal looks normal. The first signs of wear do not stand out.",
  },
  {
    from: 0.22, to: 0.48, kicker: "02 · Open it up",
    title: "Wear starts in one station.",
    body: "Fan, compressor, combustor, turbine. Each drifts in its own way, usually long before a fixed threshold alarm trips.",
  },
  {
    from: 0.48, to: 0.78, kicker: "03 · Two models, two jobs",
    title: "One model warns early. One names the culprit.",
    body: "An unsupervised detector learns what healthy looks like and flags departures. A supervised classifier isolates the failing component. Both are explained with TreeSHAP.",
  },
  {
    from: 0.78, to: 1.01, kicker: "04 · Decide",
    title: "Detect. Diagnose. Decide.",
    body: "Ranked urgency, evidence, remaining life and the cost of waiting. The engineer stays in charge, and every decision is written to a tamper-evident log.",
  },
];

// Label pins for the fully exploded frame. x/y are percentages of the frame (0-100), lx/ly place the label.
// Labels live in a safe lane (top about 10 percent, bottom about 90 percent) so they never sit under the nav bar.
// To calibrate for your own frames: open the landing page with ?pins at the end of the URL
// (http://localhost:3000/?pins), scroll to the last frame and click on a part; the x/y values are shown and copied.
export interface Pin { id: string; label: string; sensors: string; x: number; y: number; lx: number; ly: number }
export const PINS: Pin[] = [
  { id: "fan", label: "Fan", sensors: "Nf · P2", x: 25.6, y: 49.6, lx: 22, ly: 11 },
  { id: "compressor", label: "LPC + HPC", sensors: "T24 · T30 · Ps30", x: 44, y: 50, lx: 40, ly: 89 },
  { id: "combustor", label: "Combustor", sensors: "Wf", x: 59, y: 48.5, lx: 59, ly: 11 },
  { id: "turbine", label: "HPT + LPT", sensors: "T48 · T50", x: 71.8, y: 49.6, lx: 74, ly: 89 },
  { id: "nozzle", label: "Nozzle", sensors: "P50", x: 84, y: 50, lx: 89, ly: 24 },
];