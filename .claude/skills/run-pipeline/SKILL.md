---
name: run-pipeline
description: Run the full dev agent pipeline for a single coding step — Plan → Generate → Dev Review → UX Review → QA Review → Test → Security Audit → Document. Produces reviewed, tested, and documented code ready to write to disk.
argument-hint: <feature or task description>
---

# Run Pipeline

Run the full development agent pipeline for a coding task.

## Pipeline Order
Plan → Generate → Dev Review → UX Review (UI only) → QA Review → Test → Security Audit → Document

## Instructions

1. Read the task from arguments: $ARGUMENTS

2. Read project context:
   - `prisma/schema.prisma` — current schema
   - `app/actions/subscriptions.ts` — existing action patterns

3. Create `__temp_pipeline.ts`, run with `npx tsx __temp_pipeline.ts`, then delete it:

```typescript
import { planFeature } from "./agents/dev/planner.agent"
import { generateCode } from "./agents/dev/code-generator.agent"
import { reviewCode } from "./agents/dev/code-review.agent"
import { reviewUX } from "./agents/dev/ux-reviewer.agent"
import { reviewQA } from "./agents/dev/qa-reviewer.agent"
import { generateTests } from "./agents/dev/test-generator.agent"
import { auditSecurity } from "./agents/dev/security-auditor.agent"
import { generateDocs } from "./agents/dev/documentation.agent"
import { readFileSync } from "fs"

const task = `$ARGUMENTS`
const schema = readFileSync("prisma/schema.prisma", "utf-8")

// ── Step 1: Plan ─────────────────────────────────────────────────────────────
console.log("\n=== STEP 1: PLANNING ===")
const plan = await planFeature({ request: task })
console.log("Summary:", plan.featureSummary)
console.log("Steps:", plan.totalSteps, "| Complexity:", plan.estimatedComplexity)
if (plan.warnings.length > 0) console.log("Warnings:", plan.warnings.join(", "))
plan.steps.forEach(s => console.log(`  [${s.stepNumber}] ${s.title} → ${s.fileToCreate ?? s.fileToEdit ?? "TBD"}`))

const step = plan.steps[0]
const filePath = step.fileToCreate ?? step.fileToEdit ?? "unknown"
const isUIFile = filePath.includes("app/dashboard/") || filePath.endsWith(".tsx")
const isAPIOrAction = filePath.includes("app/api/") || filePath.includes("app/actions/")

// ── Step 2: Generate ─────────────────────────────────────────────────────────
console.log(`\n=== STEP 2: GENERATING CODE (Step ${step.stepNumber}: ${step.title}) ===`)
const generated = await generateCode({
  task: `${step.title}: ${step.description}`,
  fileType: step.type,
  filePath,
  relatedCode: schema,
  requirements: step.notes ? [step.notes] : [],
})
console.log("File:", filePath)
console.log("Explanation:", generated.explanation)
if (generated.newPackagesNeeded.length > 0) console.log("New packages:", generated.newPackagesNeeded.join(", "))
if (generated.warnings.length > 0) console.log("Warnings:", generated.warnings.join("\n"))

// ── Step 3: Senior Dev Review ─────────────────────────────────────────────────
console.log("\n=== STEP 3: SENIOR DEV REVIEW ===")
const devReview = await reviewCode({
  code: generated.code,
  filename: filePath,
  context: `Next.js 16.2.2, Prisma singleton from lib/db.ts, money in cents, async params. Schema: ${schema.slice(0, 1500)}`,
})
console.log("Score:", devReview.score + "/10 | Approved:", devReview.approved)
console.log("Summary:", devReview.summary)
if (!devReview.approved) {
  console.log("\nBLOCKED — Critical issues:")
  devReview.issues.filter(i => i.severity === "critical").forEach(i => {
    console.log(`  [CRITICAL] ${i.title}: ${i.description}`)
    console.log("  Fix:", i.suggestion)
  })
  process.exit(1)
}
if (devReview.issues.filter(i => i.severity === "warning").length > 0) {
  console.log("Warnings:")
  devReview.issues.filter(i => i.severity === "warning").forEach(i =>
    console.log(`  [WARN] ${i.title}: ${i.suggestion}`)
  )
}

// ── Step 4: UX Review (UI files only) ────────────────────────────────────────
if (isUIFile) {
  console.log("\n=== STEP 4: SENIOR UX REVIEW ===")
  const uxReview = await reviewUX({
    code: generated.code,
    filename: filePath,
    pageType: filePath.includes("page.tsx") ? "page" : filePath.includes("modal") ? "modal" : "component",
  })
  console.log("Score:", uxReview.score + "/10 | Approved:", uxReview.approved)
  console.log("Summary:", uxReview.summary)
  if (uxReview.missingStates.length > 0) console.log("Missing states:", uxReview.missingStates.join(", "))
  if (!uxReview.approved) {
    console.log("\nBLOCKED — Critical UX issues:")
    uxReview.issues.filter(i => i.severity === "critical").forEach(i => {
      console.log(`  [CRITICAL] ${i.title}: ${i.fix}`)
    })
    console.log("Top 3 fixes:", uxReview.prioritizedFixes.join(" | "))
    process.exit(1)
  }
  if (uxReview.issues.filter(i => i.severity === "warning").length > 0) {
    console.log("UX warnings:")
    uxReview.issues.filter(i => i.severity === "warning").forEach(i =>
      console.log(`  [UX WARN] ${i.title}: ${i.fix}`)
    )
  }
} else {
  console.log("\n=== STEP 4: UX REVIEW — SKIPPED (not a UI file) ===")
}

// ── Step 5: QA Review ────────────────────────────────────────────────────────
console.log("\n=== STEP 5: SENIOR QA REVIEW ===")
const qaReview = await reviewQA({
  code: generated.code,
  filename: filePath,
})
console.log("Risk:", qaReview.riskLevel.toUpperCase(), "| Approved:", qaReview.approved)
console.log("Summary:", qaReview.summary)
console.log("Missing must-have tests:", qaReview.missingMustHave)
if (qaReview.validationGaps.length > 0) console.log("Validation gaps:", qaReview.validationGaps.join("; "))
if (qaReview.regressionRisks.length > 0) console.log("Regression risks:", qaReview.regressionRisks.join("; "))
const mustHaveMissing = qaReview.testCases.filter(t => t.priority === "must_have" && !t.alreadyCovered)
if (mustHaveMissing.length > 0) {
  console.log("Must-have tests to write:")
  mustHaveMissing.forEach(t => console.log(`  - [${t.category}] ${t.name}`))
}

// ── Step 6: Test Generation ───────────────────────────────────────────────────
console.log("\n=== STEP 6: TEST GENERATION ===")
const tests = await generateTests({
  code: generated.code,
  filename: filePath,
})
console.log("Test file:", tests.testFilePath)
console.log("Test cases:", tests.testCases.length)
tests.testCases.forEach(t => console.log(`  [${t.category}] ${t.name}`))

// ── Step 7: Security Audit ────────────────────────────────────────────────────
if (isAPIOrAction) {
  console.log("\n=== STEP 7: SECURITY AUDIT ===")
  const fileType = filePath.includes("app/api/") ? "api_route" : "server_action"
  const audit = await auditSecurity({ code: generated.code, filename: filePath, fileType })
  console.log("Result:", audit.passed ? "PASSED" : "FAILED", "| Risk:", audit.riskLevel.toUpperCase())
  if (!audit.passed) {
    console.log("Security issues found:")
    audit.issues.filter(i => i.severity === "critical" || i.severity === "high").forEach(i => {
      console.log(`  [${i.severity.toUpperCase()}] ${i.title}: ${i.description}`)
    })
    process.exit(1)
  }
} else {
  console.log("\n=== STEP 7: SECURITY AUDIT — SKIPPED (not an API route or action) ===")
}

// ── Step 8: Documentation ─────────────────────────────────────────────────────
console.log("\n=== STEP 8: DOCUMENTATION ===")
const docs = await generateDocs({ code: generated.code, filename: filePath })
console.log("Summary:", docs.summary)

// ── Pipeline Complete ─────────────────────────────────────────────────────────
console.log("\n=== PIPELINE COMPLETE ===")
console.log("File:", filePath)
console.log("Test file:", tests.testFilePath)
console.log("\n--- FINAL CODE ---")
console.log(docs.documentedCode)
console.log("\n--- TEST CODE ---")
console.log(tests.testCode)

if (plan.totalSteps > 1) {
  console.log(`\nRemaining steps (${plan.totalSteps - 1}):`)
  plan.steps.slice(1).forEach(s => console.log(`  [${s.stepNumber}] ${s.title}`))
  console.log("\nRun /run-pipeline with the next step description to continue.")
}
```

4. If pipeline passes — show final code and tests, then ask:
   > "Write these files to disk? (yes/no)"
   If yes, write code to the target file and tests to `__tests__/`.

5. If pipeline is blocked at any step — show what failed and stop. Do not write files.

## Pipeline gates (blocks if failed)
- **Dev Review** — blocks on any critical code issue
- **UX Review** — blocks on critical UX issue (UI files only)
- **Security Audit** — blocks on critical/high security issue (API/actions only)
- QA Review warns but does not block — test gaps are reported, not fatal

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Clean up `__temp_pipeline.ts` after running
- Only pipelines Step 1 automatically — remaining steps need separate `/run-pipeline` calls
