import Link from "next/link"

import { Logo } from "@/components/logo"

type FooterLink = {
  label: string
  href: string
  external?: boolean
}

const footerColumns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "CLI install", href: "/docs/cli" },
      {
        label: "GitHub",
        href: "https://github.com/hulucode",
        external: true,
      },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", href: "mailto:hello@hulucode.com" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
]

const linkClass =
  "rounded text-sm text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.58.11.79-.25.79-.56 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.9 2h3.3l-7.2 8.2L23.5 22h-6.6l-5.2-6.8L5.8 22H2.5l7.7-8.8L1.5 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z" />
    </svg>
  )
}

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label="huluCode home"
              className="inline-block rounded text-[15px] font-semibold tracking-tight text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50"
            >
              <Logo />
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              Understand any codebase, without your code leaving your machine.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-1 gap-10 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3"
          >
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-semibold text-neutral-900">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className={linkClass}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 sm:flex-row">
          <p className="text-xs text-neutral-500">
            © 2026 huluCode. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/hulucode"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="huluCode on GitHub"
              className="rounded text-neutral-400 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50"
            >
              <GitHubIcon className="size-5" />
            </a>
            <a
              href="https://x.com/hulucode"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="huluCode on X"
              className="rounded text-neutral-400 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50"
            >
              <XIcon className="size-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
