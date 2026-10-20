"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"

import { CopyButton } from "@/components/dashboard/copy-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Phase = "form" | "saving" | "created"

export function CreateKeyDialog({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [phase, setPhase] = useState<Phase>("form")
  const [error, setError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  if (disabled) {
    return (
      <Button disabled>
        <Plus aria-hidden />
        Create key
      </Button>
    )
  }

  function reset() {
    setPhase("form")
    setError(null)
    setCreatedKey(null)
    setName("")
  }

  function handleOpenChange(next: boolean) {
    if (!next && phase === "created") return
    setOpen(next)
    if (!next) reset()
  }

  function closeCreated() {
    setOpen(false)
    reset()
  }

  async function handleCreate() {
    setPhase("saving")
    setError(null)

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(data?.error ?? "Could not create the key.")
        setPhase("form")
        return
      }

      setCreatedKey(data.key as string)
      setPhase("created")
      setName("")
      router.refresh()
    } catch {
      setError("Could not create the key.")
      setPhase("form")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Create key
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (phase === "created") event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (phase === "created") event.preventDefault()
        }}
      >
        {phase === "created" && createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                This key is active and can be used by the CLI right away.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground">
                  {createdKey}
                </code>
                <CopyButton value={createdKey} />
              </div>
              <p className="text-sm font-medium text-foreground">
                Copy this key now. You will not be able to see it again.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={closeCreated}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>
                Give the key a name so you can recognize it later. You will only
                see the key once.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. My laptop"
                autoComplete="off"
                maxLength={40}
                disabled={phase === "saving"}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && phase !== "saving") {
                    event.preventDefault()
                    void handleCreate()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                1 to 40 characters.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={phase === "saving"}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={phase === "saving" || name.trim().length === 0}
              >
                {phase === "saving" && (
                  <Loader2 className="animate-spin" aria-hidden />
                )}
                Create key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
