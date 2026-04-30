---
name: dev-review
description: Review a file from a Senior Developer perspective — deeper than the standard code review. Checks architecture, Next.js patterns, Prisma usage, security, performance, and maintainability.
argument-hint: <file path>
---

# Senior Dev Review

Review a file as a Senior Developer — architecture, patterns, security, and performance.

## Instructions

1. Get the file path from arguments: $ARGUMENTS

2. Read the target file.

3. Read related files for context:
   - Always read `prisma/schema.prisma` for DB context
   - If it's an action → also read `lib/auth.ts` for auth patterns
   - If it's an API route → also read `middleware.ts`

4. Create `__temp_devreview.ts`, run with `npx tsx __temp_devreview.ts`, then delete it:

```typescript
import { readFileSync } from "fs"
import { reviewCode } from "./agents"

const code = readFileSync("$ARGUMENTS", "utf-8")
const schema = readFileSync("prisma/schema.prisma", "utf-8")

const review = await reviewCode({
  code,
  filename: "$ARGUMENTS",
  context: `
This is a Next.js 16.2.2 App Router project. Key rules:
- Use Prisma singleton from lib/db.ts — never new PrismaClient()
- Money is always stored in cents — never dollars
- Dynamic route params are async: const { id } = await params
- Server Actions must verify session via getSession() from lib/auth.ts
- API routes must check session — no unauthenticated access
- Never import lib/auth.ts in middleware (Edge Runtime incompatibility)
- Icons: @remixicon/react only
- Tailwind v4: @import "tailwindcss" syntax

Prisma schema for reference:
${schema.slice(0, 2000)}
  `.trim(),
})

console.log("=== SENIOR DEV REVIEW ===")
console.log("File:", "$ARGUMENTS")
console.log("Score:", review.score + "/10")
console.log("Result:", review.approved ? "✓ APPROVED" : "✗ NEEDS FIXES")
console.log("Summary:", review.summary)
console.log(`\nIssues: ${review.criticalCount} critical, ${review.warningCount} warnings, ${review.suggestionCount} suggestions`)

if (review.issues.filter(i => i.severity === "critical").length > 0) {
  console.log("\n🔴 CRITICAL — Must fix before merging:")
  review.issues
    .filter(i => i.severity === "critical")
    .forEach((issue, i) => {
      console.log(`\n[${i + 1}] [${issue.category.toUpperCase()}] ${issue.title}`)
      if (issue.line) console.log("  Line:", issue.line)
      console.log("  Problem:", issue.description)
      console.log("  Fix:", issue.suggestion)
    })
}

if (review.issues.filter(i => i.severity === "warning").length > 0) {
  console.log("\n🟡 WARNINGS — Should fix:")
  review.issues
    .filter(i => i.severity === "warning")
    .forEach(issue => {
      console.log(`\n  [${issue.category}] ${issue.title}`)
      if (issue.line) console.log("  Line:", issue.line)
      console.log("  Problem:", issue.description)
      console.log("  Fix:", issue.suggestion)
    })
}

if (review.issues.filter(i => i.severity === "suggestion").length > 0) {
  console.log("\n💡 SUGGESTIONS:")
  review.issues
    .filter(i => i.severity === "suggestion")
    .forEach(issue => console.log(` - ${issue.title}: ${issue.suggestion}`))
}

if (review.highlights.length > 0) {
  console.log("\n✓ GOOD:")
  review.highlights.forEach(h => console.log(" -", h))
}
```

5. Present results. Focus on critical and warning issues.

6. If `approved === false`:
   - Show each critical issue with exact fix
   - Ask: "Want me to apply these fixes now?"

7. If `approved === true`:
   - Confirm the code is ready to merge
   - Briefly mention any suggestions

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Injects project-specific rules (Prisma singleton, cents, async params) into the review context
- Complements `/audit-route` — this is code quality, `/audit-route` is security-focused
- Clean up `__temp_devreview.ts` after running
