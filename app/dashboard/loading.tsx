export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-pulse">
      <div>
        <div className="h-7 w-32 rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-56 rounded-lg bg-muted" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 md:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="size-8 rounded-lg bg-muted" />
            </div>
            <div>
              <div className="h-8 w-20 rounded bg-muted" />
              <div className="mt-2 h-3 w-36 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border">
              <div className="space-y-1.5">
                <div className="h-4 w-36 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
              <div className="h-7 w-20 rounded-lg bg-muted" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 px-4 md:px-6 py-3.5">
                  <div className="size-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-muted" />
                    <div className="h-3 w-20 rounded bg-muted" />
                  </div>
                  <div className="text-right space-y-1.5">
                    <div className="h-3.5 w-16 rounded bg-muted" />
                    <div className="h-4 w-14 rounded-md bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
