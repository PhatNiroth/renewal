/**
 * Agents — barrel export
 *
 * All AI agents for the internal subscription & renewal management system.
 * Each agent uses Claude Opus 4.6 with adaptive thinking.
 *
 * agents/
 * ├── business/   → subscription management agents (run automatically or on demand)
 * └── dev/        → development workflow agents (plan → generate → review → test → audit → document)
 */

// ─── Business Agents ─────────────────────────────────────────────────────────

// Generates internal staff notification emails for upcoming vendor renewals
export {
  generateRenewalEmail,
  type RenewalReminderInput,
  type RenewalEmail,
} from "./business/renewal-reminder.agent"

// Identifies company subscriptions at risk of expiring without action
export {
  detectExpiryRisk,
  type ExpiryAlertInput,
  type ExpiryAlertResult,
  type ExpiryAlertItem,
} from "./business/expiry-alert.agent"

// Surfaces cost optimization opportunities across the subscription portfolio
export {
  analyzeSpend,
  type SpendOptimizationInput,
  type SpendOptimizationReport,
  type SpendOpportunity,
  type SubscriptionPortfolioItem,
} from "./business/spend-optimization.agent"

// Conversational finance assistant for internal staff (tool use, streaming)
export {
  runBillingAssistant,
  streamBillingAssistant,
  type BillingAssistantInput,
  type BillingAssistantResult,
  type BillingContext,
  type PaymentRecord,
  type SubscriptionRecord,
} from "./business/billing-assistant.agent"

// Turns raw subscription metrics into plain-English procurement insights
export {
  generateAnalyticsSummary,
  type AnalyticsMetrics,
  type AnalyticsSummary,
} from "./business/analytics.agent"

// ─── Development Workflow Agents ─────────────────────────────────────────────

// Breaks a feature request into ordered coding steps
export {
  planFeature,
  type PlannerInput,
  type FeaturePlan,
  type PlanStep,
} from "./dev/planner.agent"

// Generates production-ready TypeScript code for a single task
export {
  generateCode,
  type CodeGeneratorInput,
  type GeneratedCode,
} from "./dev/code-generator.agent"

// Reviews TypeScript code for bugs, security issues, and improvements
export {
  reviewCode,
  type CodeReviewInput,
  type CodeReview,
  type CodeIssue,
} from "./dev/code-review.agent"

// Generates tests for reviewed and approved code
export {
  generateTests,
  type TestGeneratorInput,
  type GeneratedTests,
} from "./dev/test-generator.agent"

// Security-focused audit of API routes and Server Actions
export {
  auditSecurity,
  type SecurityAuditInput,
  type SecurityAudit,
  type SecurityIssue,
} from "./dev/security-auditor.agent"

// Adds JSDoc comments and documentation to approved code
export {
  generateDocs,
  type DocumentationInput,
  type GeneratedDocs,
} from "./dev/documentation.agent"
