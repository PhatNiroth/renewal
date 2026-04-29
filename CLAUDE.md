@AGENTS.md

# Krawma Renewal — Project Instructions

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.2 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL via Prisma ORM (port 5436) |
| Auth | JWT via `jose` (`jwtVerify`) — issued by `dashboard.krawma.com` |
| Email | Resend |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |

## Key Rules (see `.claude/rules/` for detail)
- **No public signup** — no login page in this app, auth is owned by `dashboard.krawma.com`
- **No `new PrismaClient()`** — use singleton from `lib/db.ts`
- **Money = cents everywhere** — format to dollars only in UI
- **Next.js 16.2.2** — dynamic params are async: `const { id } = await params`
- **Middleware** uses raw `jwtVerify` from `jose` — never import `lib/auth.ts` there
- **Icons**: `@remixicon/react` only (`Ri`-prefixed)
- **Tailwind v4**: `@import "tailwindcss"` — not `@tailwind` directives
- **basePath = `/renewal`** — all routes are prefixed with `/renewal`, served under `dashboard.krawma.com/renewal`

## Project Structure
```
app/
├── dashboard/        # Authenticated area
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
- **Login is handled by `dashboard.krawma.com/login`** — this app has no login page
- Unauthenticated users are redirected to `https://dashboard.krawma.com/login` by middleware
- Session is a JWT (`access_token` cookie) issued by `dashboard.krawma.com`, verified with `JWT_ACCESS_SECRET`
- Cookie is set on `localhost` (local) or `dashboard.krawma.com` (prod) — no `COOKIE_DOMAIN` needed locally
- Session fields: `id`, `email`, `name`, `isAdmin`
- Dashboard layout handles session redirect — don't duplicate in pages
- **`JWT_ACCESS_SECRET` must match the value in `dashboard.krawma.com`'s `.env`**

## Permission Model
- Any authenticated user can access everything except Settings
- `isAdmin: true` gates `/dashboard/settings` (enforced in middleware)
- API routes and Server Actions: check `session?.user` (login only) — no per-module permission checks
- Do NOT add per-module permission guards — the old `can()` / `getPermissions()` pattern is retired

## Settings (Admin Only)
- `/dashboard/settings` — admin only, guarded by middleware
- Contains **global** notification preferences for the whole company
- Stored in `GlobalNotificationSetting` table (single row, `id = "global"`)
- API: `GET/PATCH /api/admin/notifications`
- Profile and password management are handled by `dashboard.krawma.com` — do not add them here

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
