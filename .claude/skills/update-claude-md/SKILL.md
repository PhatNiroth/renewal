---
name: update-claude-md
description: Update CLAUDE.md with new rules, decisions, or conventions learned during this session. Appends or edits sections without removing existing content.
argument-hint: <what to add or update>
---

# Update CLAUDE.md

Update the project's `CLAUDE.md` with new rules, decisions, or notes from the user.

## Instructions

1. Read the update request from arguments: $ARGUMENTS

2. Read the current `CLAUDE.md` to understand existing content and structure.

3. Decide the best placement:
   - If it's a new rule → add to **Key Rules** section
   - If it's a tech stack change → update the **Tech Stack** table
   - If it's a workflow note → add to **Before Finishing Any Task** or **Development Commands**
   - If it doesn't fit existing sections → add a new section at the bottom

4. Edit `CLAUDE.md` with the new content. Do NOT remove or rewrite existing content — only add or update the relevant section.

5. Confirm to the user: what was added, and where.

## Important
- Keep entries concise — one line per rule where possible
- Match the existing tone and formatting style
- Never delete existing rules unless the user explicitly says to remove something
