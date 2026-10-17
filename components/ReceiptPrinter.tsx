"use client"

import {
  createContext,
  useContext,
  type HTMLAttributes,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

export type ReceiptStage = "idle" | "processing" | "printing" | "complete"

const ReceiptStageContext = createContext<ReceiptStage>("idle")

export function useReceiptStage() {
  return useContext(ReceiptStageContext)
}

type RootProps = HTMLAttributes<HTMLDivElement> & {
  stage: ReceiptStage
  children: ReactNode
}

function Root({ stage, className, children, ...props }: RootProps) {
  return (
    <ReceiptStageContext.Provider value={stage}>
      <div
        data-stage={stage}
        className={cn("flex w-full flex-col items-center", className)}
        {...props}
      >
        {children}
      </div>
    </ReceiptStageContext.Provider>
  )
}

function Machine({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const stage = useReceiptStage()
  const running = stage === "processing" || stage === "printing"

  return (
    <div
      className={cn(
        "printer-boot relative z-10 mx-auto w-full max-w-[17rem] overflow-hidden rounded-t-[1.5rem] rounded-b-lg border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xl shadow-black/25",
        className
      )}
      {...props}
    >
      <div className={cn("flex flex-col", running && "printer-jitter")}>
        {children}
      </div>

      <div className="px-4 pt-1 pb-3">
        <div className="h-1.5 rounded-full bg-black/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]" />
      </div>
    </div>
  )
}

function Led() {
  const stage = useReceiptStage()
  const busy = stage === "processing" || stage === "printing"

  return (
    <span className="relative flex size-2">
      {busy && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400/70" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          stage === "complete"
            ? "bg-emerald-400"
            : stage === "idle"
              ? "bg-neutral-600"
              : "bg-amber-400"
        )}
      />
    </span>
  )
}

function Header({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-neutral-400 uppercase">
            huluCode · Pay
          </span>
          <Led />
        </>
      )}
    </div>
  )
}

function Screen({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-4 my-3 rounded-lg border border-white/5 bg-black/50 px-3 py-2 font-mono text-[11px] text-emerald-300/90",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const STATUS_TEXT: Record<ReceiptStage, string> = {
  idle: "Ready",
  processing: "Awaiting approval",
  printing: "Printing receipt",
  complete: "Complete",
}

function Status({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  const stage = useReceiptStage()

  return (
    <span className={cn("flex items-center gap-1", className)} {...props}>
      {children ?? (
        <>
          <span>{STATUS_TEXT[stage]}</span>
          {stage !== "complete" && (
            <span aria-hidden className="receipt-cursor">
              ▍
            </span>
          )}
        </>
      )}
    </span>
  )
}

function Output({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative mx-auto -mt-3 w-full max-w-[17rem] pt-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function Paper({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("receipt-feed z-0", className)}>
      <div
        className="relative rounded-b-xl bg-white text-neutral-900 shadow-lg shadow-black/10 ring-1 ring-black/5"
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export const ReceiptPrinter = {
  Root,
  Machine,
  Header,
  Screen,
  Status,
  Output,
  Paper,
}
