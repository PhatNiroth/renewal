---
name: ux-review
description: Review a UI component or page from a Senior UX/UI Designer perspective. Flags missing states, accessibility gaps, mobile issues, confusing copy, and visual hierarchy problems.
argument-hint: <file path>
---

# UX Review

Review a UI component as a Senior UX/UI Designer.

## Instructions

1. Get the file path from arguments: $ARGUMENTS

2. Read the file content.

3. Detect the page type from the filename/content:
   - `*-client.tsx` or `page.tsx` → "page"
   - `modal*` or `*Modal*` → "modal"
   - `*form*` or `*Form*` → "form"
   - Otherwise → "component"

4. Create `__temp_ux.ts`, run with `npx tsx __temp_ux.ts`, then delete it:

```typescript
import { readFileSync } from "fs"
import { reviewUX } from "./agents"

const code = readFileSync("$ARGUMENTS", "utf-8")

const review = await reviewUX({
  code,
  filename: "$ARGUMENTS",
  pageType: "page", // update based on detected type above
})

console.log("=== UX REVIEW ===")
console.log("File:", "$ARGUMENTS")
console.log("Score:", review.score + "/10")
console.log("Result:", review.approved ? "✓ APPROVED" : "✗ NEEDS WORK")
console.log("Summary:", review.summary)
console.log(`\nIssues: ${review.criticalCount} critical, ${review.warningCount} warnings, ${review.suggestionCount} suggestions`)

if (review.missingStates.length > 0) {
  console.log("\n⚠ MISSING UI STATES:")
  review.missingStates.forEach(s => console.log(" -", s))
}

if (review.issues.filter(i => i.severity === "critical").length > 0) {
  console.log("\n🔴 CRITICAL ISSUES:")
  review.issues
    .filter(i => i.severity === "critical")
    .forEach((issue, idx) => {
      console.log(`\n[${idx + 1}] ${issue.title}`)
      console.log("  Category:", issue.category)
      if (issue.location) console.log("  Location:", issue.location)
      console.log("  Problem:", issue.description)
      console.log("  Fix:", issue.fix)
      if (issue.example) console.log("  Example:\n", issue.example)
    })
}

if (review.issues.filter(i => i.severity === "warning").length > 0) {
  console.log("\n🟡 WARNINGS:")
  review.issues
    .filter(i => i.severity === "warning")
    .forEach(issue => {
      console.log(`\n  [${issue.category}] ${issue.title}`)
      console.log("  Problem:", issue.description)
      console.log("  Fix:", issue.fix)
    })
}

if (review.issues.filter(i => i.severity === "suggestion").length > 0) {
  console.log("\n💡 SUGGESTIONS:")
  review.issues
    .filter(i => i.severity === "suggestion")
    .forEach(issue => console.log(` - ${issue.title}: ${issue.fix}`))
}

if (review.positives.length > 0) {
  console.log("\n✓ WHAT'S GOOD:")
  review.positives.forEach(p => console.log(" -", p))
}

console.log("\n📌 TOP 3 FIXES:")
review.prioritizedFixes.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
```

5. Present results clearly.

6. If `approved === false`:
   - List critical issues with exact fixes
   - Ask: "Want me to apply these fixes?"

7. If `approved === true`:
   - Confirm the UI is ready to ship
   - Mention any warning-level suggestions briefly

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Best used on files in `app/dashboard/` — components, pages, modals
- Clean up `__temp_ux.ts` after running
