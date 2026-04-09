# SubTrack — Agent Instructions

## Project Overview
SubTrack is a subscription & renewal management SaaS built with:
- **Next.js 16.2.2** (App Router) — has breaking changes, read `node_modules/next/dist/docs/` before writing any Next.js code
- **TypeScript** (strict mode) — `@/*` alias maps to project root
- **Tailwind CSS v4** — no `tailwind.config.js`, all config lives in `app/globals.css` via `@theme inline`
- **Prisma 5** + PostgreSQL on port `5436`
- **NextAuth v5 beta** — Credentials provider, JWT strategy
- **Stripe** — subscriptions + webhooks
- **Resend** — transactional emails
- **Anthropic SDK** — AI agents in `agents/`

---

## Critical Rules

### Auth & User Management
- **No public signup** — this is an internal tool. The signup page (`app/(auth)/signup/`) has been removed and must NOT be recreated.
- User accounts are created by admins only via the Admin Panel → Users.
- The login page is the only auth entry point for users.

### Next.js
- This is v16.2.2 — APIs may differ from training data. Always read `node_modules/next/dist/docs/` first.
- Dynamic route params are async: `const { id } = await params`
- Server Components by default — add `"use client"` only when needed
- Mutations via Server Actions or API routes; call `revalidatePath()` after writes
- Stripe webhook route must export `export const dynamic = "force-dynamic"`

### Database
- All monetary values stored as **cents** (integers) — never store dollars
- Format to dollars only in the UI: `$${(amount / 100).toFixed(2)}`
- Prisma client is a singleton in `lib/db.ts` — never call `new PrismaClient()` directly
- `DATABASE_URL` connects to PostgreSQL on port `5436`

### Auth
- Middleware (`middleware.ts`) uses **edge-safe** config from `auth.config.ts` — no Prisma there
- Full auth with Prisma lives in `lib/auth.ts` — used only in Node.js runtime
- Never import `lib/auth.ts` from middleware — it will crash (Prisma ≠ Edge Runtime)

### Styling
- Tailwind v4 syntax: `@import "tailwindcss"` — not `@tailwind base/components/utilities`
- All border radius is **5px** (set via CSS vars) — use `rounded-lg` or `rounded-xl`
- Icons: `@remixicon/react` only — `Ri`-prefixed icons
- Button component: `@/components/ui/button` — variants: default, outline, secondary, ghost, destructive, link

---

## Project Structure

```
app/
├── (auth)/           # Login, signup pages — no sidebar
├── dashboard/        # Authenticated user area
│   ├── admin/        # Admin-only panel (role: ADMIN)
│   ├── subscriptions/
│   ├── billing/
│   ├── renewals/
│   └── settings/
├── api/              # API routes
│   ├── auth/[...nextauth]/
│   ├── subscriptions/
│   ├── plans/
│   ├── billing/
│   └── webhooks/stripe/
├── actions/          # Server Actions
│   ├── auth.ts
│   ├── subscriptions.ts
│   └── billing.ts
agents/               # Claude AI agents (runtime code)
lib/                  # Shared utilities
prisma/               # Schema + migrations + seed
components/ui/        # button, input, card, badge
```

---

## AI Agents (`agents/`)

All agents use `claude-opus-4-6` with `thinking: { type: "adaptive" }` and Zod structured output via `zodOutputFormat()`.
All agents are exported from `agents/index.ts`.

### Key design rules for ALL agents
- Never use `budget_tokens` — use `thinking: { type: "adaptive" }` on every agent
- All outputs use Zod schemas via `zodOutputFormat()` — always typed, never raw strings
- Never instantiate a new Anthropic client — use the singleton from `agents/lib/client.ts`
- All money values passed to agents are in **cents** — format to dollars inside the agent prompt only

---

### Business Agents (Subscription Management)

| Agent | Function | Purpose |
|---|---|---|
| `renewal-reminder.agent.ts` | `generateRenewalEmail()` | Generates internal staff notification emails for upcoming vendor renewals |
| `expiry-alert.agent.ts` | `detectExpiryRisk()` | Scores company subscriptions for expiry risk — flags missing owners, overdue renewals, unrecorded payments |
| `spend-optimization.agent.ts` | `analyzeSpend()` | Identifies cost optimization opportunities: yearly savings, vendor consolidation, unused subs |
| `billing-assistant.agent.ts` | `runBillingAssistant()` / `streamBillingAssistant()` | Conversational internal finance assistant with tool-use loop (queries payments, subscriptions, renewals) |
| `analytics.agent.ts` | `generateAnalyticsSummary()` | Turns raw procurement metrics into plain-English management insights |

Additional rules for business agents:
- Input types reference the **internal schema** — `vendorName`, `cost` (cents), `billingCycle`, `renewalDate`
- Emails and notifications go to **internal staff** (Operations / Accounting), never to external customers
- `billing-assistant` injects DB lookup functions at call time — keeping the agent decoupled from Prisma

---

### Development Workflow Agents (Code Pipeline)

These agents form a chain: **Plan → Generate → Review → Test → Audit → Document**

| Agent | Function | Purpose | When to use |
|---|---|---|---|
| `planner.agent.ts` | `planFeature()` | Breaks a plain-English feature request into ordered coding steps | Before writing any code |
| `code-generator.agent.ts` | `generateCode()` | Generates production-ready TypeScript for one step at a time | After planning, one step at a time |
| `code-review.agent.ts` | `reviewCode()` | Reviews code for bugs, performance, maintainability | After generating code |
| `test-generator.agent.ts` | `generateTests()` | Writes tests for reviewed and approved code | After code review passes |
| `security-auditor.agent.ts` | `auditSecurity()` | Checks API routes and Server Actions for auth gaps and vulnerabilities | After code review, before deploying |
| `documentation.agent.ts` | `generateDocs()` | Adds JSDoc comments and plain-English docs to approved code | After all reviews pass |

#### Pipeline flow
```
planFeature(request)
  → steps[]
  → generateCode(step)        ← one step at a time
  → reviewCode(generatedCode) ← must pass (no critical issues)
  → generateTests(code)       ← write tests
  → auditSecurity(code)       ← must pass for API routes / Server Actions
  → generateDocs(code)        ← final documented version
```

#### Rules for development agents
- `planFeature` is always first — never skip planning for features with 3+ files
- `generateCode` takes one step at a time — do NOT pass the full plan at once
- `reviewCode` blocks progress if `approved === false` — fix before continuing
- `auditSecurity` is mandatory for any file in `app/api/` or `app/actions/`
- `generateDocs` runs last — documents what was actually built, not what was planned
- Do NOT mock the database in generated tests — use real Prisma queries

---

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/plans` | Public | List all active plans |
| GET | `/api/subscriptions` | User | List own subscriptions |
| POST | `/api/subscriptions` | User | Create Stripe Checkout session |
| GET/PATCH/DELETE | `/api/subscriptions/[id]` | User/Admin | Get, update, cancel subscription |
| GET | `/api/billing` | User | List own invoices |
| POST | `/api/billing/portal` | User | Create Stripe Billing Portal session |
| POST | `/api/webhooks/stripe` | Stripe | Handle subscription + invoice events |

---

## Do Not

- Do not mock the database — use real Prisma queries
- Do not use `budget_tokens` — use `thinking: { type: "adaptive" }` instead
- Do not add features beyond what is asked
- Do not import Prisma or bcrypt in middleware or Edge Runtime files
- Do not create new `PrismaClient()` instances — use `lib/db.ts`
- Do not store monetary values as decimals — always cents
