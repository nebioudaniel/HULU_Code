import { connection } from "next/server"
import { GitBranch } from "lucide-react"

import { auth } from "@/auth"
import { SignOutButton } from "@/components/sign-out-button"
import { PageHeader } from "@/components/dashboard/page-header"
import { PageHelper } from "@/components/dashboard/page-helper"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function initials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(
    0
  )}`.toUpperCase()
}

export default async function SettingsPage() {
  await connection()

  const session = await auth()
  const user = session?.user

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account details."
      />
      <PageHelper
        text="Manage your profile, connected GitHub account, and sign out."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your account information, managed by GitHub.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              {user?.image ? (
                <AvatarImage src={user.image} alt={user.name ?? "Profile"} />
              ) : null}
              <AvatarFallback className="text-base">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {user?.name ?? "Account"}
              </p>
              {user?.email && (
                <p className="truncate text-sm text-muted-foreground">
                  {user.email}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Name</p>
              <p className="text-sm text-foreground">{user?.name ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Email
              </p>
              <p className="text-sm text-foreground">{user?.email ?? "—"}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <SignOutButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <GitBranch
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">GitHub</p>
                <p className="text-xs text-muted-foreground">
                  {user?.email ?? "Connected"}
                </p>
              </div>
            </div>
            <Badge variant="secondary">Connected</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="ring-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="destructive" disabled aria-disabled="true">
              Delete account
            </Button>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
