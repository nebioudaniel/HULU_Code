import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Faq } from "@/components/faq"
import { Features } from "@/components/features"
import { GetStartedButton } from "@/components/get-started-button"
import { HeroArchitecture } from "@/components/hero-architecture"
import { Pricing } from "@/components/pricing"
import { SiteFooter } from "@/components/site-footer"
import { ToolsMarquee } from "@/components/tools-marquee"

export default function Home() {
  return (
    <>
      <section className="relative flex min-h-[65vh] w-full items-center overflow-hidden bg-background px-6 py-12 text-foreground">
        <div
          className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)]"
          style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}
        />
        <div className="hero-bg absolute inset-0 bg-[radial-gradient(circle_at_65%_45%,rgba(59,130,246,0.14)_0%,rgba(139,92,246,0.09)_40%,transparent_70%)] blur-2xl" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="max-w-3xl">
            <h1 className="text-[48px] font-bold leading-[1.05] tracking-tight text-foreground">
              Understand any codebase
              <br />
              in minutes.
            </h1>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              AI Codebase Navigator scans your code on your own machine, maps
              how everything connects,
              <br />
              and answers your questions about it. Your source code stays with
              you.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/read-more"
                className="rounded-full border border-input bg-background px-5 py-3 text-[12px] font-semibold uppercase tracking-wide hover:bg-muted"
              >
                Read More
              </Link>

              <GetStartedButton />
            </div>
          </div>

          <div className="relative hidden h-[320px] w-full overflow-hidden sm:h-[360px] lg:block lg:h-[450px]">
            <HeroArchitecture className="absolute inset-0 h-full w-full" />
          </div>
        </div>
      </section>

      <ToolsMarquee />

      <Features />

      <Pricing />

      <Faq />

      <SiteFooter />
    </>
  )
}
