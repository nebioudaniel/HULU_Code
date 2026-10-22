import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy",
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Privacy
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        huluCode is local-first. Your code stays on your machine.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          What the CLI sends to huluCode
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          When you run <code className="font-mono text-xs">hulucode scan --local
          --sync</code>, the CLI sends only structural information about your
          project to the huluCode dashboard:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>Relative file paths</li>
          <li>Symbol names and kinds</li>
          <li>Line numbers</li>
          <li>Import relationships between files</li>
          <li>External package names</li>
          <li>Project name</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          What the CLI never sends
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          The following are never read, stored, or uploaded:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>Source code or file contents</li>
          <li>Absolute paths</li>
          <li>Secret-like files, such as <code className="font-mono text-xs">.env</code>, <code className="font-mono text-xs">*.key</code>, <code className="font-mono text-xs">*.pem</code></li>
          <li>Binary files and symlink targets</li>
          <li>Files over the size limit</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Your API key
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Your API key is saved locally in <code className="font-mono text-xs">~/.hulucode/config.json</code>
          with restrictive permissions. The full key is never printed again by
          the CLI. The key is sent only to authenticate requests to your own
          huluCode instance.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Where data is stored
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Synced project structure is stored in the database of the huluCode
          instance you connect to. Only you can access your projects through
          your account.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          AI questions
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          When you ask a question about your codebase, the dashboard sends only
          structural context to the AI provider (DeepSeek):
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>Project manifest (name, scripts)</li>
          <li>Top relevant file paths and their symbol names</li>
          <li>Hotspot files and module summary</li>
          <li>Your question text</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Source code, file contents, absolute paths, and secrets are never sent
          to the AI provider. The AI is instructed to ignore any instructions in
          the provided data. You control whether the README is included via the
          dashboard checkbox and the CLI <code className="font-mono text-xs">--include-readme</code>
          flag.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Data retention
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Questions and answers are stored in your project&apos;s query history.
          You can delete individual questions or clear all history per project.
          AI event logs (for plan limits) are retained for 90 days.
        </p>
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        This is a plain-language summary, not a legal contract.
      </p>
    </div>
  )
}