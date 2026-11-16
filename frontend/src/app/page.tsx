import LandingNav from "@/components/landing/LandingNav";
import ScrollEngine from "@/components/landing/ScrollEngine";
import Sections from "@/components/landing/Sections";
import { LANDING, stageBg } from "@/lib/sequence";

// Landing theme is independent of the app theme toggle: set LANDING.theme in lib/sequence.ts ("light" = off-white, "dark").
export default function Home() {
  return (
    <div className={`${LANDING.theme === "dark" ? "dark" : "light"} min-h-screen bg-canvas text-fg`}>
      <LandingNav />
      <ScrollEngine />
      <div className="h-20" style={{ background: `linear-gradient(to bottom, ${stageBg()}, rgb(var(--canvas)))` }} aria-hidden />
      <main><Sections /></main>
    </div>
  );
}