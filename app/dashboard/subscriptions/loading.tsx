export default function SubscriptionsLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-52 rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-muted" />
      </div>

      {/* Filters / search bar */}
      <div className="flex flex-wrap gap-3">
        <div className="h-9 w-56 rounded-lg bg-muted" />
        <div className="h-9 w-32 rounded-lg bg-muted" />
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
          {[120, 80, 80, 90, 70, 60].map((w, i) => (
            <div key={i} className={`h-3.5 rounded bg-muted`} style={{ width: w }} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-border last:border-0">
            <div className="size-8 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
            <div className="h-3.5 w-16 rounded bg-muted" />
            <div className="h-3.5 w-20 rounded bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted" />
            <div className="h-3.5 w-16 rounded bg-muted" />
            <div className="size-7 rounded-lg bg-muted ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
