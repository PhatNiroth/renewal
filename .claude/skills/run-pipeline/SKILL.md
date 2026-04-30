---
name: run-pipeline
description: Run the full dev agent pipeline for a single coding step — Plan → Generate → Review → Test → Audit → Document. Produces reviewed, tested, and documented code ready to write to disk.
argument-hint: <feature or task description>
---

# Run Pipeline

Run the full development agent pipeline for a coding task.

## Pipeline Order
Plan → Generate → Review → Test → Audit → Document

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
import { generateTests } from "./agents/dev/test-generator.agent"
import { auditSecurity } from "./agents/business/../dev/../business/../dev/../../agents/dev/../../agents"
import { generateDocs } from "./agents/dev/documentation.agent"
import { readFileSync } from "fs"

const task = `$ARGUMENTS`
const schema = readFileSync("prisma/schema.prisma", "utf-8")

// Step 1: Plan
console.log("\n=== STEP 1: PLANNING ===")
const plan = await planFeature({ request: task })
console.log("Summary:", plan.featureSummary)
console.log("Steps:", plan.totalSteps)
console.log("Complexity:", plan.estimatedComplexity)
if (plan.warnings.length > 0) console.log("Warnings:", plan.warnings.join(", "))
plan.steps.forEach(s => console.log(`  [${s.stepNumber}] ${s.title} → ${s.fileToCreate ?? s.fileToEdit ?? "TBD"}`))

// Only pipeline step 1 automatically — user confirms before full generation
const step = plan.steps[0]
console.log(`\n=== STEP 2: GENERATING CODE (Step ${step.stepNumber}: ${step.title}) ===`)

const generated = await generateCode({
  task: `${step.title}: ${step.description}`,
  fileType: step.type,
  filePath: step.fileToCreate ?? step.fileToEdit ?? "unknown",
  relatedCode: schema,
  requirements: step.notes ? [step.notes] : [],
})
console.log("File:", step.fileToCreate ?? step.fileToEdit)
console.log("Explanation:", generated.explanation)
if (generated.newPackagesNeeded.length > 0) console.log("New packages:", generated.newPackagesNeeded.join(", "))
if (generated.warnings.length > 0) console.log("Warnings:", generated.warnings.join("\n"))

// Step 3: Review
console.log("\n=== STEP 3: CODE REVIEW ===")
const review = await reviewCode({
  code: generated.code,
  filename: step.fileToCreate ?? step.fileToEdit ?? "unknown",
})
console.log("Score:", review.score + "/100")
console.log("Approved:", review.approved)
console.log("Summary:", review.summary)
if (!review.approved) {
  console.log("\nBLOCKED — Critical issues found:")
  review.issues.filter(i => i.severity === "critical").forEach(i => {
    console.log(`  [CRITICAL] ${i.title}: ${i.description}`)
    console.log("  Fix:", i.suggestedFix)
  })
  process.exit(1)
}

// Step 4: Tests
console.log("\n=== STEP 4: TEST GENERATION ===")
const tests = await generateTests({
  code: generated.code,
  filename: step.fileToCreate ?? step.fileToEdit ?? "unknown",
})
console.log("Test file:", tests.testFilePath)
console.log("Test cases:", tests.testCases.length)
tests.testCases.forEach(t => console.log(`  [${t.category}] ${t.name}`))

// Step 5: Security Audit (only for API routes and actions)
const filePath = step.fileToCreate ?? step.fileToEdit ?? ""
const needsAudit = filePath.includes("app/api/") || filePath.includes("app/actions/")
if (needsAudit) {
  console.log("\n=== STEP 5: SECURITY AUDIT ===")
  const fileType = filePath.includes("app/api/") ? "api_route" : "server_action"
  const audit = await auditSecurity({ code: generated.code, filename: filePath, fileType })
  console.log("Result:", audit.passed ? "PASSED" : "FAILED")
  console.log("Risk:", audit.riskLevel.toUpperCase())
  if (!audit.passed) {
    console.log("Security issues found:")
    audit.issues.filter(i => i.severity === "critical" || i.severity === "high").forEach(i => {
      console.log(`  [${i.severity.toUpperCase()}] ${i.title}: ${i.description}`)
    })
    process.exit(1)
  }
} else {
  console.log("\n=== STEP 5: SECURITY AUDIT — SKIPPED (not an API route or action) ===")
}

// Step 6: Documentation
console.log("\n=== STEP 6: DOCUMENTATION ===")
const docs = await generateDocs({
  code: generated.code,
  filename: filePath,
})
console.log("Summary:", docs.summary)

console.log("\n=== PIPELINE COMPLETE ===")
console.log("File ready to write:", filePath)
console.log("\n--- FINAL CODE ---")
console.log(docs.documentedCode)
console.log("--- TEST CODE ---")
console.log(tests.testCode)
if (plan.totalSteps > 1) {
  console.log(`\nRemaining steps (${plan.totalSteps - 1}):`)
  plan.steps.slice(1).forEach(s => console.log(`  [${s.stepNumber}] ${s.title}`))
  console.log("\nRun /run-pipeline again with the next step description to continue.")
}
```

4. If pipeline passes — show the final documented code and test code, then ask:
   > "Write these files to disk? (yes/no)"
   If yes, write the code to the target file and test code to the appropriate `__tests__/` path.

5. If pipeline is blocked (review or audit failed) — show the issues and stop. Do not write any files.

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Clean up `__temp_pipeline.ts` after running
- Only pipelines Step 1 automatically — remaining steps need separate `/run-pipeline` calls
