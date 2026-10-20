"use client"

import { cn } from "@/lib/utils"
import { httpMethodColors, type HttpMethod } from "@/lib/colors"

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const

export function HttpMethodBadge({ method }: { method: string }) {
  const upper = method.toUpperCase()
  const isKnown = HTTP_METHODS.includes(upper as HttpMethod)
  const { bg, border, text } = httpMethodColors(upper)
  const display = isKnown ? upper : method
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", bg, border, text)}>
      {display}
    </span>
  )
}

export function isHttpHandlerMethod(method: string): boolean {
  return HTTP_METHODS.includes(method.toUpperCase() as HttpMethod)
}
