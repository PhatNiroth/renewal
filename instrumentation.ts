export async function register() {
  // Only run in Node.js runtime (not Edge), and only on the server
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "production") {
    // Force IPv4-first DNS lookups — api.telegram.org (and others) resolve to
    // both families, and some hosts have broken IPv6 paths that cause fetch to
    // time out before falling back to IPv4.
    const dns = await import("node:dns")
    dns.setDefaultResultOrder("ipv4first")

    const { scheduleCronJobs } = await import("./lib/scheduler")
    scheduleCronJobs()
  }
}
