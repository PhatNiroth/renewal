---
name: user-simulator
description: Walk through the Krawma Renewal app as an end-user across every realistic scenario (happy paths, unhappy paths, admin flows, edge cases) and surface broken / confusing flows. Reads code only — no side effects. Use before shipping UX changes to catch regressions.
disable-model-invocation: true
---

# User Simulator

Roleplay as real users of Krawma Renewal. For each scenario, trace the code path, identify what the user would actually see / have to do, and flag friction.

## Usage

```
/user-simulator                 # run all scenarios
/user-simulator renewals        # scope to renewals flow
/user-simulator admin           # scope to admin flows
/user-simulator notifications   # scope to notification flows
/user-simulator edge            # edge cases only
```

## Rules

- **Do NOT touch the DB, do NOT hit the dev server.** This is a code-read audit.
- Every finding must cite `file:line` so the fix is obvious.
- Group output by severity: 🔴 Critical (breaks daily flow) / 🟠 High (causes real friction) / 🟡 Medium (polish).
- Be the user — not the developer. "I click X and expect Y, but I get Z" framing.
- Distinguish **intended behavior** from **broken behavior**. A missing feature ≠ a bug.

## Personas

| Persona | Focus | Seeded creds |
|---|---|---|
| Operations | Manages subs + renewals daily | `ops@krawma.com / ops123` |
| Accounting | Logs payments, reconciles | `acc@krawma.com / acc123` |
| Admin | Users, roles, vendors, categories | `admin@krawma.com / admin123` |

## Scenarios

### A. Operations — happy path
1. Login → land on `/dashboard`. Stat cards match session permissions.
2. Create vendor (Netflix) with category, website, contact (`app/dashboard/vendors/`).
3. Create subscription linked to vendor, MONTHLY cost, responsible=self (`app/dashboard/subscriptions/`).
4. Dashboard recalculates: monthly spend, active count, upcoming renewals.
5. Renewal approaches: 7-day email fires when cron runs (`lib/notification-dispatcher.ts`).
6. Click Mark Renewed on Renewals page → status + date + RenewalLog update (`app/actions/subscriptions.ts:123-152`).
7. Record payment in Billing.

### B. Operations — unhappy paths (the real issues)
1. **EXPIRED sub on Renewals page** — open `/dashboard/renewals`. Where is it? (`page.tsx:37` filters EXPIRED out).
2. **Long-expired sub** — sub expired 3 months ago. Click Mark Renewed. Is the new `renewalDate` in the future? (`subscriptions.ts:133-134` uses oldDate+cycle, not max(old,today)+cycle).
3. **Mark Renewed → Billing disconnect** — RenewalLog written but no BillingRecord (`subscriptions.ts:136-152`). User must remember to visit Billing.
4. **Cost change at renewal** — vendor raised price. Is user prompted? (No — `subscriptions.ts:136-143` only touches status + renewalDate).
5. **CANCELLED sub** — vendor reinstated. Flow to un-cancel? (Check Edit modal status dropdown: `subscriptions-client.tsx:284`.)
6. **PENDING sub** — created awaiting activation. How does it flip to ACTIVE? (Only via manual Edit.)
7. **Ghost "Expired notifications" toggle** — `app/dashboard/settings/page.tsx:171,206` shows toggle, but `NotifType` enum (`prisma/schema.prisma:257-263`) has no `RENEWAL_EXPIRED`, and `NOTIFY_WINDOWS` (`notification-dispatcher.ts:48-52`) never dispatches. Ghost toggle confirmed.

### C. Admin
1. Create user with role → verify login works.
2. Create role with `RENEWALS: view` only, no `edit` → log in as that user → confirm Mark Renewed is hidden (`app/dashboard/renewals/page.tsx:30`).
3. Manage vendor categories (`app/dashboard/vendor-categories/`). Delete a category with vendors attached → blocked? (Yes — check modal.)
4. Disable a user → can they still log in? (Check NextAuth flow.)
5. Admin Renewals page — does it include EXPIRED? (`app/dashboard/admin/renewals/page.tsx:78` — yes, under "Needs Attention".)

### D. Notifications
1. Cron trigger: Vercel daily at 08:00 UTC (`vercel.json`) + local node-cron at 09:00 (`lib/scheduler.ts`).
2. `syncSubscriptionStatuses` transitions (`notification-dispatcher.ts:62-85`):
   - ACTIVE/EXPIRING_SOON with past renewalDate → EXPIRED ✅
   - ACTIVE within 7d of renewal → EXPIRING_SOON ✅
   - EXPIRED → anything? ❌ terminal until manual change.
3. 7d/3d/1d emails. Check NotificationLog dedupe logic (`notification-dispatcher.ts:111-122`).
4. Responsible=null → fallback to all admins (`notification-dispatcher.ts:137-144`).
5. Responsible on vacation → emails sink into one inbox. No escalation.
6. Telegram sent only if `TELEGRAM_GROUP_CHAT_ID` set.
7. Per-user prefs (`renewal7d/3d/1d/renewalExpired`). Expired pref is ghost (see B.7).

### E. Edge cases
1. Sub with `cost = 0` or huge value — display formatting holds (`fmt(n/100)`).
2. Renewal date exactly today — classified as EXPIRING_SOON or EXPIRED?
3. Cron never runs (missing `CRON_SECRET`) — statuses drift silently, no UI warning.
4. Multiple rapid cron invocations — NotificationLog acts as lock (`notification-dispatcher.ts:151-159`).
5. No currency field — all costs treated as USD.
6. No contract/invoice attachment — nowhere to store PDFs.
7. BillingCycle CUSTOM with `customDays=null` — falls through to yearly default (`admin/renewals/[id]/route.ts:23`).
8. Vendor deleted while subscriptions reference it — does Prisma protect? (Check schema relation.)

## Output format

```
# User Simulator Report — <scope or "full">

## 🔴 Critical
1. **<Scenario name>** — `file.ts:line`
   - As user I expected: ...
   - What happens instead: ...
   - Fix sketch: ...

## 🟠 High
...

## 🟡 Medium
...

## ✅ Works as intended
- Brief list of flows that passed, for confidence.

## Summary
- N critical, N high, N medium findings
- Top 3 to fix first: ...
```

## Method — what Claude does when this skill runs

1. Parse scope argument (`renewals`, `admin`, `notifications`, `edge`, or empty=all).
2. For each in-scope scenario, open the relevant files (grep first, read only what's needed).
3. Trace the user's click/navigation against the code.
4. Note any friction with `file:line`.
5. Classify severity. Write the report in the format above.
6. **Do not suggest implementations unless user asks** — the report is diagnostic.

## Known starting points (don't re-discover)

- Cron endpoint: `app/api/cron/notifications/route.ts`
- Status sync: `lib/notification-dispatcher.ts:62-85`
- Mark Renewed (user): `app/actions/subscriptions.ts:123-152`
- Mark Renewed (admin): `app/api/admin/renewals/[id]/route.ts:16-31`
- Renewals page filter: `app/dashboard/renewals/page.tsx:37`
- Settings ghost toggle: `app/dashboard/settings/page.tsx:171`
- NotifType enum: `prisma/schema.prisma:257-263`
- SubscriptionStatus enum: `prisma/schema.prisma:244-250`
