import Link from "next/link"
import { connection } from "next/server"
import {
  ArrowRight,
  Check,
  FileCode,
  FolderGit2,
  KeyRound,
  MessagesSquare,
} from "lucide-react"

import { auth } from "@/auth"
import { CopyButton } from "@/components/dashboard/copy-button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { countActiveApiKeys } from "@/lib/api-keys"
import { listProjects, projectTotals } from "@/lib/projects"
import { cn } from "@/lib/utils"
import { PRO_PRICE, formatCount, getPlanLabel, getPlanLimits } from "@/lib/plans"
import { PlanUpgradeButton } from "./plan-upgrade-button"

type Step = {
  title: string
  description: string
  code?: string
  href?: string
  linkLabel?: string
  done?: boolean
}

export default async function OverviewPage() {
  await connection()

  const session = await auth()
  const user = session?.user
  const userId = user?.id
  const firstName = user?.name?.trim().split(/\s+/)[0]

  const planLabel = getPlanLabel(user?.plan_tier)
  const limits = getPlanLimits(user?.plan_tier)
  const isPro = planLabel === "Pro"

  const [apiKeyCount, totals, projects] = await Promise.all([
    userId ? countActiveApiKeys(userId) : Promise.resolve(0),
    userId ? projectTotals(userId) : Promise.resolve({ projects: 0, chunks: 0 }),
    userId ? listProjects(userId) : Promise.resolve([]),
  ])
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const hasApiKey = apiKeyCount > 0
  const hasProject = totals.projects > 0
  const recent = projects.slice(0, 5)

  const stats = [
    {
      label: "Projects",
      value: totals.projects,
      icon: FolderGit2,
      hint: `of ${formatCount(limits.projects)} on ${planLabel}`,
    },
    {
      label: "Code chunks",
      value: totals.chunks,
      icon: FileCode,
      hint: `of ${formatCount(limits.chunks)} on ${planLabel}`,
    },
    {
      label: "AI questions",
      value: 0,
      icon: MessagesSquare,
      hint: `of ${formatCount(limits.questionsPerMonth)} this month`,
    },
    {
      label: "API keys",
      value: apiKeyCount,
      icon: KeyRound,
      hint: `of ${formatCount(limits.apiKeys)} on ${planLabel}`,
    },
  ]

  const steps: Step[] = [
    {
      title: "Create an API key",
      description: "Generate a key so the CLI can talk to your account.",
      href: "/dashboard/keys",
      linkLabel: "Go to API keys",
      done: hasApiKey,
    },
    {
      title: "Install the CLI and log in",
      description:
        "Install the CLI from source, then authenticate with your key.",
      code: `git clone https://github.com/nebioudaniel/HULU_Code.git
cd HULU_Code/cli && make build
cp hulucode ~/.local/bin/hulucode
hulucode auth login --api-url ${siteUrl}`,
      done: hasProject,
    },
    {
      title: "Run your first scan",
      description: "Index a project and sync its structure from your machine.",
      code: "hulucode scan --local --sync",
      done: hasProject,
    },
  ]

  const stepsDone = steps.filter((step) => step.done).length
  const showGetStarted = !(stepsDone === 3 || hasProject)

  const recentProjects = (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-medium tracking-tight text-foreground">
          Recent projects
        </h2>
        {recent.length > 0 && (
          <Button asChild variant="ghost" size="sm" className="rounded-lg">
            <Link href="/dashboard/projects">
              View all
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>
      {recent.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          description="Run hulucode scan --local --sync in your project folder to see it here."
          action={
            <Button asChild variant="ghost" size="sm" className="rounded-lg">
              <Link href="#get-started">
                View install steps
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <ul className="divide-y divide-border">
            {recent.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {project.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatCount(project.fileCount)} files ·{" "}
                      {formatCount(project.chunkCount)} chunks
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )

  const planCard = (
    <Card className="self-start shadow-xs">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-balance">{planLabel} plan</CardTitle>
          <Badge variant={isPro ? "default" : "secondary"}>{planLabel}</Badge>
        </div>
        <CardDescription>
          {isPro
            ? "Thanks for supporting huluCode."
            : "Upgrade for more projects, chunks, and questions."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl leading-none font-semibold tabular-nums">
          {isPro ? "Included" : `${PRO_PRICE} ETB`}
          <span className="text-sm font-normal text-muted-foreground">
            {isPro ? " in Pro" : " / month"}
          </span>
        </p>

        {!isPro && <PlanUpgradeButton />}

        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full rounded-lg"
        >
          <Link href="/dashboard/usage">View usage</Link>
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Pick up where you left off, or start something new."
        action={
          <Button asChild className="rounded-lg">
            <Link href="/dashboard/keys">
              Create API key
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      {showGetStarted && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card id="get-started" className="lg:col-span-2 shadow-xs">
            <CardHeader>
              <CardTitle className="text-balance">Get started</CardTitle>
              <CardDescription>
                Three steps to connect your first project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-6">
                {steps.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <div className="flex flex-col items-center self-stretch">
                      <span
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          step.done
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {step.done ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {index < steps.length - 1 && (
                        <span
                          aria-hidden
                          className="w-px flex-1 bg-border"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {step.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      </div>

                      {step.code && (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                          <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground">
                            {step.code}
                          </code>
                          <CopyButton value={step.code} />
                        </div>
                      )}

                      {step.href && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                        >
                          <Link href={step.href}>
                            {step.linkLabel}
                            <ArrowRight aria-hidden />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-muted-foreground">
                macOS needs Xcode Command Line Tools ({`xcode-select --install`});
                Linux needs gcc and Go 1.22+.
              </p>
            </CardContent>
          </Card>

          {planCard}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            hint={stat.hint}
            quiet
          />
        ))}
      </div>

      {showGetStarted ? (
        recentProjects
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">{recentProjects}</div>
          {planCard}
        </div>
      )}
    </div>
  )
}
