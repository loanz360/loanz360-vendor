import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function SkeletonOfferAnalytics() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-10 w-10 rounded-xl bg-zinc-700" />
            <Skeleton className="h-6 w-16 rounded-full bg-zinc-700" />
          </div>
          <Skeleton className="h-8 w-24 mb-1 bg-zinc-700" />
          <Skeleton className="h-4 w-20 bg-zinc-700" />
        </div>
      ))}
    </div>
  )
}

function SkeletonOfferGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
          <Skeleton className="h-48 w-full bg-zinc-700" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-3/4 bg-zinc-700" />
            <Skeleton className="h-4 w-full bg-zinc-700" />
            <Skeleton className="h-4 w-2/3 bg-zinc-700" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-20 rounded-lg bg-zinc-700" />
              <Skeleton className="h-8 w-20 rounded-lg bg-zinc-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonOfferAnalytics, SkeletonOfferGrid }
