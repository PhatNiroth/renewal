---
paths:
  - "prisma/**"
  - "lib/db.ts"
  - "app/api/**"
  - "app/actions/**"
---

# Database Rules

## Prisma Client
- Always import from `lib/db.ts`: `import { db } from "@/lib/db"`
- Never call `new PrismaClient()` anywhere — it breaks connection pooling

## Monetary Values
- Store ALL money as **cents** (integers) — never decimals
- Display only: `$${(amount / 100).toFixed(2)}`
- Wrong: `amount: 12.99` — Right: `amount: 1299`

## Schema Changes
- Never edit `prisma/schema.prisma` without creating a migration
- After schema edit: `npx prisma migrate dev --name <description>`
- Run `/check-db-sync` to verify schema matches the live DB

## Query Safety
- Always check if record exists before updating/deleting
- Return 404 if not found: `NextResponse.json({ error: "Not found" }, { status: 404 })`
- Use `findUnique` for single records, `findMany` with filters for lists
- Run `/find-n-plus-one` when adding new `include` blocks
