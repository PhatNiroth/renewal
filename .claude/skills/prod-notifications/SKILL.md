---
name: prod-notifications
description: Check what renewal notifications would be sent on production right now. Queries the prod Neon database and reports which subs are in the 7/3/1-day reminder windows, who would receive the email, and which are already notified today. Read-only — does NOT send anything.
disable-model-invocation: true
---

# Check Production Notifications (read-only)

Inspects prod DB to report what the notification cron would do if triggered right now. Safe to run anytime.

## Instructions

1. Load prod DB URL from `.env.local`:
```bash
PROD_DB=$(grep '^PROD_DATABASE_URL=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"')
if [ -z "$PROD_DB" ]; then
  echo "ERROR: PROD_DATABASE_URL not set in .env.local"
  echo "Add this line to .env.local (get value from Neon → Connection string):"
  echo '  PROD_DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"'
  exit 1
fi
```

2. List subs that would be targeted (1/3/7 days out, manual renewal only):
```bash
psql "$PROD_DB" -c "
  SELECT
    s.\"planName\",
    s.\"renewalDate\"::date AS renewal_date,
    (s.\"renewalDate\"::date - CURRENT_DATE) AS days_until,
    s.status::text,
    s.\"autoRenew\",
    COALESCE(u.email, '(no responsible → all admins)') AS recipient
  FROM \"Subscription\" s
  LEFT JOIN \"User\" u ON u.id = s.\"responsibleId\"
  WHERE (s.\"renewalDate\"::date - CURRENT_DATE) IN (1, 3, 7)
    AND s.status::text IN ('ACTIVE','EXPIRING_SOON')
    AND s.\"autoRenew\" = false
  ORDER BY s.\"renewalDate\";
"
```

3. Show today's existing notification logs (these subs would be SKIPPED):
```bash
psql "$PROD_DB" -c "
  SELECT nl.\"type\"::text, nl.\"sentAt\", s.\"planName\"
  FROM \"NotificationLog\" nl
  JOIN \"Subscription\" s ON s.id = nl.\"subscriptionId\"
  WHERE nl.\"scheduledFor\" >= CURRENT_DATE
  ORDER BY nl.\"sentAt\" DESC NULLS FIRST;
"
```

4. List admins (fallback recipients when a sub has no `responsible`):
```bash
psql "$PROD_DB" -c "
  SELECT name, email FROM \"User\" WHERE \"isAdmin\" = true ORDER BY email;
"
```

5. Report to the user:
   - **Subs in window** (from step 2) — how many, each with renewal date, days-until, recipient
   - **Already notified today** (from step 3) — these would be skipped
   - **Net emails that would fire** = step 2 count − step 3 count
   - **Fallback admins** (from step 4) — if any sub has no responsible, these people get it
   - Warn: these go to REAL users unless `TEST_EMAIL_OVERRIDE` is set on prod. Check Vercel env vars.

## Requirements
- `.env.local` contains `PROD_DATABASE_URL` (Neon connection string)
- `psql` installed locally (`sudo apt install postgresql-client` on Ubuntu)
