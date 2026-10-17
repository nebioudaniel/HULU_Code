"use client"

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "radix-ui"
import { Check, CreditCard, Loader2, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  PaymentLogo,
  type PaymentProviderId,
} from "@/components/payment-logos"
import { ReceiptPrinter } from "@/components/ReceiptPrinter"
import { cn } from "@/lib/utils"

const POLL_INTERVAL_MS = 3000
const PRINT_DURATION_MS = 1800
const AUTO_REDIRECT_MS = 2600
const ORDER_REFERENCE = "ORD-2048"
const PRICE = "59.9"

const PROVIDERS: { id: PaymentProviderId; label: string }[] = [
  { id: "telebirr", label: "Telebirr" },
  { id: "mpesa", label: "M-Pesa" },
  { id: "cbebirr", label: "CBE Birr" },
  { id: "awashbirr", label: "Awash Birr" },
  { id: "yaya", label: "Yaya Wallet" },
]

type Method = PaymentProviderId | "card"

type ModalState =
  | "form"
  | "initializing"
  | "processing"
  | "ready"
  | "printing"
  | "complete"
  | "error"

type UpgradeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function UpgradeModal({
  open,
  onOpenChange,
  onSuccess,
}: UpgradeModalProps) {
  const router = useRouter()
  const [state, setState] = useState<ModalState>("form")
  const [method, setMethod] = useState<Method>("telebirr")
  const [phone, setPhone] = useState("")
  const [txRef, setTxRef] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [paidAt, setPaidAt] = useState<Date | null>(null)
  const [mock, setMock] = useState(false)

  const providerLabel =
    method === "card"
      ? "Card / Bank"
      : (PROVIDERS.find((item) => item.id === method)?.label ?? method)

  const reset = useCallback(() => {
    setState("form")
    setMethod("telebirr")
    setPhone("")
    setTxRef(null)
    setCheckoutUrl(null)
    setError(null)
    setIframeLoaded(false)
    setAttempt(0)
    setPaidAt(null)
    setMock(false)
  }, [])

  const finish = useCallback(() => {
    if (onSuccess) {
      onSuccess()
    } else {
      router.refresh()
    }
    reset()
    onOpenChange(false)
  }, [onSuccess, router, reset, onOpenChange])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset()
      onOpenChange(next)
    },
    [onOpenChange, reset]
  )

  async function payMobile(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const local = phone.replace(/\D/g, "").replace(/^251/, "").replace(/^0/, "")

    if (!/^9\d{8}$/.test(local)) {
      setError("Enter a valid Ethiopian mobile number (e.g. 912 345 678)")
      return
    }

    setTxRef(null)
    setState("processing")

    try {
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `0${local}`, provider: method }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.tx_ref) {
        throw new Error(data?.error ?? "Failed to start the charge")
      }

      setTxRef(data.tx_ref as string)
      setMock(Boolean(data.mock))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setState("form")
    }
  }

  const startHosted = useCallback(() => {
    setError(null)
    setState("initializing")
    setAttempt((value) => value + 1)
  }, [])

  function handleSubmit(event: FormEvent) {
    if (method === "card") {
      event.preventDefault()
      startHosted()
      return
    }
    void payMobile(event)
  }

  useEffect(() => {
    if (!open || attempt === 0) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch("/api/payments/initialize", { method: "POST" })
        const data = await res.json().catch(() => null)

        if (cancelled) return

        if (!res.ok || !data?.checkout_url || !data?.tx_ref) {
          throw new Error(data?.error ?? "Failed to start checkout")
        }

        setCheckoutUrl(data.checkout_url as string)
        setTxRef(data.tx_ref as string)
        setState("ready")
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Something went wrong")
        setState("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, attempt])

  useEffect(() => {
    if (!open || !txRef) return
    if (state !== "processing" && state !== "ready") return

    const id = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/status?tx_ref=${encodeURIComponent(txRef)}`,
          { cache: "no-store" }
        )
        const data = await res.json().catch(() => null)

        if (data?.status === "success") {
          window.clearInterval(id)
          setPaidAt(new Date())
          setState("printing")
        } else if (data?.status === "failed") {
          window.clearInterval(id)
          setTxRef(null)
          setError("The payment failed or was cancelled. Please try again.")
          setState("form")
        }
      } catch {
      }
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [open, txRef, state])

  useEffect(() => {
    if (state !== "printing") return
    const id = window.setTimeout(() => {
      setState("complete")
      toast.success("Payment successful — welcome to Pro!")
    }, PRINT_DURATION_MS)
    return () => window.clearTimeout(id)
  }, [state])

  useEffect(() => {
    if (state !== "complete") return
    const id = window.setTimeout(() => finish(), AUTO_REDIRECT_MS)
    return () => window.clearTimeout(id)
  }, [state, finish])

  const receiptStage =
    state === "processing"
      ? "processing"
      : state === "printing"
        ? "printing"
        : state === "complete"
          ? "complete"
          : "idle"

  const showReceipt =
    state === "processing" || state === "printing" || state === "complete"

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            "max-h-[calc(100vh-2rem)]",
            state === "ready" ? "h-[600px]" : "h-auto"
          )}
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex flex-col">
              <Dialog.Title className="font-heading text-base font-medium text-foreground">
                Upgrade to Pro
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Pro plan · {PRICE} ETB / month
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <XIcon />
              </Button>
            </Dialog.Close>
          </header>

          <div
            className={cn(
              "relative bg-background",
              state === "ready" && "flex-1 overflow-hidden",
              showReceipt && "overflow-y-auto"
            )}
          >
            {state === "form" && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Choose a payment method
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Payment method"
                    className="grid grid-cols-2 gap-2"
                  >
                    {PROVIDERS.map((item) => {
                      const selected = method === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setMethod(item.id)}
                          className={cn(
                            "relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            selected
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <span className="flex size-8 shrink-0 overflow-hidden rounded-md ring-1 ring-black/5">
                            <PaymentLogo
                              provider={item.id}
                              className="size-8"
                            />
                          </span>
                          <span className="min-w-0 truncate">{item.label}</span>
                          {selected && (
                            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-2.5" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      )
                    })}

                    <button
                      type="button"
                      role="radio"
                      aria-checked={method === "card"}
                      onClick={() => setMethod("card")}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        method === "card"
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                        <CreditCard className="size-4" />
                      </span>
                      <span className="min-w-0 truncate">Card / Bank</span>
                      {method === "card" && (
                        <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {method !== "card" ? (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="upgrade-phone"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Phone number
                    </label>
                    <div className="flex items-stretch overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                      <span className="flex items-center gap-1.5 border-r border-input px-3 text-sm font-medium text-muted-foreground">
                        <span aria-hidden className="text-base leading-none">
                          🇪🇹
                        </span>
                        +251
                      </span>
                      <input
                        id="upgrade-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(event) =>
                          setPhone(
                            event.target.value
                              .replace(/[^\d\s]/g, "")
                              .slice(0, 13)
                          )
                        }
                        placeholder="912 345 678"
                        className="h-9 w-full min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll send an approval request to your phone via{" "}
                      {providerLabel}.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You&apos;ll be redirected to a secure Chapa checkout to pay
                    with a card or bank transfer.
                  </p>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full rounded-lg">
                  {method === "card"
                    ? "Continue to checkout"
                    : `Pay ${PRICE} ETB`}
                </Button>
              </form>
            )}

            {state === "initializing" && (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm">Preparing secure checkout…</p>
              </div>
            )}

            {showReceipt && (
              <ReceiptPrinter.Root stage={receiptStage} className="px-5 py-6">
                <ReceiptPrinter.Machine>
                  <ReceiptPrinter.Header />
                  <ReceiptPrinter.Screen>
                    <ReceiptPrinter.Status />
                  </ReceiptPrinter.Screen>
                </ReceiptPrinter.Machine>

                {(state === "printing" || state === "complete") && (
                  <ReceiptPrinter.Output>
                    <ReceiptPrinter.Paper>
                      <Receipt
                        providerLabel={providerLabel}
                        reference={ORDER_REFERENCE}
                        txRef={txRef}
                        paidAt={paidAt}
                        paid={state === "complete"}
                      />
                    </ReceiptPrinter.Paper>
                  </ReceiptPrinter.Output>
                )}

                {state === "processing" && (
                  <p className="mt-4 max-w-[17rem] text-center text-sm text-muted-foreground">
                    {mock
                      ? "Simulated payment (dev mode) — approving automatically."
                      : `Approve the ${PRICE} ETB payment on your phone via ${providerLabel}.`}
                  </p>
                )}

                {state === "processing" && txRef && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setTxRef(null)
                      setState("form")
                    }}
                  >
                    Cancel
                  </Button>
                )}

                {state === "complete" && (
                  <>
                    <Button
                      className="mt-5 w-full max-w-[17rem] rounded-lg"
                      onClick={finish}
                    >
                      Go to dashboard
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Redirecting you automatically…
                    </p>
                  </>
                )}
              </ReceiptPrinter.Root>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setState("form")}>
                    Back
                  </Button>
                  <Button onClick={startHosted}>Try again</Button>
                </div>
              </div>
            )}

            {state === "ready" && checkoutUrl && (
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm">Loading payment form…</p>
                  </div>
                )}
                <iframe
                  title="Chapa checkout"
                  src={checkoutUrl}
                  allow="payment"
                  onLoad={() => setIframeLoaded(true)}
                  className={cn(
                    "size-full border-0",
                    iframeLoaded ? "opacity-100" : "opacity-0"
                  )}
                />
              </>
            )}
          </div>

          {state === "ready" && checkoutUrl && (
            <footer className="border-t px-4 py-2 text-center">
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Trouble with the form? Open in a new tab
              </a>
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type ReceiptProps = {
  providerLabel: string
  reference: string
  txRef: string | null
  paidAt: Date | null
  paid: boolean
}

function Receipt({
  providerLabel,
  reference,
  txRef,
  paidAt,
  paid,
}: ReceiptProps) {
  const date = paidAt
    ? paidAt.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—"

  const shortTx = txRef ? txRef.replace(/^tx_/, "").slice(0, 12) : "—"

  return (
    <div className="relative px-5 py-5 font-mono text-[11px] leading-relaxed">
      <div className="text-center">
        <p className="text-sm font-bold tracking-[0.2em] uppercase">
          huluCode
        </p>
        <p className="mt-0.5 text-muted-foreground">Payment receipt</p>
      </div>

      <div className="my-4 border-t border-dashed border-neutral-300" />

      <dl className="flex flex-col gap-1.5">
        <Row label="Plan" value="Pro plan" />
        <Row label="Billing" value="Monthly subscription" />
        <Row label="Amount" value={`${PRICE} ETB`} />
        <Row label="Method" value={providerLabel} />
        <Row label="Date" value={date} />
        <Row label="Reference" value={reference} />
      </dl>

      <div className="my-4 border-t border-dashed border-neutral-300" />

      <div className="flex items-baseline justify-between text-sm font-bold">
        <span>Total</span>
        <span>{PRICE} ETB</span>
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Transaction</span>
        <span className="tabular-nums">{shortTx}</span>
      </div>

      <div className="mt-4 flex h-6 items-end gap-[3px]" aria-hidden>
        {Array.from({ length: 32 }).map((_, index) => (
          <span
            key={index}
            className="block w-[2px] bg-neutral-800"
            style={{ height: index % 4 === 0 ? "100%" : index % 3 === 0 ? "70%" : "85%" }}
          />
        ))}
      </div>

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        Thank you for upgrading. Keep coding!
      </p>

      {paid && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="receipt-stamp rounded-md border-2 border-emerald-600/70 px-3 py-1 text-lg font-black tracking-[0.25em] text-emerald-600/80 uppercase">
            Paid
          </span>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900">{value}</dd>
    </div>
  )
}
