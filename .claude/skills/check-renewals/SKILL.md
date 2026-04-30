---
name: check-renewals
description: List all subscriptions renewing in the next 30 days, sorted by date. Shows vendor, cost, days remaining, and responsible person.
argument-hint: [days] (default: 30)
---

# Check Renewals

List all subscriptions renewing soon, sorted by closest renewal date.

## Instructions

1. Get the window from arguments (default 30 days): $ARGUMENTS

2. Query the database directly:

```bash
psql -h localhost -p 5436 -U postgres krawma -c "
SELECT
  s.name AS plan,
  v.name AS vendor,
  s.\"billingCycle\",
  s.cost,
  s.\"renewalDate\",
  s.status,
  s.\"renewalDate\" - CURRENT_DATE AS days_remaining,
  COALESCE(u.name, 'Unassigned') AS responsible
FROM \"Subscription\" s
JOIN \"Vendor\" v ON s.\"vendorId\" = v.id
LEFT JOIN \"User\" u ON s.\"responsibleId\" = u.id
WHERE s.\"renewalDate\" BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  AND s.status NOT IN ('CANCELLED')
ORDER BY s.\"renewalDate\" ASC;
"
```

3. Present the results as a clean table.

4. Group by urgency:
   - **This week** (0–7 days) — needs immediate action
   - **Next 2 weeks** (8–14 days) — schedule review
   - **This month** (15–30 days) — upcoming

5. Flag any renewals with `responsible = 'Unassigned'` as needing an owner assigned.

## Important
- Requires PostgreSQL running on port 5436
- Adjust the interval if a custom number of days is passed in $ARGUMENTS
