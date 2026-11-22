import Link from "next/link";
import { Wordmark } from "@/components/shell/Logo";

export default function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-canvas/55 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="VortexPHM home"><Wordmark /></Link>
        <nav className="hidden items-center gap-6 text-sm text-fg-2 md:flex">
          <Link className="transition-colors duration-fast hover:text-fg" href="/fleet">Fleet</Link>
          <Link className="transition-colors duration-fast hover:text-fg" href="/models">3D Twin & Models</Link>
          <Link className="transition-colors duration-fast hover:text-fg" href="/audit">Audit</Link>
        </nav>
        <Link href="/fleet" className="rounded-control bg-brand px-4 py-1.5 text-sm font-medium text-brand-on transition-colors duration-fast hover:bg-brand-hover">
          Open fleet board
        </Link>
      </div>
    </header>
  );
}
