"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import LoginBtn from "@/components/login-btn"
import { Logo } from "@/components/logo"
import { NavLinks } from "@/components/nav-links"

export function SiteHeader() {
  const pathname = usePathname()

  if (pathname.startsWith("/dashboard")) return null

  return (
    <header className="sticky top-0 z-50 w-full bg-white">
      <div className="flex h-12 w-full items-center justify-between gap-3 px-6">
        <Link
          href="/"
          aria-label="huluCode home"
          className="text-[15px] font-semibold tracking-tight text-neutral-900"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-4">
          <NavLinks />
          <LoginBtn />
        </div>
      </div>
    </header>
  )
}
