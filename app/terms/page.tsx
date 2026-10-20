import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms",
}

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Terms of service
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Plain-language terms for using huluCode.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Use of the service
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          huluCode is a developer tool for exploring your own codebases. You
          are responsible for the projects you scan and sync, including
          confirming you have the right to share the structural information
          (file paths, symbol names, import relationships) with your huluCode
          instance.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Demo project
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          The deployed instance may include example or demo content for
          illustration. Any project you sync is associated with your account and
          is not shared with other users.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          No warranty
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          huluCode is provided as-is. The sync analysis is automated and may be
          incomplete or incorrect; always verify important results yourself.
        </p>
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        This is a plain-language summary, not a legal contract.
      </p>
    </div>
  )
}
