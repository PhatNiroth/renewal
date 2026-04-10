---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
---

# Frontend Rules

## Server vs Client Components
- Server Components by default — no directive needed
- Add `"use client"` only when using: hooks, event handlers, browser APIs, useState, useEffect
- Never import `lib/auth.ts` or `lib/db.ts` in Client Components

## Styling
- Tailwind v4: use `@import "tailwindcss"` in globals.css — NOT `@tailwind base/components/utilities`
- All border radius is **5px** — use `rounded-lg` or `rounded-xl` (set via CSS vars)
- Icons: `@remixicon/react` only — `Ri`-prefixed (e.g. `RiAddLine`, `RiEditLine`)

## UI Components
- Button: `@/components/ui/button` — variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
- Input: `@/components/ui/input`
- Card: `@/components/ui/card`
- Badge: `@/components/ui/badge`
- Modal: `@/components/ui/modal`

## Data Fetching
- Page-level data: fetch in Server Component, pass as props to Client Components
- Mutations: use Server Actions or fetch to API routes — never mutate DB directly in Client Components
- Always call `revalidatePath()` after writes in Server Actions

## Auth in Pages
- Dashboard layout already handles redirect if no session
- Admin layout already handles redirect if not admin
- Don't add duplicate auth checks in individual pages — trust the layout guard
