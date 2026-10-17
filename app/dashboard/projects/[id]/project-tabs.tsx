"use client"

import { useRouter } from "next/navigation"
import {
  FileCode,
  GitCompareArrows,
  LayoutDashboard,
  Network,
} from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "files", label: "Files & symbols", icon: FileCode },
  { id: "graph", label: "Dependency map", icon: Network },
  { id: "impact", label: "Impact analysis", icon: GitCompareArrows },
] as const

export type ProjectTabId = (typeof TABS)[number]["id"]

export function ProjectTabs({
  basePath,
  active,
}: {
  basePath: string
  active: ProjectTabId
}) {
  const router = useRouter()

  return (
    <Tabs
      value={active}
      onValueChange={(value) =>
        router.push(`${basePath}?tab=${value}`, { scroll: false })
      }
    >
      <div className="overflow-x-auto border-b border-border">
        <TabsList variant="line" className="w-full justify-start">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex-none">
                <Icon aria-hidden />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>
    </Tabs>
  )
}
