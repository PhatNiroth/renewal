/**
 * Feature Pipeline Agent
 *
 * Orchestrates the full development workflow for a new feature or edit:
 *   Plan → Generate → Review → Test → Audit → Document
 *
 * Runs each dev agent in sequence and returns a complete report.
 * If review fails (critical issues found), generation is retried once
 * with the review feedback attached. If security audit fails for an
 * API route or Server Action, the pipeline is halted at that step.
 *
 * Usage:
 *   const result = await runFeaturePipeline({
 *     request: "Add export to CSV button on the subscriptions page",
 *     type: "new",                  // "new" | "edit"
 *     affectedArea: "subscriptions",
 *   })
 *
 *   // Each step is in result.steps[] — check result.passed for overall status
 */

import { planFeature, type FeaturePlan, type PlanStep } from "./planner.agent"
import { generateCode, type GeneratedCode } from "./code-generator.agent"
import { reviewCode, type CodeReview } from "./code-review.agent"
import { generateTests, type GeneratedTests } from "./test-generator.agent"
import { auditSecurity, type SecurityAudit } from "./security-auditor.agent"
import { generateDocs, type GeneratedDocs } from "./documentation.agent"

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface FeaturePipelineInput {
  /** Plain-English description of the feature or change */
  request: string
  /** Whether this is a new feature or an edit to existing code */
  type: "new" | "edit"
  /** Affected area, e.g. "subscriptions", "vendors", "billing" */
  affectedArea?: string
  /** Existing code if editing — paste the current file contents */
  existingCode?: string
  /** Additional context — related files, constraints, etc. */
  context?: string
}

export type PipelineStepStatus = "pending" | "running" | "passed" | "failed" | "skipped"

export interface PipelineStepResult {
  stepNumber: number
  title: string
  filePath: string
  fileType: string
  status: PipelineStepStatus

  generated?: GeneratedCode
  review?: CodeReview
  reviewRetried: boolean
  tests?: GeneratedTests
  audit?: SecurityAudit
  docs?: GeneratedDocs

  /** Final code to write — after review, retry, and docs pass */
  finalCode?: string

  /** Why this step failed, if it did */
  failureReason?: string
}

export interface FeaturePipelineResult {
  /** Overall — true only if every step passed */
  passed: boolean
  plan: FeaturePlan
  steps: PipelineStepResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function needsSecurityAudit(filePath: string, fileType: string): boolean {
  return (
    filePath.startsWith("app/api/") ||
    filePath.startsWith("app/actions/") ||
    fileType === "api_route" ||
    fileType === "server_action"
  )
}

function securityFileType(
  fileType: string
): "api_route" | "server_action" | "middleware" | "lib" | "component" | "other" {
  if (fileType === "api_route")     return "api_route"
  if (fileType === "server_action") return "server_action"
  return "other"
}

// ─── Pipeline for one step ────────────────────────────────────────────────────

async function runStep(
  planStep: PlanStep,
  existingCode?: string,
  relatedContext?: string
): Promise<PipelineStepResult> {
  const filePath = planStep.fileToCreate ?? planStep.fileToEdit ?? "unknown"
  const result: PipelineStepResult = {
    stepNumber:   planStep.stepNumber,
    title:        planStep.title,
    filePath,
    fileType:     planStep.type,
    status:       "running",
    reviewRetried: false,
  }

  // ── 1. Generate ─────────────────────────────────────────────────────────────
  try {
    result.generated = await generateCode({
      task:         `${planStep.title}\n\n${planStep.description}`,
      fileType:     planStep.type,
      filePath,
      existingCode: planStep.fileToEdit ? existingCode : undefined,
      relatedCode:  relatedContext,
      requirements: planStep.notes ? [planStep.notes] : undefined,
    })
  } catch (err) {
    result.status = "failed"
    result.failureReason = `Code generation error: ${err instanceof Error ? err.message : String(err)}`
    return result
  }

  // ── 2. Review ────────────────────────────────────────────────────────────────
  try {
    result.review = await reviewCode({
      code:     result.generated.code,
      filename: filePath,
      context:  planStep.description,
    })
  } catch (err) {
    result.status = "failed"
    result.failureReason = `Code review error: ${err instanceof Error ? err.message : String(err)}`
    return result
  }

  // ── 3. Retry once if review found critical issues ────────────────────────────
  if (!result.review.approved) {
    result.reviewRetried = true
    const criticalFeedback = result.review.issues
      .filter(i => i.severity === "critical")
      .map(i => `- [${i.category}] ${i.title}: ${i.description}\n  Fix: ${i.suggestion}`)
      .join("\n")

    try {
      const retry = await generateCode({
        task:         `${planStep.title}\n\n${planStep.description}\n\nFix these critical issues from the review:\n${criticalFeedback}`,
        fileType:     planStep.type,
        filePath,
        existingCode: result.generated.code,
        relatedCode:  relatedContext,
      })
      result.generated = retry

      // Re-review
      result.review = await reviewCode({
        code:     retry.code,
        filename: filePath,
        context:  planStep.description,
      })
    } catch (err) {
      result.status = "failed"
      result.failureReason = `Retry generation error: ${err instanceof Error ? err.message : String(err)}`
      return result
    }

    if (!result.review.approved) {
      result.status = "failed"
      result.failureReason = `Code still has critical issues after retry: ${result.review.issues.filter(i => i.severity === "critical").map(i => i.title).join(", ")}`
      return result
    }
  }

  // ── 4. Generate Tests ────────────────────────────────────────────────────────
  try {
    result.tests = await generateTests({
      code:     result.generated.code,
      filename: filePath,
      context:  planStep.description,
    })
  } catch (err) {
    // Tests failing is a warning, not a hard stop
    result.tests = undefined
  }

  // ── 5. Security Audit (API routes and Server Actions only) ───────────────────
  if (needsSecurityAudit(filePath, planStep.type)) {
    try {
      result.audit = await auditSecurity({
        code:     result.generated.code,
        filename: filePath,
        fileType: securityFileType(planStep.type),
        context:  planStep.description,
      })
    } catch (err) {
      result.status = "failed"
      result.failureReason = `Security audit error: ${err instanceof Error ? err.message : String(err)}`
      return result
    }

    if (!result.audit.passed) {
      result.status = "failed"
      result.failureReason = `Security audit failed: ${result.audit.issues.filter(i => i.severity === "critical" || i.severity === "high").map(i => i.title).join(", ")}`
      return result
    }
  }

  // ── 6. Generate Docs ─────────────────────────────────────────────────────────
  try {
    result.docs = await generateDocs({
      code:       result.generated.code,
      filename:   filePath,
      context:    planStep.description,
    })
    result.finalCode = result.docs.documentedCode
  } catch {
    // Docs failing is non-fatal — use the reviewed code as final
    result.finalCode = result.generated.code
  }

  result.status = "passed"
  return result
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runFeaturePipeline(
  input: FeaturePipelineInput
): Promise<FeaturePipelineResult> {
  const { request, type, affectedArea, existingCode, context } = input

  // Step 0: Plan
  const plan = await planFeature({
    request: `[${type === "edit" ? "EDIT" : "NEW"}] ${request}`,
    affectedArea,
    context,
  })

  const stepResults: PipelineStepResult[] = []
  let pipelinePassed = true

  // Process each plan step in order
  for (const planStep of plan.steps) {
    // Skip steps that depend on a failed step
    const blockedBy = planStep.dependsOn.find(depNum =>
      stepResults.find(r => r.stepNumber === depNum && r.status === "failed")
    )

    if (blockedBy !== undefined) {
      stepResults.push({
        stepNumber:    planStep.stepNumber,
        title:         planStep.title,
        filePath:      planStep.fileToCreate ?? planStep.fileToEdit ?? "unknown",
        fileType:      planStep.type,
        status:        "skipped",
        reviewRetried: false,
        failureReason: `Skipped because step ${blockedBy} failed`,
      })
      pipelinePassed = false
      continue
    }

    const stepResult = await runStep(planStep, existingCode, context)
    stepResults.push(stepResult)

    if (stepResult.status === "failed") {
      pipelinePassed = false
    }
  }

  const passed  = stepResults.filter(s => s.status === "passed").length
  const failed  = stepResults.filter(s => s.status === "failed").length
  const skipped = stepResults.filter(s => s.status === "skipped").length

  return {
    passed: pipelinePassed,
    plan,
    steps: stepResults,
    summary: {
      total:   plan.steps.length,
      passed,
      failed,
      skipped,
    },
  }
}
