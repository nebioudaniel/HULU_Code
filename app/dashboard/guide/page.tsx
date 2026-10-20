"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowRight,
  BookOpen,
  Check,
  Terminal,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const steps = [
  {
    title: "Create an API key",
    body:
      "Sign in with GitHub, open the API keys page, and create a key. The key is shown once; copy it now.",
  },
  {
    title: "Install the CLI",
    body:
      "Clone the repository, build the binary, and copy it onto your PATH:",
    code: `git clone https://github.com/nebioudaniel/HULU_Code.git
cd HULU_Code/cli && make build
cp hulucode ~/.local/bin/hulucode`,
  },
  {
    title: "Log in",
    body:
      "Run the login command. The CLI asks for your key with hidden input; it is never printed again.",
    code: `hulucode auth login --api-url <site URL>`,
  },
  {
    title: "Scan locally",
    body:
      "Scan a project on your machine. Nothing is uploaded unless you add --sync.",
    code: `hulucode scan --local
hulucode scan --local ./some/project`,
  },
  {
    title: "Sync to your dashboard",
    body:
      "Send the project structure (paths, symbols, import relationships) to your dashboard.",
    code: `hulucode scan --local --sync`,
  },
  {
    title: "Explore",
    body:
      "Open the dependency map and impact analysis tabs on your project page to see how your code connects.",
    code: ``,
  },
  {
    title: "Manage keys and plan",
    body: "Revoke or rotate keys on the API keys page, and upgrade on billing.",
    code: ``,
  },
]

const commands = [
  { label: "scan --local", desc: "Scan a folder and print a local report." },
  { label: "--symbols", desc: "Also list symbols found in each file." },
  { label: "--json", desc: "Print the report as JSON." },
  { label: "--sync", desc: "Upload the project structure to your dashboard." },
  { label: "--dry-run", desc: "Show what would be sent without sending it." },
  { label: "--name", desc: "Set a custom project name." },
  {
    label: "auth login / status / logout",
    desc: "Manage your saved API key.",
  },
]

const troubleshooting = [
  {
    q: "Command not found: hulucode",
    a: "Make sure ~/.local/bin (or wherever you copied hulucode) is on your PATH, then open a new terminal.",
  },
  {
    q: "Invalid API key",
    a: "The key was rejected by the server. Create a new key on the API keys page and run hulucode auth login again.",
  },
  {
    q: "Plan limit reached",
    a: "You hit the project or chunk limit for your plan. Revoke a key or project, or upgrade to Pro.",
  },
  {
    q: "Upload incomplete",
    a: "The sync was interrupted. Run hulucode scan --local --sync again to resume.",
  },
]

export default function GuidePage() {
  const pathname = usePathname()

  return (
    <div className="space-y-8">
      <PageHeader
        title="How to use huluCode"
        description="Connect your first project, sync its structure, and explore it on the dashboard."
        action={
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="underline underline-offset-4 hover:text-foreground cursor-help">
                  How this page works
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Step-by-step instructions for installing the CLI, scanning a
                project, syncing it to your dashboard, and exploring the
                dependency map and impact analysis.
              </TooltipContent>
            </Tooltip>
          </span>
        }
      />

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-balance">Getting started</CardTitle>
          <CardDescription>
            Follow these steps in order. Steps are marked done as you complete
            them on your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ol className="relative space-y-6 pl-2">
            {steps.map((step, index) => (
              <li key={step.title} className="relative flex items-start gap-4">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                  {step.code && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                      <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground">
                        {step.code}
                      </code>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-balance">What is uploaded and what is not</CardTitle>
          <CardDescription>
            The CLI only sends structural information about your project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg border border-emerald-100 bg-emerald-50">
              <h4 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                <Check className="size-4" aria-hidden />
                Uploaded
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-emerald-800">
                <li>Relative file paths</li>
                <li>Symbol names and kinds</li>
                <li>Line numbers</li>
                <li>Import relationships between files</li>
                <li>External package names</li>
                <li>Project name</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border border-rose-100 bg-rose-50">
              <h4 className="text-sm font-semibold text-rose-900">
                Never sent
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-rose-800">
                <li>Source code or file contents</li>
                <li>Absolute paths</li>
                <li>Secret-like files (.env, *.key, *.pem, …)</li>
                <li>Files over the size limit</li>
                <li>Binary and symlink targets</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-balance">Command cheat sheet</CardTitle>
          <CardDescription>
            Common hulucode scan and auth commands.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {commands.map(({ label, desc }) => (
            <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg border border-border bg-muted/50">
              <span className="flex-none font-mono text-xs text-foreground">
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-balance">Troubleshooting</CardTitle>
          <CardDescription>
            Common issues and how to fix them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {troubleshooting.map(({ q, a }) => (
            <div key={q} className="space-y-1 px-3 py-2 rounded-lg border border-border bg-muted/50">
              <p className="text-sm font-medium text-foreground">{q}</p>
              <p className="text-sm text-muted-foreground">{a}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
