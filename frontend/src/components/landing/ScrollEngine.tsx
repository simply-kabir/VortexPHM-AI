"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LANDING, SEQ, frameUrl, stageBg, type SeqSet } from "@/lib/sequence";
import { CHAPTERS, PINS } from "@/lib/story";

/**
 * Scroll-scrubbed image sequence (the "exploding engine" hero).
 * Desktop: engine stage on the left, story panel on the right (they can never overlap).
 * Mobile: stage on top, story below.
 * Works with transparent (alpha) WebP frames on the off-white page; theme is set in lib/sequence.ts.
 */
export default function ScrollEngine() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const imgs = useRef<(HTMLImageElement | undefined)[]>([]);
  const target = useRef(0);
  const current = useRef(0);
  const dirty = useRef(true);

  const [setName, setSetName] = useState<SeqSet | null>(null);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [aspect, setAspect] = useState<number>(SEQ.aspect);
  const [calibrate, setCalibrate] = useState(false);
  const [click, setClick] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 768px)");
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setReduced(rm.matches);
    setSetName(small.matches || conn?.saveData ? "mobile" : "desktop");
    setCalibrate(new URLSearchParams(window.location.search).has("pins"));
  }, []);

  // progressive loading: first frames fast, then a coarse pass, then the rest
  useEffect(() => {
    if (!setName) return;
    const { count } = SEQ[setName];
    imgs.current = new Array(count);
    setReady(false); setLoaded(0);
    let cancelled = false; let done = 0;
    const order: number[] = []; const seen = new Set<number>();
    const add = (i: number) => { if (!seen.has(i) && i < count) { seen.add(i); order.push(i); } };
    for (let i = 0; i < 10; i++) add(i);
    for (let i = 0; i < count; i += 6) add(i);
    add(count - 1);
    for (let i = 0; i < count; i++) add(i);

    const loadOne = (i: number) => new Promise<void>((resolve) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        if (cancelled) return resolve();
        imgs.current[i] = im; done += 1; setLoaded(done);
        if (i === 0) { setReady(true); if (im.naturalWidth && im.naturalHeight) setAspect(im.naturalWidth / im.naturalHeight); }
        dirty.current = true; resolve();
      };
      im.onerror = () => resolve();
      im.src = frameUrl(setName, i);
    });
    let cursor = 0;
    const worker = async () => { while (!cancelled && cursor < order.length) await loadOne(order[cursor++]); };
    for (let w = 0; w < (setName === "mobile" ? 4 : 6); w++) void worker();
    return () => { cancelled = true; };
  }, [setName]);

  const draw = useCallback((p: number) => {
    const c = canvasRef.current; const set = setName;
    if (!c || !set) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const { count } = SEQ[set];
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const nearest = (i: number) => { for (let d = 0; d < count; d++) { const a = imgs.current[i - d]; if (a) return a; const b = imgs.current[i + d]; if (b) return b; } return undefined; };
    const i0 = Math.min(count - 1, Math.max(0, Math.floor(p)));
    const a = p - i0;
    const A = nearest(i0);
    const B = a > 0.03 ? imgs.current[Math.min(count - 1, i0 + 1)] : undefined;
    ctx.clearRect(0, 0, w, h);
    if (A) ctx.drawImage(A, 0, 0, w, h);
    if (B) { ctx.globalAlpha = a; ctx.drawImage(B, 0, 0, w, h); ctx.globalAlpha = 1; }
  }, [setName]);

  useEffect(() => {
    if (!setName || reduced || !ready) return;
    const { count } = SEQ[setName];
    let raf = 0; let lastChapter = -1;
    const onScroll = () => {
      const el = trackRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const prog = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      target.current = prog * (count - 1);
    };
    const onResize = () => { dirty.current = true; onScroll(); };
    const tick = () => {
      const d = target.current - current.current;
      if (Math.abs(d) > 0.004) { current.current += Math.abs(d) < 0.02 ? d : d * 0.14; dirty.current = true; }
      if (dirty.current) {
        draw(current.current); dirty.current = false;
        const prog = current.current / (count - 1);
        const idx = Math.max(0, CHAPTERS.findIndex((c) => prog >= c.from && prog < c.to));
        if (idx !== lastChapter) { lastChapter = idx; setChapter(idx); }
        if (railRef.current) railRef.current.style.transform = `scaleY(${prog.toFixed(4)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll(); current.current = target.current; raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); };
  }, [setName, reduced, ready, draw]);

  const skip = () => {
    const el = trackRef.current; if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().bottom + window.scrollY - 40, behavior: reduced ? "auto" : "smooth" });
  };

  const onStageClick = (e: React.MouseEvent) => {
    if (!calibrate || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const x = +(((e.clientX - r.left) / r.width) * 100).toFixed(1);
    const y = +(((e.clientY - r.top) / r.height) * 100).toFixed(1);
    setClick({ x, y });
    const text = `x: ${x}, y: ${y}`;
    console.log("pin", text);
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  const count = setName ? SEQ[setName].count : 1;
  const pct = Math.round((loaded / count) * 100);
  const showPins = calibrate || chapter === CHAPTERS.length - 1;
  const bg = stageBg();
  const stageStyle = { width: `min(100%, calc((100vh - 9rem) * ${aspect}))`, aspectRatio: String(aspect) } as const;

  if (reduced && setName) {
    return (
      <section aria-label="Exploded turbofan engine" style={{ background: bg }}>
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frameUrl(setName, SEQ[setName].count - 1)} alt="Exploded view of a turbofan engine (illustrative render)" className="w-full" />
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {CHAPTERS.map((c) => (
              <div key={c.kicker}>
                <p className="num text-xs uppercase tracking-widest text-brand">{c.kicker}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{c.title}</h2>
                <p className="mt-2 text-fg-2">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={trackRef} aria-label="Scroll to explode the engine" className="relative h-[520vh]" style={{ background: bg }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ background: bg }}>
        <div className="mx-auto grid h-full w-full max-w-[1500px] items-center gap-3 px-5 pb-4 pt-[4.5rem] lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)] lg:gap-10 lg:px-12 lg:pt-16">
          {/* ---- stage ---- */}
          <div className="flex items-center justify-center">
            <div ref={stageRef} className={`relative ${calibrate ? "cursor-crosshair" : ""}`} style={stageStyle} onClick={onStageClick}>
              {/* first frame as poster until the canvas has drawn */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frameUrl(setName ?? "desktop", 0)} alt="" aria-hidden fetchPriority="high" className={`absolute inset-0 h-full w-full transition-opacity duration-slow ${ready ? "opacity-0" : "opacity-100"}`} />
              <canvas ref={canvasRef} role="img" aria-label="Turbofan engine exploding as you scroll (illustrative render)" className="absolute inset-0 h-full w-full" />

              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-slow ${showPins ? "opacity-100" : "opacity-0"}`} aria-hidden>
                {PINS.map((p) => (
                  <line key={p.id} x1={p.x} y1={p.y} x2={p.lx} y2={p.ly} stroke="rgb(var(--brand-graphic))" strokeWidth="0.25" vectorEffect="non-scaling-stroke" opacity="0.85" />
                ))}
              </svg>
              {PINS.map((p) => (
                <div key={p.id} className={`pointer-events-none absolute transition-opacity duration-slow ${showPins ? "opacity-100" : "opacity-0"}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  <span className="absolute -left-1.5 -top-1.5 block h-3 w-3 rounded-full border-2 border-canvas bg-brand-graphic" />
                </div>
              ))}
              {PINS.map((p) => (
                <div key={p.id + "-l"} style={{ left: `${p.lx}%`, top: `${p.ly}%` }} className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-chip border border-line bg-surface/90 px-2 py-1 text-center shadow-card transition-opacity duration-slow ${showPins ? "opacity-100" : "opacity-0"}`}>
                  <div className="text-[11px] font-semibold leading-tight sm:text-xs">{p.label}</div>
                  <div className="num text-[9px] leading-tight text-fg-2 sm:text-[10px]">{p.sensors}</div>
                </div>
              ))}
              {calibrate && click && (
                <>
                  <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-crit-fill" style={{ left: `${click.x}%`, top: `${click.y}%` }} />
                  <div className="num pointer-events-none absolute left-2 top-2 rounded-chip bg-surface px-2 py-1 text-xs shadow-card">x: {click.x}, y: {click.y} (copied)</div>
                </>
              )}
            </div>
          </div>

          {/* ---- story panel ---- */}
          <div className="relative min-h-[13rem] lg:min-h-[22rem]">
            {CHAPTERS.map((c, i) => {
              const last = i === CHAPTERS.length - 1;
              return (
                <div key={c.kicker} className={`absolute inset-0 flex flex-col justify-center transition-all duration-slow ease-out ${chapter === i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
                  <p className="num text-[11px] uppercase tracking-widest text-brand sm:text-xs">{c.kicker}</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-4xl">{c.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-fg-2 sm:text-base">{c.body}</p>
                  {last && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link href="/fleet" className="rounded-control bg-brand px-5 py-2.5 text-sm font-medium text-brand-on transition-colors duration-fast hover:bg-brand-hover">Dive into analytics →</Link>
                      <Link href="/viewer" className="rounded-control border border-line bg-surface px-5 py-2.5 text-sm font-medium transition-colors duration-fast hover:bg-elevated">Try the 3D engine</Link>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="absolute -bottom-1 left-0 flex gap-1.5" aria-hidden>
              {CHAPTERS.map((c, i) => <span key={c.kicker} className={`h-1 rounded-full transition-all duration-base ${chapter === i ? "w-6 bg-brand-graphic" : "w-2 bg-line"}`} />)}
            </div>
          </div>
        </div>

        <button onClick={skip} className="absolute right-5 top-20 rounded-control border border-line bg-surface/80 px-3 py-1.5 text-xs text-fg-2 backdrop-blur transition-colors duration-fast hover:text-fg xl:right-10">Skip intro</button>
        {!ready && <p className="num absolute left-1/2 top-1/2 -translate-x-1/2 text-xs text-fg-2">Loading engine… {pct}%</p>}
        {ready && loaded < count && <p className="num absolute left-5 top-20 text-[10px] text-fg-3">frames {pct}%</p>}
        {ready && chapter === 0 && <p className="num absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-widest text-fg-3">Scroll ↓</p>}
        {calibrate && <p className="num absolute bottom-3 left-5 rounded-chip bg-surface px-2 py-1 text-[11px] text-fg-2 shadow-card">Pin calibration: scroll to the last frame, click a part, paste x/y into PINS in src/lib/story.ts</p>}
      </div>
    </section>
  );
}