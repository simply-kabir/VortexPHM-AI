// Landing-page hero configuration. Frames live in /public/engine-seq.
export type SeqSet = "desktop" | "mobile";

export const SEQ = {
  desktop: { dir: "/engine-seq/d", count: 300 },
  mobile: { dir: "/engine-seq/m", count: 300 },
  // file name pattern: <prefix><number padded to `pad` digits, first frame = `start`>.<ext>
  // f001.webp -> { prefix: "f", pad: 3, start: 1, ext: "webp" }
  // frame_000.webp -> { prefix: "frame_", pad: 3, start: 0, ext: "webp" }
  name: { prefix: "frame_", pad: 4, start: 1, ext: "webp" },
  aspect: 16 / 9, // replaced automatically by the real aspect ratio of the first frame once it loads
} as const;

export const frameUrl = (set: SeqSet, i: number) =>
  `${SEQ[set].dir}/${SEQ.name.prefix}${String(i + SEQ.name.start).padStart(SEQ.name.pad, "0")}.${SEQ.name.ext}`;

// "light": off-white page, frames must have a transparent background (alpha WebP).
// "dark":  the original dark stage, for the opaque dark frames that shipped with the first package.
export const LANDING = {
  theme: "light" as "light" | "dark",
  darkStage: "#111b1f",
};
export const stageBg = () => (LANDING.theme === "dark" ? LANDING.darkStage : "rgb(var(--canvas))");