@AGENTS.md

# Subscription & Renewal Management System

A full-stack Subscription and Renewal Management System built with Next.js 16.2.2 (App Router), TypeScript, Tailwind CSS v4, Prisma ORM, NextAuth.js, and Stripe.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.2 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth.js v5 (App Router adapter) |
| Email | Resend (transactional emails) |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |

---

## Project Structure

```
app/
├── (auth)/                     # Unauthenticated routes
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (dashboard)/                # Authenticated user routes
│   ├── layout.tsx              # Auth guard + sidebar
│   ├── page.tsx                # Overview / home
│   ├── subscriptions/
│   │   ├── page.tsx            # Current subscription details
│   │   └── plans/page.tsx      # Available plans & upgrade UI
│   ├── billing/
│   │   ├── page.tsx            # Billing history
│   │   └── invoices/[id]/page.tsx
│   └── renewals/page.tsx       # Upcoming renewals & settings
├── (admin)/                    # Admin-only routes
│   ├── layout.tsx              # Role guard (admin only)
│   ├── page.tsx                # Admin overview
│   ├── users/page.tsx
│   ├── subscriptions/page.tsx
│   └── plans/
│       ├── page.tsx
│       └── [id]/page.tsx
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── subscriptions/
│   │   ├── route.ts            # GET list, POST create
│   │   └── [id]/route.ts       # GET, PATCH, DELETE
│   └── billing/route.ts
├── actions/                    # Server Actions
│   ├── auth.ts
│   ├── subscriptions.ts
│   └── billing.ts
├── layout.tsx
└── page.tsx                    # Marketing / landing page

lib/
├── db.ts                       # Prisma client singleton
├── auth.ts                     # NextAuth config & session helpers
├── stripe.ts                   # Stripe client singleton
├── email.ts                    # Resend email utilities
└── utils.ts                    # Shared helpers

components/
├── ui/                         # Base UI primitives (buttons, inputs, cards)
├── auth/                       # Login/signup forms
├── subscriptions/              # Plan cards, subscription status
├── billing/                    # Invoice list, billing portal button
└── admin/                      # Admin tables and dashboards

prisma/
├── schema.prisma
└── migrations/
```

---

## Database Schema (Prisma)

```prisma
model User {
  id               String         @id @default(cuid())
  email            String         @unique
  name             String?
  role             Role           @default(USER)
  stripeCustomerId String?        @unique
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  subscriptions    Subscription[]
  invoices         Invoice[]
  sessions         Session[]
}

enum Role { USER ADMIN }

model Plan {
  id            String         @id @default(cuid())
  name          String         @unique  // "Free" | "Pro" | "Enterprise"
  slug          String         @unique
  price         Int            // In cents (0 for free)
  interval      Interval       @default(MONTHLY)
  stripePriceId String?        @unique
  features      Json           // Array of feature strings
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  subscriptions Subscription[]
}

enum Interval { MONTHLY YEARLY }

model Subscription {
  id                   String             @id @default(cuid())
  userId               String
  planId               String
  status               SubscriptionStatus @default(ACTIVE)
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean            @default(false)
  stripeSubscriptionId String?            @unique
  trialEnd             DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  user                 User               @relation(fields: [userId], references: [id])
  plan                 Plan               @relation(fields: [planId], references: [id])
  invoices             Invoice[]
  renewalNotifications RenewalNotification[]
}

enum SubscriptionStatus { ACTIVE TRIALING PAST_DUE CANCELLED EXPIRED PAUSED }

model Invoice {
  id              String        @id @default(cuid())
  userId          String
  subscriptionId  String
  amount          Int           // In cents
  currency        String        @default("usd")
  status          InvoiceStatus @default(PENDING)
  stripeInvoiceId String?       @unique
  stripeHostedUrl String?
  stripePdfUrl    String?
  paidAt          DateTime?
  createdAt       DateTime      @default(now())
  user            User          @relation(fields: [userId], references: [id])
  subscription    Subscription  @relation(fields: [subscriptionId], references: [id])
}

enum InvoiceStatus { PENDING PAID FAILED VOID }

model RenewalNotification {
  id             String       @id @default(cuid())
  subscriptionId String
  type           NotifType
  scheduledFor   DateTime
  sentAt         DateTime?
  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
}

enum NotifType {
  RENEWAL_REMINDER_7_DAYS
  RENEWAL_REMINDER_1_DAY
  RENEWAL_SUCCESS
  RENEWAL_FAILED
  CANCELLATION_CONFIRMED
}
```

---

## Key Business Rules

### Subscription Lifecycle
1. User signs up → automatically assigned **Free** plan
2. Subscription renews automatically unless `cancelAtPeriodEnd = true`
3. On renewal failure → status becomes `PAST_DUE`
4. After grace period (3 days past due) → status becomes `EXPIRED`

### Renewal Notifications
- Send email 7 days before renewal
- Send email 1 day before renewal
- Send email on successful renewal
- Send email on failed renewal with retry info

### Plan Tiers
| Plan | Price | Interval | Features |
|---|---|---|---|
| Free | $0 | — | Up to 3 subscriptions tracked, basic dashboard |
| Pro | $12 | Monthly / $120 Yearly | Unlimited subscriptions, renewal alerts, CSV export |
| Enterprise | $49 | Monthly / $490 Yearly | All Pro + team seats, admin panel, API access |

### Upgrades & Downgrades
- Upgrade: immediate change
- Downgrade: takes effect at end of current period
- Cancellation: `cancelAtPeriodEnd = true`; access until period end

---

## API Routes

### Subscriptions
- `GET /api/subscriptions` — list authenticated user's subscriptions
- `POST /api/subscriptions` — create subscription
- `GET /api/subscriptions/[id]` — get single subscription
- `PATCH /api/subscriptions/[id]` — update (cancel, change plan)
- `DELETE /api/subscriptions/[id]` — cancel immediately (admin only)

### Billing
- `GET /api/billing` — list invoices for authenticated user

---

## Server Actions

Prefer Server Actions over API routes for form submissions:

```ts
// app/actions/subscriptions.ts
'use server'
export async function cancelSubscription(subscriptionId: string) { ... }
export async function changePlan(subscriptionId: string, newPlanId: string) { ... }
```

```ts
// app/actions/auth.ts
'use server'
export async function signup(formData: FormData) { ... }
export async function login(formData: FormData) { ... }
```

---

## Auth & Authorization

- NextAuth.js v5, Credentials provider, database sessions
- Session contains: `userId`, `email`, `role`
- Protect routes via `middleware.ts` at project root
- `(dashboard)` layout: redirect to `/login` if no session
- `(admin)` layout: redirect to `/dashboard` if `role !== 'ADMIN'`

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Coding Conventions

- Server Components by default; add `'use client'` only when needed (interactivity, browser APIs, hooks)
- Mutations via Server Actions or API route handlers; call `revalidatePath()` after writes
- All monetary values stored as **cents** (integers); format to dollars only in the UI
- Tailwind v4 syntax: `@import "tailwindcss"` in globals.css — not `@tailwind base/components/utilities`
- Prisma client is a singleton in `lib/db.ts`; never call `new PrismaClient()` in components
- API routes return `{ error: string }` with appropriate HTTP status on failure

---

## Development Workflow

```bash
# Install dependencies
npm install

# Set up and migrate database
npx prisma migrate dev

# Seed plans
npx prisma db seed

# Run dev server
npm run dev

# Lint
npm run lint
```

---

## Admin Panel Features

- View all users and their current plan
- View all subscriptions filtered by status or plan
- Manually cancel or modify any subscription
- Create, edit, and deactivate plans
- Revenue metrics: MRR, churn rate, active subscriber count

---

## Notes for AI Agents

- Read `node_modules/next/dist/docs/` before writing any Next.js code — this is v16.2.2 with breaking changes.
- `@/*` path alias resolves to the project root (`/BTNG/my-claude-app`).
- Prisma client must be a singleton; never instantiate `new PrismaClient()` directly in components.
- All monetary values are in **cents** everywhere except the display layer.
