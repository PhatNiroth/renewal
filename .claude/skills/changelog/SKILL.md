---
name: changelog
description: Auto-generate a plain-English changelog from recent git commits. Groups changes by type — features, fixes, removals, and maintenance.
argument-hint: [number of commits or date range, e.g. "20" or "since 2026-04-01"]
---

# Changelog

Generate a readable changelog from recent commits.

## Instructions

1. Get the scope from arguments (default: last 20 commits): $ARGUMENTS

2. Fetch commit history:
```bash
git log --oneline -20 --no-merges
```
If a date is provided in $ARGUMENTS, use `--since="<date>"` instead.

3. For each commit, categorize as:
   - **Feature** — new functionality added
   - **Fix** — bug fix
   - **Removed** — feature or file deleted
   - **DB** — schema or migration change
   - **Maintenance** — refactor, cleanup, dependency update, test, docs

4. Output a clean grouped changelog:

```
## Changelog — [date range]

### Features
- ...

### Fixes
- ...

### Removed
- ...

### DB Changes
- ...

### Maintenance
- ...
```

5. Keep each entry to one line — plain English, no jargon.

## Important
- Based on commit messages — quality depends on commit message quality
- Does not write to a file unless user asks
