---
name: push-origin
description: Stage all changes, commit with a descriptive message, and push to origin (Krawma-Associates/Krawma-Renewal).
argument-hint: [optional commit message]
---

# Push to Origin

Stage all changes, create a commit, and push to the `origin` remote (Krawma-Associates/Krawma-Renewal).

## Instructions

1. Run `git status` to see all changed and untracked files.
2. Run `git diff` to review what changed.
3. Run `git log --oneline -3` to see recent commit message style.
4. If there are no changes, tell the user "Nothing to commit" and stop.
5. Stage all changes: `git add .`
6. If the user provided a commit message via $ARGUMENTS, use that. Otherwise, draft a concise commit message based on the diff — summarize the "why" not the "what".
7. Commit using a heredoc:
```bash
git commit -m "$(cat <<'EOF'
<commit message>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
8. Push to origin: `git push origin main`
9. Confirm success with the commit hash and remote URL.

## Important
- Never use `--force` or `--no-verify`
- Do not push if there are type errors — run `npx tsc --noEmit` first
- If push fails, show the error and ask the user what to do
