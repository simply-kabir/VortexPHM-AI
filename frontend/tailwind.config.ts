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
        stage: "#111b1f",
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
