import cron from "node-cron"

export function scheduleCronJobs() {
  // Run notification dispatcher every day at 09:00 AM server time
  cron.schedule("0 9 * * *", async () => {
    console.log("[scheduler] Running notification dispatcher…")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/notifications`,
        { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }
      )
      const data = await res.json()
      console.log("[scheduler] Dispatcher result:", data)
    } catch (err) {
      console.error("[scheduler] Failed to trigger dispatcher:", err)
    }
  })

  console.log("[scheduler] Cron jobs registered — notifications at 09:00 daily")
}
