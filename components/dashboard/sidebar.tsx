"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { signOut } from "next-auth/react"
import {
  BarChart3,
  BookOpen,
  ChevronsUpDown,
  CreditCard,
  FolderGit2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Settings,
} from "lucide-react"

import { HuluCodeLogo } from "@/components/dashboard/logo"
import { UpgradeModal } from "@/components/UpgradeModal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { formatCount, getPlanLabel, getPlanLimits } from "@/lib/plans"

export type DashboardUser = {
  name: string | null
  email: string | null
  image: string | null
  planTier: string
  planEndsAt: string | null
}

type NavItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  exact?: boolean
}

const mainNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Projects", href: "/dashboard/projects", icon: FolderGit2 },
  { label: "Query log", href: "/dashboard/queries", icon: MessagesSquare },
  { label: "How to use", href: "/dashboard/guide", icon: BookOpen },
]

const accountNav: NavItem[] = [
  { label: "API keys", href: "/dashboard/keys", icon: KeyRound },
  { label: "Usage", href: "/dashboard/usage", icon: BarChart3 },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function initials(name: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

function NavMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = isActive(pathname, item)
        const Icon = item.icon

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
              <Link href={item.href}>
                <Icon aria-hidden />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

export function DashboardSidebar({ user }: { user: DashboardUser }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const limits = getPlanLimits(user.planTier)
  const planLabel = getPlanLabel(user.planTier)
  const isPro = planLabel === "Pro"

  const projectsUsed = 0
  const projectsPct =
    limits.projects > 0
      ? Math.min(100, Math.round((projectsUsed / limits.projects) * 100))
      : 0

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="pb-2">
          <Link
            href="/"
            aria-label="huluCode home"
            className="flex h-9 items-center gap-2 rounded-lg px-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <HuluCodeLogo />
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <NavMenu items={mainNav} />
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavMenu items={accountNav} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-2">
          <div className="rounded-xl border border-sidebar-border bg-background/40 p-3 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-sidebar-foreground">
                {planLabel} plan
              </span>
              <Badge variant={isPro ? "default" : "secondary"}>
                {planLabel}
              </Badge>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Projects</span>
                <span className="tabular-nums">
                  {formatCount(projectsUsed)} / {formatCount(limits.projects)}
                </span>
              </div>
              <Progress
                value={projectsPct}
                aria-label={`${formatCount(projectsUsed)} of ${formatCount(
                  limits.projects
                )} projects used`}
              />
            </div>

            {!isPro && (
              <Button
                type="button"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setUpgradeOpen(true)}
              >
                Upgrade
              </Button>
            )}
          </div>

          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" tooltip={user.name ?? "Account"}>
                    <Avatar className="size-8 group-data-[collapsible=icon]:size-8">
                      {user.image ? (
                        <AvatarImage
                          src={user.image}
                          alt={user.name ?? "Profile"}
                        />
                      ) : null}
                      <AvatarFallback>{initials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">
                        {user.name ?? "Account"}
                      </span>
                      {user.email && (
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {user.email}
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="end"
                  sideOffset={8}
                  className="min-w-56"
                >
                  <DropdownMenuLabel className="truncate">
                    {user.email ?? user.name ?? "Account"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings aria-hidden />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                    <LogOut aria-hidden />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  )
}
