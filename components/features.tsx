import type { ReactNode } from "react"

const panel =
  "rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed"
const bluePill =
  "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/20"
const amberPill =
  "inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
const chip =
  "rounded-md bg-neutral-100 px-2 py-1 font-mono text-[10px] text-neutral-600 ring-1 ring-inset ring-neutral-200"

function TerminalPreview() {
  return (
    <div className={panel}>
      <p className="text-neutral-700">
        <span className="text-primary">$</span> hulucode scan --local
      </p>
      <p className="text-neutral-500">✓ 128 files parsed</p>
      <p className="text-neutral-500">✓ 342 symbols indexed</p>
      <p className="text-neutral-500">✓ dependency graph built in 1.2s</p>
      <span className={`${bluePill} mt-3`}>0 files uploaded</span>
    </div>
  )
}

function ChunkingPreview() {
  return (
    <div className={panel}>
      <p className="text-neutral-500">
        func <span className="text-neutral-900">handleAuth</span>(w, r) {"{"}
      </p>
      <p className="border-l-2 border-primary bg-primary/5 px-2 text-neutral-900">
        {"  "}token := verify(r)
      </p>
      <p className="text-neutral-500">
        {"  "}if token == nil {"{"} reject {"}"}
      </p>
      <p className="text-neutral-500">{"}"}</p>
      <span className={`${bluePill} mt-3`}>Symbol: handleAuth</span>
    </div>
  )
}

function DependencyMapPreview() {
  return (
    <svg
      viewBox="0 0 240 130"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="rgba(0,0,0,0.10)" strokeWidth="1">
        <line x1="28" y1="26" x2="84" y2="18" />
        <line x1="84" y1="18" x2="150" y2="30" />
        <line x1="150" y1="30" x2="212" y2="26" />
        <line x1="28" y1="26" x2="48" y2="96" />
        <line x1="48" y1="96" x2="120" y2="64" />
        <line x1="84" y1="18" x2="120" y2="64" />
        <line x1="150" y1="30" x2="120" y2="64" />
        <line x1="212" y1="26" x2="214" y2="74" />
        <line x1="150" y1="30" x2="214" y2="74" />
        <line x1="120" y1="64" x2="180" y2="102" />
        <line x1="180" y1="102" x2="214" y2="74" />
      </g>

      <g fill="rgba(0,0,0,0.22)">
        <circle cx="28" cy="26" r="6" />
        <circle cx="84" cy="18" r="6" />
        <circle cx="150" cy="30" r="6" />
        <circle cx="212" cy="26" r="6" />
        <circle cx="48" cy="96" r="6" />
        <circle cx="180" cy="102" r="6" />
        <circle cx="214" cy="74" r="6" />
      </g>

      <circle cx="120" cy="64" r="16" className="fill-primary/15" />
      <circle cx="120" cy="64" r="12" className="fill-primary" />
    </svg>
  )
}

function ImpactPreview() {
  return (
    <ul className="space-y-2">
      <li className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[11px]">
        <span className="text-neutral-700">auth/token.go</span>
        <span className={bluePill}>affected</span>
      </li>
      <li className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[11px]">
        <span className="text-neutral-700">api/session.ts</span>
        <span className={amberPill}>affected</span>
      </li>
      <li className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[11px]">
        <span className="text-neutral-700">tests/auth_test.go</span>
        <span className={bluePill}>affected</span>
      </li>
    </ul>
  )
}

function AskPreview() {
  return (
    <div className="space-y-3 text-[11px]">
      <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-none bg-primary/10 px-3 py-2 text-neutral-900">
        Where is auth handled?
      </div>
      <div className="w-fit max-w-[92%] rounded-lg rounded-bl-none bg-neutral-100 px-3 py-2 text-neutral-600">
        Auth lives in <span className="text-primary">auth/token.go</span> and is
        called by the session middleware.
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={chip}>auth/token.go</span>
        <span className={chip}>api/session.ts</span>
      </div>
    </div>
  )
}

function KeyPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[11px]">
        <span className="text-neutral-700">nav_sec_••••••</span>
        <span className={bluePill}>Copy</span>
      </div>
      <p className="font-mono text-[11px] text-neutral-500">
        <span className="text-primary">$</span> hulucode login --key ••••••
      </p>
    </div>
  )
}

const features: { title: string; description: string; preview: ReactNode }[] = [
  {
    title: "Local-first scanning",
    description:
      "Your code is parsed on your machine and never uploaded without consent.",
    preview: <TerminalPreview />,
  },
  {
    title: "Smart code chunking",
    description:
      "Tree-sitter turns Go, TypeScript and Python into clean functions and classes.",
    preview: <ChunkingPreview />,
  },
  {
    title: "Interactive dependency map",
    description:
      "See coupling and architectural hotspots as a live node graph.",
    preview: <DependencyMapPreview />,
  },
  {
    title: "Change impact analysis",
    description:
      "Know which functions, tests and modules a change will touch before you commit.",
    preview: <ImpactPreview />,
  },
  {
    title: "Ask your codebase",
    description:
      "Ask in plain English and get answers with the exact code chunks used.",
    preview: <AskPreview />,
  },
  {
    title: "One key, one command",
    description:
      "Generate an API key on the web, run one login command, and start scanning.",
    preview: <KeyPreview />,
  },
]

export function Features() {
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-6xl px-6 py-24"
      aria-labelledby="features-heading"
    >
      <div className="max-w-2xl">
        <h2
          id="features-heading"
          className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
        >
          Everything you need to understand your code
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          huluCode keeps your code on your machine while giving you a full map
          of how it fits together.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ title, description, preview }) => (
          <article
            key={title}
            className="feature-card group relative flex h-[360px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-transparent p-6 transition-colors duration-300 hover:border-primary/40"
          >
            <h3 className="text-base font-semibold text-neutral-900">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              {description}
            </p>

            <div
              aria-hidden
              className="feature-preview relative mt-6 min-h-[240px]"
            >
              {preview}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
