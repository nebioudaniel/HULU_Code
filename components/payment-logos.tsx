import Image from "next/image"
import { cn } from "@/lib/utils"

export type PaymentProviderId =
  | "telebirr"
  | "mpesa"
  | "cbebirr"
  | "awashbirr"
  | "yaya"

type LogoProps = {
  provider: PaymentProviderId
  className?: string
}

const LOGO_PATHS: Record<PaymentProviderId, { src: string; alt: string }> = {
  telebirr: { src: "/logos/telebirr.png", alt: "Telebirr" },
  mpesa: { src: "/logos/mpessa.png", alt: "M-Pesa" },
  cbebirr: { src: "/logos/cbebirr.png", alt: "CBE Birr" },
  awashbirr: { src: "/logos/awsh.png", alt: "Awash Birr" },
  yaya: { src: "/logos/yene.png", alt: "Yaya Wallet" },
}

export function PaymentLogo({ provider, className }: LogoProps) {
  const logo = LOGO_PATHS[provider]

  if (!logo) return null

  return (
    <span className={cn("relative inline-block overflow-hidden rounded shrink-0", className)}>
      <Image
        src={logo.src}
        alt={logo.alt}
        fill
        className="object-contain"
        sizes="100px"
      />
    </span>
  )
}