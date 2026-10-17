import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}
