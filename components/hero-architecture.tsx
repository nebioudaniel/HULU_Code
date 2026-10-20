import { cn } from "@/lib/utils"

const nodes = [
  { id: "app", x: 40, y: 160, label: "app/page.tsx", accent: false, dx: -160, dy: -120 },
  { id: "auth", x: 200, y: 60, label: "auth", accent: false, dx: 120, dy: -150 },
  { id: "api", x: 200, y: 140, label: "api/payments", accent: true, dx: 0, dy: -170 },
  { id: "chapa", x: 200, y: 220, label: "lib/chapa", accent: false, dx: -140, dy: 40 },
  { id: "components", x: 200, y: 300, label: "components", accent: false, dx: 100, dy: 150 },
  { id: "postgres", x: 360, y: 100, label: "postgres", accent: false, dx: 180, dy: -80 },
  { id: "config", x: 360, y: 260, label: "config", accent: false, dx: 160, dy: 140 },
]

const edges = [
  ["app", "auth"],
  ["app", "api"],
  ["app", "components"],
  ["auth", "config"],
  ["api", "postgres"],
  ["api", "config"],
  ["chapa", "postgres"],
  ["components", "config"],
]

const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]))

export function HeroArchitecture({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none select-none", className)}>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="relative h-full w-auto max-w-full aspect-[560/360]">
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 560 360"
            preserveAspectRatio="xMidYMid meet"
            fill="none"
          >
        {edges.map(([a, b], i) => {
          const na = nodeMap[a]
          const nb = nodeMap[b]
          const x1 = na.x + 65
          const y1 = na.y + 16
          const x2 = nb.x + 65
          const y2 = nb.y + 16
          const highlight = a === "api" || b === "api"
          return (
            <g key={i}>
              <path
                d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1} ${x2} ${y2}`}
                className="hero-chaos-line stroke-slate-300/40 dark:stroke-slate-600/40"
                strokeWidth="1"
              />
              <path
                d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1} ${x2} ${y2}`}
                className={
                  highlight
                    ? "hero-org-line stroke-blue-500/60 dark:stroke-blue-400/70 hero-dash"
                    : "hero-org-line stroke-slate-400/25 dark:stroke-slate-500/30"
                }
                strokeWidth={highlight ? 1.2 : 1}
                strokeDasharray={highlight ? "6 6" : undefined}
              />
            </g>
          )
        })}

        <g className="hero-org-line hero-particles">
          {edges.map(([a, b], i) => {
            if (!(a === "api" || b === "api")) return null
            const na = nodeMap[a]
            const nb = nodeMap[b]
            const x1 = na.x + 65
            const y1 = na.y + 16
            const x2 = nb.x + 65
            const y2 = nb.y + 16
            return (
              <circle key={i} r="2.5" fill="#3b82f6" opacity="0.9">
                <animateMotion
                  dur="2.2s"
                  repeatCount="indefinite"
                  path={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1} ${x2} ${y2}`}
                />
              </circle>
            )
          })}
        </g>

        <rect
          x="0"
          y="0"
          width="560"
          height="360"
          fill="url(#scan)"
          className="hero-scan"
          opacity="0.06"
        />
        <defs>
          <linearGradient id="scan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>

      {nodes.map((n) => (
        <div
          key={n.id}
          className={cn(
            "hero-chaos-node absolute z-10 min-w-[130px] whitespace-nowrap rounded-lg border px-4 py-2 font-mono text-xs font-semibold shadow-sm backdrop-blur-sm transition-colors sm:text-sm sm:px-5 sm:py-2.5",
            n.accent
              ? "border-blue-500/40 bg-blue-50/80 text-blue-700 dark:border-blue-400/40 dark:bg-blue-950/50 dark:text-blue-300"
              : "border-neutral-200/80 bg-white/85 text-neutral-700 dark:border-neutral-700 dark:bg-zinc-900/90 dark:text-neutral-200"
          )}
          style={
            {
              left: n.x,
              top: n.y,
              "--dx": `${n.dx}px`,
              "--dy": `${n.dy}px`,
            } as React.CSSProperties
          }
        >
          {n.label}
        </div>
      ))}
        </div>
      </div>
    </div>
  )
}
