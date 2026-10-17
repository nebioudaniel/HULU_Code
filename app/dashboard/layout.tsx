import { redirect } from "next/navigation"
import { connection } from "next/server"

import { auth } from "@/auth"
import {
  DashboardSidebar,
  type DashboardUser,
} from "@/components/dashboard/sidebar"
import { DashboardTopbar } from "@/components/dashboard/topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export const instant = false

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()

  const session = await auth()

  if (!session?.user?.id) {
    redirect("/")
  }

  const user: DashboardUser = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    planTier: session.user.plan_tier ?? "free",
    planEndsAt: session.user.plan_ends_at ?? null,
  }

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <DashboardSidebar user={user} />
        <SidebarInset>
          <DashboardTopbar />
          <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster theme="light" position="top-right" />
    </TooltipProvider>
  )
}
