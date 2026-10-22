"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  GitCompareArrows,
  Link2,
  Network,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { fileRole, roleColorClass } from "@/lib/graph"

const LazyGuide = dynamic(
  () => import("./start-here-guide").then((mod) => mod.StartHereGuide),
  {
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    ),
    ssr: false,
  }
)

export function StartHereTab({ projectId }: { projectId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <div className="w-full">
      <LazyGuide projectId={projectId} />
    </div>
  )
}