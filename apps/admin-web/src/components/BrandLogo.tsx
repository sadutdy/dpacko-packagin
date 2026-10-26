// D PACKO brand: isometric carton mark (same artwork as public/favicon.svg)
// plus an optional two-line wordmark that follows the theme text colors.

export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="dpacko-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#c2410c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#dpacko-bg)" />
      <path d="M32 11 51 21.5 32 32 13 21.5Z" fill="#fff" />
      <path d="M13 21.5 32 32v21L13 42.5Z" fill="#fff" fillOpacity=".72" />
      <path d="M51 21.5 32 32v21l19-10.5Z" fill="#fff" fillOpacity=".88" />
      <path d="m22.5 16.25 19 10.5" stroke="#c2410c" strokeWidth="4" strokeLinecap="round" />
      <path d="M37 33.5v12.5c4.5-1.6 8-4.4 8-8.4s-3.5-5.6-8-4.1Z" fill="#c2410c" />
    </svg>
  );
}

export function BrandLogo({ markClassName = 'h-8 w-8' }: { markClassName?: string }) {
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label="D PACKO Packaging Solutions">
      <BrandMark className={markClassName} />
      <div className="leading-none">
        <div className="text-lg font-extrabold tracking-tight text-app-strong">
          <span className="text-orange-600 dark:text-orange-400">D</span> PACKO
        </div>
        <div className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-app-muted">
          Packaging Solutions
        </div>
      </div>
    </div>
  );
}
