---
name: qa-review
description: Review a file or feature from a Senior QA Engineer perspective. Identifies test gaps, missing edge cases, auth holes, and regression risks. Outputs a prioritized test checklist.
argument-hint: <file path>
---

# QA Review

Review a file as a Senior QA Engineer and produce a test checklist.

## Instructions

1. Get the file path from arguments: $ARGUMENTS

2. Read the target file.

3. Check if an existing test file exists:
   - If `app/actions/foo.ts` → look for `__tests__/actions/foo.test.ts`
   - If `app/api/foo/route.ts` → look for `__tests__/api/foo.test.ts`
   - Read it if it exists, pass as `existingTests`

4. Create `__temp_qa.ts`, run with `npx tsx __temp_qa.ts`, then delete it:

```typescript
import { readFileSync, existsSync } from "fs"
import { reviewQA } from "./agents"

const code = readFileSync("$ARGUMENTS", "utf-8")
const existingTestPath = "$ARGUMENTS"
  .replace("app/actions/", "__tests__/actions/")
  .replace("app/api/", "__tests__/api/")
  .replace(/route\.ts$/, "route.test.ts")
  .replace(/\.ts$/, ".test.ts")

const existingTests = existsSync(existingTestPath)
  ? readFileSync(existingTestPath, "utf-8")
  : undefined

const review = await reviewQA({
  code,
  filename: "$ARGUMENTS",
  existingTests,
})

console.log("=== QA REVIEW ===")
console.log("File:", "$ARGUMENTS")
console.log("Risk level:", review.riskLevel.toUpperCase())
console.log("Result:", review.approved ? "✓ APPROVED" : "✗ NEEDS MORE TESTS")
console.log("Summary:", review.summary)
console.log("Missing must-have tests:", review.missingMustHave)

if (review.coverageGaps.length > 0) {
  console.log("\n⚠ COVERAGE GAPS:")
  review.coverageGaps.forEach(g => console.log(" -", g))
}

if (review.validationGaps.length > 0) {
  console.log("\n🔴 VALIDATION GAPS (missing from code):")
  review.validationGaps.forEach(g => console.log(" -", g))
}

if (review.regressionRisks.length > 0) {
  console.log("\n⚡ REGRESSION RISKS:")
  review.regressionRisks.forEach(r => console.log(" -", r))
}

const mustHave = review.testCases.filter(t => t.priority === "must_have" && !t.alreadyCovered)
if (mustHave.length > 0) {
  console.log(`\n📋 MUST-HAVE TESTS TO WRITE (${mustHave.length}):`)
  mustHave.forEach((t, i) => {
    console.log(`\n[${i + 1}] [${t.category}] ${t.name}`)
    console.log("  Scenario:", t.scenario)
    console.log("  Expected:", t.expectedOutcome)
  })
}

const shouldHave = review.testCases.filter(t => t.priority === "should_have" && !t.alreadyCovered)
if (shouldHave.length > 0) {
  console.log(`\n📋 SHOULD-HAVE TESTS (${shouldHave.length}):`)
  shouldHave.forEach(t => console.log(` - [${t.category}] ${t.name}`))
}

const covered = review.testCases.filter(t => t.alreadyCovered)
if (covered.length > 0) {
  console.log(`\n✓ ALREADY COVERED (${covered.length} tests):`)
  covered.forEach(t => console.log(` - ${t.name}`))
}

console.log("\n📌 TOP 3 ACTIONS:")
review.prioritizedActions.forEach((a, i) => console.log(`  ${i + 1}. ${a}`))
console.log("\nSuggested test file:", review.suggestedTestFile)
```

5. Present the checklist clearly — lead with must-have missing tests.

6. Ask: "Want me to generate these missing tests? (uses /run-pipeline test generation)"

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Best used on files in `app/actions/`, `app/api/`, `lib/`
- Pairs well with `/run-pipeline` to generate the missing tests
- Clean up `__temp_qa.ts` after running
