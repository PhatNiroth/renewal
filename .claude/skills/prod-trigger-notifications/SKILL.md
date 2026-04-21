---
name: prod-trigger-notifications
description: Manually fire the renewal notification cron on PRODUCTION (renewal.krawma.com). This sends real emails to real users and posts to the real Telegram group. Not for casual demos — use /prod-notifications first to preview, then this to actually send.
disable-model-invocation: true
---

# Trigger Production Notifications (sends real emails)

Calls the prod cron endpoint immediately. Bypasses the 09:00 scheduler.

⚠️ **This sends real emails to real users** unless `TEST_EMAIL_OVERRIDE` is set on prod. Always run `/prod-notifications` first to preview what would go out.

## Instructions

1. Confirm intent with user before proceeding. Show them what `/prod-notifications` would report and ask "Send these now?" before continuing. If they haven't just checked with `/prod-notifications`, offer to run it first.

2. Load prod cron secret:
```bash
PROD_SECRET=$(grep '^PROD_CRON_SECRET=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"')
if [ -z "$PROD_SECRET" ]; then
  echo "ERROR: PROD_CRON_SECRET not set in .env.local"
  echo "Add this line to .env.local (must match CRON_SECRET in Vercel env vars):"
  echo '  PROD_CRON_SECRET="<value>"'
  exit 1
fi
```

3. (Optional — only if user explicitly asks to re-send to subs already notified today) Clear today's logs:
```bash
PROD_DB=$(grep '^PROD_DATABASE_URL=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"')
psql "$PROD_DB" -c "DELETE FROM \"NotificationLog\" WHERE \"scheduledFor\" >= CURRENT_DATE;"
```
**Only do this with explicit confirmation** — it re-sends to anyone already emailed today. Ask first.

4. Trigger the prod cron endpoint:
```bash
curl -s -H "Authorization: Bearer $PROD_SECRET" \
  https://renewal.krawma.com/api/cron/notifications | python3 -m json.tool
```

5. Report the JSON result:
   - **`sent`** — number of emails (+ Telegram if configured) successfully sent
   - **`skipped`** — subs matched but already notified today, or had no recipients
   - **`errors`** — email send failures (check Vercel logs for details)
   - **`telegramErrors`** — Telegram send failures (emails still succeeded)
   - If `sent > 0` → tell user to check https://resend.com/emails and the Telegram group
   - If `sent = 0, skipped > 0` → everything was already notified today. Offer step 3 if they want to re-send.
   - If `sent = 0, errors > 0` → check Vercel function logs:
     - HTML response (404) → route not deployed; prod build stale
     - `{"error":"Unauthorized"}` → `PROD_CRON_SECRET` in `.env.local` doesn't match Vercel `CRON_SECRET`

6. Follow-up check — show what actually got sent:
```bash
PROD_DB=$(grep '^PROD_DATABASE_URL=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"')
psql "$PROD_DB" -c "
  SELECT nl.\"type\"::text, nl.\"sentAt\", s.\"planName\", nl.recipients
  FROM \"NotificationLog\" nl
  JOIN \"Subscription\" s ON s.id = nl.\"subscriptionId\"
  WHERE nl.\"scheduledFor\" >= CURRENT_DATE AND nl.\"sentAt\" IS NOT NULL
  ORDER BY nl.\"sentAt\" DESC;
"
```

## Requirements
- `.env.local` contains `PROD_CRON_SECRET` (must match Vercel's `CRON_SECRET` env var)
- `.env.local` contains `PROD_DATABASE_URL` (Neon connection string) — used for step 3 and step 6
- `psql` installed locally
