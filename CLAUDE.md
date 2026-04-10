@AGENTS.md

# Krawma Renewal — Project Instructions

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.2 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL via Prisma ORM (port 5436) |
| Auth | NextAuth.js v5 |
| Email | Resend |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |

## Key Rules (see `.claude/rules/` for detail)
- **No public signup** — admin creates users only via Admin Panel
- **No `new PrismaClient()`** — use singleton from `lib/db.ts`
- **Money = cents everywhere** — format to dollars only in UI
- **Next.js 16.2.2** — dynamic params are async: `const { id } = await params`
- **Middleware** uses edge-safe `auth.config.ts` — never import `lib/auth.ts` there
- **Bcrypt rounds = 12** across all password hashing
- **Icons**: `@remixicon/react` only (`Ri`-prefixed)
- **Tailwind v4**: `@import "tailwindcss"` — not `@tailwind` directives

## Project Structure
```
app/
├── (auth)/           # Login only — no signup page
├── dashboard/        # Authenticated area
│   ├── admin/        # Admin-only (isAdmin guard)
│   ├── subscriptions/
│   ├── billing/
│   ├── renewals/
│   ├── vendors/
│   └── settings/
├── api/              # API routes
└── actions/          # Server Actions

agents/               # Claude AI agents
lib/                  # db.ts, auth.ts, email.ts, utils.ts, permissions.ts
components/ui/        # button, input, card, badge, modal
prisma/               # schema.prisma, migrations/, seed.ts
```

## Auth & Session
- Session fields: `id`, `email`, `name`, `isAdmin`, `roleName`, `permissions`
- Check admin: `session.user.isAdmin` — NOT `.role`
- Admin API routes: use `requireAdmin()` from `lib/permissions.ts`
- Dashboard layout handles session redirect — don't duplicate in pages

## Before Finishing Any Task
1. Run `npx tsc --noEmit` — no type errors allowed
2. Run `npm test` — all tests must pass
3. Run `/audit-route` for any file in `app/api/` or `app/actions/`
4. Run `/check-db-sync` after any `prisma/schema.prisma` change

## Development Commands
```bash
npm run dev                          # Dev server
npm test                             # Run tests
npx tsc --noEmit                     # Type check
npx prisma migrate dev --name <desc> # New migration
npx prisma db seed                   # Seed database
npm run lint                         # Lint
```
