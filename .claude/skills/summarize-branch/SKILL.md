---
name: summarize-branch
description: Summarize all changes on the current branch compared to main — what was added, changed, deleted, and whether it's ready to PR.
---

# Summarize Branch

Give a plain-English summary of all changes on the current branch.

## Instructions

1. Get the current branch and diff vs main:
```bash
git branch --show-current
git diff main...HEAD --stat
git log main..HEAD --oneline
git diff main...HEAD -- prisma/schema.prisma
```

2. Summarize:
   - **What changed** — list files grouped by area (API routes, actions, UI, DB, tests)
   - **What was added** — new features or files
   - **What was deleted** — removed features or files
   - **DB changes** — any Prisma schema or migration changes
   - **Test status** — are there tests for the changes?

3. Run a quick health check:
```bash
npx tsc --noEmit 2>&1 | tail -5
npm test 2>&1 | tail -5
```

4. Give a **PR readiness verdict**:
   - Ready — types clean, tests pass, changes are coherent
   - Needs work — list what's missing (tests, type errors, etc.)

5. Suggest a PR title based on the changes.

## Important
- Compares against `main` branch
- Does not push or create the PR — use `/push-origin` for that
