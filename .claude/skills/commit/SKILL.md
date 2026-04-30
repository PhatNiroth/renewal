name: commit
description: Stage all changes with git add . then commit with an auto-generated message describing what was changed or added.
argument-hint: [optional short note to include in the commit message]
---

# Auto Commit

Stage all changes and commit with a generated message based on what actually changed.

## Instructions

1. Check current git status to see what changed:
```bash
git status --short
```

2. If there is nothing to commit (clean working tree), tell the user and stop.

3. Get a diff summary to understand what changed:
```bash
git diff --stat HEAD
git diff --cached --stat
```

4. Also check untracked files:
```bash
git ls-files --others --exclude-standard
```

5. Based on the changed files, generate a short, clear commit message that:
   - Starts with a verb: `add`, `update`, `fix`, `remove`, `improve`
   - Describes WHAT changed — e.g. `add /commit skill`, `update favicon to match sidebar logo`, `fix subscription date validation`
   - If $ARGUMENTS is provided, incorporate it as context
   - Keep it under 72 characters
   - No ticket numbers, no "WIP", no vague messages like "update files"

6. Stage all changes:
```bash
git add .
```

7. Commit with the generated message:
```bash
git commit -m "<generated message>"
```

8. Confirm to the user: show the commit hash and message.

## Message format examples
- `add automated tests for API routes and lib utilities`
- `update favicon to match sidebar logo using primary color`
- `fix cron notifications auth guard`
- `remove deprecated payment method routes`
- `improve subscription form validation for CUSTOM billing cycle`

## Important
- Never use `--no-verify`
- If the commit hook fails, report the error and stop — do not retry with `--no-verify`
- Do not push — just commit locally
