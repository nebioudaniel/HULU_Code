"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const links = [
  { label: "Pricing", href: "#pricing", sectionId: "pricing" },
  { label: "Docs", href: "/docs" },
]

export function NavLinks() {
  const pathname = usePathname()
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    const section = document.getElementById("pricing")
    if (!section) return

    const observer = new IntersectionObserver(
      ([entry]) => setActiveSection(entry.isIntersecting ? "pricing" : null),
      { rootMargin: "-48px 0px -60% 0px", threshold: 0 }
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [pathname])

  if (pathname.startsWith("/dashboard")) return null

  return (
    <nav className="flex items-center gap-2">
      {links.map((link, index) => {
        const isHash = link.href.startsWith("#")
        const href = isHash && pathname !== "/" ? `/${link.href}` : link.href
        const isActive =
          link.sectionId != null && activeSection === link.sectionId

        return (
          <div key={link.href} className="flex items-center gap-2">
            {index > 0 && (
              <span
                className="size-1 rounded-full bg-neutral-300"
                aria-hidden
              />
            )}
            <Link
              href={href}
              aria-current={isActive ? "true" : undefined}
              className={
                "text-[13px] font-medium transition-colors " +
                (isActive
                  ? "text-primary"
                  : "text-neutral-500 hover:text-neutral-900")
              }
            >
              {link.label}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}
