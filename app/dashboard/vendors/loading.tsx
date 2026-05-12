export default function VendorsLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-24 rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-48 rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <div className="h-9 w-56 rounded-lg bg-muted" />
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>

      {/* Vendor cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
              <div className="size-7 rounded-lg bg-muted" />
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded-full bg-muted" />
              <div className="h-5 w-24 rounded-full bg-muted" />
            </div>
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
