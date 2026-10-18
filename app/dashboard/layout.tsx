import { redirect } from "next/navigation"
import { connection } from "next/server"

import { auth } from "@/auth"
import { redirectFor } from "@/lib/plan-routing"
import {
  DashboardSidebar,
  type DashboardUser,
} from "@/components/dashboard/sidebar"
import { DashboardTopbar } from "@/components/dashboard/topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()

  const session = await auth()
  const destination = redirectFor("dashboard", {
    authenticated: Boolean(session?.user?.id),
    planChosen: Boolean(session?.user?.plan_chosen),
  })

  if (destination) {
    redirect(destination)
  }

  const current = session?.user
  if (!current) {
    redirect("/")
  }

  const user: DashboardUser = {
    name: current.name ?? null,
    email: current.email ?? null,
    image: current.image ?? null,
    planTier: current.plan_tier ?? "free",
    planEndsAt: current.plan_ends_at ?? null,
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
