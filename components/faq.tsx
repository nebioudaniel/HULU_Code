const faqs = [
  {
    question: "Does my source code get uploaded?",
    answer:
      "No. huluCode scans your code on your own machine. Only the structure is sent to your account: relative file paths, symbol names and kinds, line numbers, import relationships and external package names. Your source code and file contents never leave your machine. Files in .gitignore, .env files, certificates and private keys are skipped automatically.",
  },
  {
    question: "Which languages are supported?",
    answer: "Go, TypeScript/JavaScript and Python. More languages will come later.",
  },
  {
    question: "How do I start?",
    answer:
      "Sign in with GitHub, generate an API key, run `hulucode auth login --key <YOUR_KEY>`, then `hulucode scan --local --sync` inside your project.",
  },
  {
    question: "What is the difference between Free and Pro?",
    answer:
      "Free is for trying huluCode on up to 2 projects. Pro gives you more projects, more AI questions, longer history and change impact analysis.",
  },
  {
    question: "How do I pay?",
    answer:
      "Pro is billed monthly through Chapa. You can pay by card or with local payment methods in ETB.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel from your dashboard and you keep Pro until the end of the period you paid for. After that your account goes back to Free.",
  },
  {
    question: "When will the Team plan be available?",
    answer:
      "It is coming soon. Join the waitlist from the pricing section and we will email you.",
  },
]

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="mx-auto w-full max-w-6xl scroll-mt-12 px-6 py-24"
    >
      <div className="mx-auto max-w-[720px]">
        <h2
          id="faq-heading"
          className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
        >
          Frequently asked questions
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          Can&apos;t find your answer? Email us.
        </p>

        <div className="mt-10 space-y-3">
          {faqs.map((item, index) => (
            <details
              key={item.question}
              open={index === 0}
              className="group rounded-xl border border-neutral-200 bg-transparent"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-neutral-900 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <PlusIcon className="faq-icon size-4 shrink-0 text-neutral-400" />
              </summary>
              <div className="faq-answer">
                <p className="px-5 pb-4 text-sm leading-relaxed text-neutral-500">
                  {item.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
