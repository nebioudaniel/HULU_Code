import Link from "next/link"
import {
  Check,
  Code,
  Database,
  Globe,
  Network,
  Shield,
  Terminal,
  User,
} from "lucide-react"

type SectionProps = {
  title: string
  children: React.ReactNode
}
function Section({ title, children }: SectionProps) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-6">
        {title}
      </h2>
      <div className="prose prose-sm text-muted-foreground max-w-none">
        {children}
      </div>
    </section>
  )
}

type StepProps = {
  number: number
  title: string
  body: React.ReactNode
  Icon: React.ComponentType<{ className?: string }>
}
function Step({ number, title, body, Icon }: StepProps) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {number}
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

type CardItemProps = {
  label: string
  desc: string
  icon?: React.ComponentType<{ className?: string }>
  price?: string
}
function CardItem({
  label,
  desc,
  icon: Icon,
  price,
}: CardItemProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
      {price && (
        <p className="mt-1 text-xs font-semibold text-foreground">{price}</p>
      )}
    </div>
  )
}

export default function ReadMorePage() {
  return (
    <div className="space-y-16 px-6 py-12 md:px-12 lg:py-20 max-w-5xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Read more
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Everything you need to know about how huluCode works and what it does
          with your code.
        </p>
      </div>

      <Section title="What is huluCode?">
        <p className="text-sm text-muted-foreground">
          huluCode is a local-first AI codebase navigator. It scans your code on
          your own machine, maps how everything connects, and answers your
          questions about it. Your source code stays with you.
        </p>
      </Section>

      <Section title="How it works">
        <Step
          number={1}
          title="Sign in with GitHub"
          body="Create an account and get an API key from the dashboard."
          Icon={User}
        />
        <Step
          number={2}
          title="Create an API key"
          body="Generate a key on the API keys page. It is shown once, so copy it."
          Icon={Check}
        />
        <Step
          number={3}
          title="Install the CLI"
          body="Clone the repository, build the binary, and copy it onto your PATH."
          Icon={Terminal}
        />
        <Step
          number={4}
          title="Scan locally"
          body={
            <>
              Run <code className="font-mono text-xs">hulucode scan --local</code>{" "}
              on your project. Tree-sitter parses files and extracts symbols and
              imports.
            </>
          }
          Icon={Code}
        />
        <Step
          number={5}
          title="Sync to your dashboard"
          body={
            <>
              Add <code className="font-mono text-xs">--sync</code> to upload only
              the project structure.
            </>
          }
          Icon={Network}
        />
      </Section>

      <Section title="Architecture">
        <p className="text-sm text-muted-foreground">
          Your machine runs the CLI. It talks to a Cloudflare Worker running a
          Next.js app and dashboard, which stores results in Neon Postgres. An
          optional Go service handles validation.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-center">
          <CardItem label="CLI" desc="Your machine" icon={Terminal} />
          <CardItem label="API" desc="Next.js on Cloudflare" icon={Globe} />
          <CardItem label="DB" desc="Neon Postgres" icon={Database} />
          <CardItem label="Auth" desc="Optional Go service" icon={Shield} />
        </div>
      </Section>

      <Section title="What leaves your machine">
        <p className="text-sm text-muted-foreground">
          When you sync, only structural information is sent:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>Relative file paths</li>
          <li>Symbol names and kinds</li>
          <li>Line numbers</li>
          <li>Import relationships between files</li>
          <li>External package names</li>
          <li>Project name</li>
        </ul>
      </Section>

      <Section title="What never leaves your machine">
        <p className="text-sm text-muted-foreground">
          These are never read, never stored, and never uploaded:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>Source code or file contents</li>
          <li>Absolute paths</li>
          <li>Secret-like files (such as .env, *.key, *.pem)</li>
          <li>Binary files and symlink targets</li>
          <li>Files over the size limit</li>
        </ul>
      </Section>

      <Section title="Supported languages">
        <p className="text-sm text-muted-foreground">
          huluCode extracts symbols and imports for:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>Go</li>
          <li>TypeScript and JavaScript</li>
          <li>Python</li>
        </ul>
      </Section>

      <Section title="Dependency map and impact analysis">
        <p className="text-sm text-muted-foreground">
          The dependency map shows how your files and folders import each other,
          with hotspots highlighted. Impact analysis shows which files would be
          affected by a change, grouped by how far the dependency reaches.
        </p>
      </Section>

      <Section title="Plans">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { name: "Free", price: 0, desc: "Try huluCode on a few projects." },
            {
              name: "Pro",
              price: 49.9,
              desc: "More projects, chunks, and questions.",
            },
            { name: "Team", price: null, desc: "Coming soon. Shared workspace." },
          ].map((plan) => (
            <CardItem
              key={plan.name}
              label={plan.name}
              desc={plan.desc}
              price={
                plan.price === null
                  ? "Coming soon"
                  : `${plan.price} ETB / month`
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Tech stack">
        <p className="text-sm text-muted-foreground">
          Next.js 16, React 19, Tailwind CSS, shadcn/ui, Neon Postgres, Cloudflare
          Workers, Go, Tree-sitter.
        </p>
      </Section>

      <Section title="Roadmap">
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>AI questions with opt-in embeddings</li>
          <li>Team workspace</li>
          <li>Prebuilt CLI downloads</li>
        </ul>
      </Section>

      <div className="border-t border-border pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Have more questions? See the{" "}
          <Link href="/docs/faq" className="text-primary hover:underline">
            FAQ
          </Link>
          .
        </p>
        <Link
          href="/dashboard/keys"
          className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Create an API key
        </Link>
      </div>
    </div>
  )
}
