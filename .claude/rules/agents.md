---
paths:
  - "agents/**"
---

# AI Agents Rules

## Client
- Never instantiate a new Anthropic client — always use the singleton: `import { anthropic } from "./lib/client"`
- Model: `claude-opus-4-6` for all agents

## Thinking
- Always use `thinking: { type: "adaptive" }` — never use `budget_tokens`

## Output
- All agent outputs must use Zod schemas via `zodOutputFormat()` — never raw strings
- Export all agents from `agents/index.ts`

## Money in Agents
- Pass monetary values as **cents** to agents
- Format to dollars only inside the agent prompt string: `$${(cost / 100).toFixed(2)}`

## Development Pipeline Order
When implementing a new feature with agents, always follow this order:
1. `planFeature()` — plan first
2. `generateCode()` — one step at a time
3. `reviewCode()` — must pass before continuing
4. `generateTests()` — write tests
5. `auditSecurity()` — mandatory for API routes / Server Actions
6. `generateDocs()` — last step
