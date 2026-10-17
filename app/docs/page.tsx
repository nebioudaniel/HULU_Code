import type { Metadata } from "next"

import { PlaceholderPage } from "@/components/placeholder-page"

export const metadata: Metadata = {
  title: "Documentation",
}

export default function DocsPage() {
  return <PlaceholderPage title="Documentation" />
}
