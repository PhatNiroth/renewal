---
name: test-notifications
description: Test the renewal notification system by manually triggering the cron endpoint. Shows how many emails were sent, skipped, or failed. Use to verify the notification dispatcher is working.
disable-model-invocation: true
---

# Test Notifications

Manually trigger the notification cron endpoint and report the result.

## Instructions

1. Check the dev server is running:
```bash
curl -s http://localhost:3000/api/health 2>/dev/null || echo "checking port 3001..."
curl -s http://localhost:3001/api/health 2>/dev/null || echo "server may not be running"
```

2. Read the CRON_SECRET from `.env`:
```bash
grep CRON_SECRET .env
```

3. Detect the correct port (3000 or 3001):
```bash
PORT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200\|307\|302" && echo 3000 || echo 3001)
```

4. Trigger the cron endpoint:
```bash
curl -s -H "Authorization: Bearer dev-cron-secret-change-in-production" \
  http://localhost:${PORT}/api/cron/notifications | python3 -m json.tool 2>/dev/null || \
curl -s -H "Authorization: Bearer dev-cron-secret-change-in-production" \
  http://localhost:3000/api/cron/notifications
```

5. Check the dev server logs for details:
```bash
tail -50 .next/dev/logs/next-development.log | grep -A 2 "notifications"
```

6. Report the result:
   - **sent > 0** → Emails sent successfully. Tell user to check resend.com/emails
   - **skipped > 0** → Subscriptions found but already notified. Clear logs to re-test:
     ```bash
     npx prisma db execute --stdin <<'SQL'
     DELETE FROM "NotificationLog" WHERE "sentAt" IS NULL;
     SQL
     ```
   - **errors > 0** → Show the error from the log and diagnose:
     - `You can only send testing emails to your own email` → Update TEST_EMAIL_OVERRIDE in .env
     - `Unauthorized` → CRON_SECRET mismatch
     - `connect ECONNREFUSED` → Dev server not running

7. If no subscriptions were found at all (sent=0, skipped=0, errors=0):
   - Check if any subscriptions have `renewalDate` within the next 7 days:
     ```bash
     npx prisma db execute --stdin <<'SQL'
     SELECT "planName", "renewalDate", "status" 
     FROM "Subscription" 
     WHERE "renewalDate" BETWEEN NOW() AND NOW() + INTERVAL '7 days'
     AND "status" IN ('ACTIVE', 'EXPIRING_SOON');
     SQL
     ```
   - If none found, suggest creating a test subscription or updating an existing one's renewalDate

## Requirements
- Dev server must be running (`npm run dev`)
- `CRON_SECRET` must be set in `.env`
- `RESEND_API_KEY` must be a real key (not placeholder)
- `TEST_EMAIL_OVERRIDE` should be set to your email for local testing
