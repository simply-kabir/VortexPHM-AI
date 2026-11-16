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

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo />
      <span className="text-[15px] font-semibold tracking-tight">
        Vortex<span className="num font-medium text-brand">PHM</span>
      </span>
    </span>
  );
}
