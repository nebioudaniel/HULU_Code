import type { CSSProperties, ComponentType } from "react"
import { BiLogoVisualStudio } from "react-icons/bi"
import {
  SiClaudecode,
  SiCursor,
  SiGithubcopilot,
  SiGooglegemini,
  SiOpencode,
  SiWindsurf,
  SiZedindustries,
} from "react-icons/si"
import { TbBrandOpenai } from "react-icons/tb"

type Tool = {
  name: string
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>
  color: string
}

const tools: Tool[] = [
  { name: "Claude Code", Icon: SiClaudecode, color: "#D97757" },
  { name: "Codex", Icon: TbBrandOpenai, color: "#10A37F" },
  { name: "OpenCode", Icon: SiOpencode, color: "#000000" },
  { name: "VS Code", Icon: BiLogoVisualStudio, color: "#007ACC" },
  { name: "Cursor", Icon: SiCursor, color: "#000000" },
  { name: "Windsurf", Icon: SiWindsurf, color: "#0EA5A4" },
  { name: "Gemini CLI", Icon: SiGooglegemini, color: "#4285F4" },
  { name: "GitHub Copilot", Icon: SiGithubcopilot, color: "#181717" },
  { name: "Zed", Icon: SiZedindustries, color: "#084CCF" },
]

const repeated = [...tools, ...tools, ...tools]

function Group() {
  return (
    <div className="flex shrink-0 items-center gap-20 pr-20">
      {repeated.map(({ name, Icon, color }, index) => (
        <Icon
          key={`${name}-${index}`}
          aria-label={name}
          className="size-10 shrink-0 text-muted-foreground transition-colors duration-200 hover:text-[var(--brand)]"
          style={{ "--brand": color } as CSSProperties}
        />
      ))}
    </div>
  )
}

export function ToolsMarquee() {
  return (
    <section className="w-full bg-background pb-12 pt-0">
      <p className="mb-8 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Works with the tools you already use
      </p>

      <div className="group relative w-full overflow-hidden">
        <div className="animate-marquee flex w-max group-hover:[animation-play-state:paused]">
          <Group />
          <Group />
        </div>
      </div>
    </section>
  )
}
