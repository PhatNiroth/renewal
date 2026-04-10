---
paths:
  - "app/api/**"
  - "app/actions/**"
---

# API Routes & Server Actions Rules

## Auth Guards
- Every route in `app/api/admin/**` must call `requireAdmin()` from `lib/permissions.ts` as the first thing
- Every user route must call `auth()` and check `session?.user` before any DB query
- Never trust client-supplied user IDs — always use `session.user.id` from the server session

## Response Format
- Success: return the data directly or `{ success: true }`
- Error: always return `{ error: string }` with the correct HTTP status code
- Never expose raw database errors or stack traces to the client

## Dynamic Route Params
- Always await params: `const { id } = await params` — this is Next.js 16.2.2 behavior
- Example: `{ params }: { params: Promise<{ id: string }> }`

## Server Actions
- Must have `"use server"` at the top
- Must call `revalidatePath()` after any write
- Return type should be `{ error: string } | { success: true }`
- Never return raw error messages — log with `console.error`, return generic message

## Security Checklist (run /audit-route after editing)
- [ ] Auth check at top
- [ ] Input validated before DB query
- [ ] No raw error leakage
- [ ] Admin routes use `requireAdmin()`
- [ ] No `any` casts hiding auth logic
