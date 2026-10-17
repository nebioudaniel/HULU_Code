import { Button } from "@/components/ui/button"
import { Faq } from "@/components/faq"
import { Features } from "@/components/features"
import { GetStartedButton } from "@/components/get-started-button"
import { Pricing } from "@/components/pricing"
import { SiteFooter } from "@/components/site-footer"
import { ToolsMarquee } from "@/components/tools-marquee"

export default function Home() {
  return (
    <>
      <section className="flex min-h-[75vh] w-full items-center bg-background text-foreground">
        <div className="w-full pl-[13.5%] pr-6">
          <div className="max-w-3xl -translate-y-[6%]">
            <h1 className="text-[48px] font-bold leading-[1.05] tracking-tight text-foreground">
              Understand any codebase
              <br />
              in minutes.
            </h1>

            <p className="mt-6 text-[12px] leading-[1.6] text-muted-foreground">
              AI Codebase Navigator scans your code on your own machine, maps
              how everything connects,
              <br />
              and answers your questions about it. Your source code stays with
              you.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                className="h-11 rounded-full px-5 text-[12px] font-semibold uppercase tracking-wide"
              >
                Read More
              </Button>

              <GetStartedButton />
            </div>
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
