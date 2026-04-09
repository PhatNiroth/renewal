---
name: plan-feature
description: Plan a new feature for this project using the Planner agent. Breaks a plain-English request into ordered coding steps before writing any code.
argument-hint: <feature description>
---

# Plan Feature

The user wants to plan a new feature for the SubTrack subscription management system.

Use the Planner agent to break the request into ordered coding steps.

## Instructions

1. Read the feature request from the arguments: $ARGUMENTS

2. Read the current project context:
   - Read `AGENTS.md` for agent rules and project conventions
   - Read `prisma/schema.prisma` for the current database schema
   - Read `app/actions/subscriptions.ts` to understand existing patterns

3. Call the Planner agent by writing a small script at `__temp_plan.ts` with this content, then run it with `npx tsx __temp_plan.ts`, then delete it:

```typescript
import { planFeature } from "./agents"

const plan = await planFeature({
  request: `$ARGUMENTS`,
})

console.log("=== FEATURE PLAN ===")
console.log("Summary:", plan.featureSummary)
console.log("Total steps:", plan.totalSteps)
console.log("Complexity:", plan.estimatedComplexity)
console.log("Prisma changes needed:", plan.prismaChangesRequired)
if (plan.newDependenciesRequired.length > 0) {
  console.log("New packages needed:", plan.newDependenciesRequired.join(", "))
}
if (plan.warnings.length > 0) {
  console.log("\nWarnings:")
  plan.warnings.forEach(w => console.log(" -", w))
}
console.log("\n=== STEPS ===")
plan.steps.forEach(step => {
  console.log(`\nStep ${step.stepNumber}: ${step.title}`)
  console.log("  Type:", step.type)
  console.log("  File:", step.fileToCreate ?? step.fileToEdit ?? "TBD")
  console.log("  Complexity:", step.estimatedComplexity)
  console.log("  Description:", step.description)
  if (step.notes) console.log("  Notes:", step.notes)
  if (step.dependsOn.length > 0) console.log("  Depends on steps:", step.dependsOn.join(", "))
})
```

4. Present the plan clearly to the user — each step with its file, type, and description.

5. Ask the user: "Ready to generate code for Step 1?"

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Do NOT start writing code yet — planning only
- Clean up `__temp_plan.ts` after running
