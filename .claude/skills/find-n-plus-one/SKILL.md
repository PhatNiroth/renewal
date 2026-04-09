---
name: find-n-plus-one
description: Scan the codebase for potential N+1 query issues — Prisma queries inside loops, missing includes, and repeated findUnique calls. No API key needed.
disable-model-invocation: true
---

# Find N+1 Queries

Scan the codebase for common Prisma N+1 query patterns that hurt performance.

## Instructions

### 1. Find Prisma queries inside loops
```bash
echo "=== N+1 QUERY SCANNER ==="
echo ""
echo "── PRISMA QUERIES INSIDE LOOPS ──"

# Find files with both a loop and a db. call
for file in $(find app lib -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v node_modules); do
  # Check if file has a loop construct AND a db query
  HAS_LOOP=$(grep -nE "for\s*\(|forEach\(|\.map\(|while\s*\(" "$file" 2>/dev/null)
  HAS_DB=$(grep -nE "await db\." "$file" 2>/dev/null)
  
  if [ -n "$HAS_LOOP" ] && [ -n "$HAS_DB" ]; then
    echo ""
    echo "⚠ POTENTIAL N+1: $file"
    echo "  Loops at lines:"
    echo "$HAS_LOOP" | head -5 | while read line; do echo "    $line"; done
    echo "  DB queries at lines:"
    echo "$HAS_DB" | head -5 | while read line; do echo "    $line"; done
  fi
done

echo ""
echo "── MISSING INCLUDES (relations loaded separately) ──"
# Find findMany/findFirst without include where related data is accessed
grep -rn "\.findMany\(\|\.findFirst\(" app/ lib/ 2>/dev/null | grep -v "include:" | grep -v "select:" | while read match; do
  echo "⚠ CHECK $match — no include/select, may cause N+1 if relations needed"
done | head -20
```

### 2. Find repeated findUnique on same model
```bash
echo ""
echo "── REPEATED findUnique CALLS ──"
for file in $(find app lib -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v node_modules); do
  # Count findUnique calls per file
  COUNT=$(grep -c "\.findUnique\(" "$file" 2>/dev/null || echo 0)
  if [ "$COUNT" -gt 2 ]; then
    echo "⚠ $file has $COUNT findUnique() calls — consider batching with findMany + in:"
  fi
done
```

### 3. Find missing select (fetching all columns when not needed)
```bash
echo ""
echo "── LARGE QUERIES WITHOUT select ──"
grep -rn "\.findMany({" app/ lib/ 2>/dev/null | grep -v "select:\|include:\|where:\|orderBy:" | while read match; do
  echo "⚠ CHECK $match — no select/where, may fetch entire table"
done | head -10
```

### 4. Check notification dispatcher and scheduler
```bash
echo ""
echo "── CHECKING KEY FILES ──"
for file in lib/notification-dispatcher.ts lib/scheduler.ts; do
  if [ -f "$file" ]; then
    LOOP_DB=$(grep -c "await db\." "$file" 2>/dev/null || echo 0)
    echo "  $file — $LOOP_DB db calls"
  fi
done
```

### 5. Summary
Report:
- Total files with potential N+1 issues
- Most critical ones to fix first
- Suggest using `findMany` with `in:` operator instead of looping `findUnique`
- Suggest adding `include:` to queries that access relations
