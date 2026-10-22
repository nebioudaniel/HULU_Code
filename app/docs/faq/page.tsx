import type { Metadata } from "next"
import { ChevronDown } from "lucide-react"

export const metadata: Metadata = {
  title: "FAQ",
}

type FAQItem = {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: "What does the CLI send when I sync?",
    answer:
      "Only structural information: relative file paths, symbol names and kinds, line numbers, import relationships, external package names, and the project name. Source code, file contents, absolute paths, and secrets are never sent.",
  },
  {
    question: "Does the AI see my source code?",
    answer:
      "No. The AI receives only structural context: file paths, symbol names, hotspots, module summaries, and your question. File contents, absolute paths, and secrets are never sent. The README is only included if you explicitly enable it via the dashboard checkbox and the CLI <code>--include-readme</code> flag.",
  },
  {
    question: "How do AI questions count against my plan?",
    answer:
      "Each AI question counts as one against your monthly <code>questionsPerMonth</code> limit (50 on Free, 1,000 on Pro). There is also a daily burst limit of 20 questions per user. Cached answers do not count against the limit.",
  },
  {
    question: "How do I include the README in AI questions?",
    answer:
      "Run the scan with <code>hulucode scan --local --sync --include-readme</code>. Then in the dashboard, check the \"Include README to improve the summary\" checkbox on the Questions page. The README is only sent when both are enabled.",
  },
  {
    question: "What if the AI gives a wrong answer?",
    answer:
      "The AI is instructed to say \"I'm not sure\" when the answer isn't in the provided structure. Each answer includes a confidence badge (low/medium/high) and cited file paths you can verify. You can click cited files to open them in the dependency map or impact analysis.",
  },
  {
    question: "How do I delete my query history?",
    answer:
      "On the Questions page, click the trash icon next to any question to delete it, or use the \"Clear all\" button with confirmation. This removes the question and answer from the database.",
  },
  {
    question: "What languages are supported?",
    answer:
      "The CLI extracts symbols and imports for Go, TypeScript/JavaScript, and Python. Other languages may be partially supported depending on Tree-sitter grammars.",
  },
  {
    question: "Can I use my own AI provider?",
    answer:
      "Currently only DeepSeek is supported via the <code>DEEPSEEK_API_KEY</code>, <code>AI_BASE_URL</code>, and <code>AI_MODEL</code> environment variables. Set <code>AI_ENABLED=true</code> to enable.",
  },
  {
    question: "How does the dependency map work?",
    answer:
      "The dependency map shows import relationships between files. Nodes are sized by connection count. Hotspots (top 10 most connected files) have a blue ring. Click a node to see its imports and imported-by lists, and switch to the Impact tab to see what a change would affect.",
  },
  {
    question: "What is the impact analysis?",
    answer:
      "Impact analysis shows which files would be affected by a change to a selected file. It does a reverse breadth-first search up to depth 4, showing direct and indirect dependents, affected folders, test files to re-run, and a risk score with explainable reasons.",
  },
]

export default function FAQPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        FAQ
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Frequently asked questions about huluCode.
      </p>

      <div className="mt-10 space-y-6">
        {faqs.map((faq) => (
          <details key={faq.question} className="group border border-border rounded-xl bg-card p-5">
            <summary className="flex items-center gap-3 cursor-pointer list-none">
              <span className="text-sm font-semibold text-foreground">{faq.question}</span>
              <span className="ml-auto text-muted-foreground">
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="mt-4 text-sm text-muted-foreground prose prose-sm max-w-none">
              {faq.answer.split("\n").map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <p className="text-sm text-muted-foreground">
          Didn&apos;t find your answer? See the{" "}
          <a href="/docs" className="text-primary hover:underline">
            docs
          </a>{" "}
          or{" "}
          <a href="/dashboard/guide" className="text-primary hover:underline">
            How to use
          </a>
          .
        </p>
      </div>
    </div>
  )
}