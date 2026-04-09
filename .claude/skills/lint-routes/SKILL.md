---
name: lint-routes
description: Scan all API routes and Server Actions for missing auth checks, missing revalidatePath(), unvalidated inputs, and other common issues. No API key needed.
disable-model-invocation: true
---

# Lint Routes

Scan all API routes (`app/api/`) and Server Actions (`app/actions/`) for common issues.

## Instructions

### 1. Find all target files
```bash
echo "=== ROUTE LINTER ==="
echo ""
API_FILES=$(find app/api -name "route.ts" 2>/dev/null)
ACTION_FILES=$(find app/actions -name "*.ts" 2>/dev/null)
echo "API routes found:    $(echo "$API_FILES" | grep -c . || echo 0)"
echo "Server actions found: $(echo "$ACTION_FILES" | grep -c . || echo 0)"
```

### 2. Check API routes for missing auth
```bash
echo ""
echo "── MISSING AUTH CHECK (API routes) ──"
for file in $API_FILES; do
  # Check if file has auth() call
  if ! grep -q "auth()" "$file" 2>/dev/null; then
    # Check if it's a public route (plans, webhooks)
    if echo "$file" | grep -qE "webhooks|plans"; then
      echo "○ PUBLIC    $file (intentionally public)"
    else
      echo "⚠ NO AUTH   $file"
    fi
  else
    echo "✓ AUTH OK   $file"
  fi
done
```

### 3. Check Server Actions for missing auth
```bash
echo ""
echo "── MISSING AUTH CHECK (Server Actions) ──"
for file in $ACTION_FILES; do
  if grep -q "use server" "$file" 2>/dev/null; then
    if ! grep -q "auth()" "$file" 2>/dev/null; then
      echo "⚠ NO AUTH   $file"
    else
      echo "✓ AUTH OK   $file"
    fi
  fi
done
```

### 4. Check Server Actions for missing revalidatePath
```bash
echo ""
echo "── MISSING revalidatePath (Server Actions) ──"
for file in $ACTION_FILES; do
  # Only check files that do DB writes (create/update/delete/upsert)
  if grep -qE "db\.(.*)\.(create|update|delete|upsert|deleteMany|updateMany)" "$file" 2>/dev/null; then
    if ! grep -q "revalidatePath" "$file" 2>/dev/null; then
      echo "⚠ MISSING   $file — has DB writes but no revalidatePath()"
    else
      echo "✓ OK        $file"
    fi
  fi
done
```

### 5. Check API routes returning raw errors
```bash
echo ""
echo "── RAW ERROR EXPOSURE (API routes) ──"
for file in $API_FILES; do
  if grep -q "err.message\|error.message\|JSON.stringify(err\|JSON.stringify(error" "$file" 2>/dev/null; then
    echo "⚠ CHECK     $file — may expose internal error details in response"
  fi
done
```

### 6. Check for new PrismaClient() instances
```bash
echo ""
echo "── PRISMA SINGLETON CHECK ──"
PRISMA_VIOLATIONS=$(grep -rn "new PrismaClient()" app/ lib/ agents/ 2>/dev/null | grep -v "lib/db.ts")
if [ -z "$PRISMA_VIOLATIONS" ]; then
  echo "✓ No rogue PrismaClient() instances found"
else
  echo "✗ Found new PrismaClient() outside lib/db.ts:"
  echo "$PRISMA_VIOLATIONS"
fi
```

### 7. Check middleware imports
```bash
echo ""
echo "── MIDDLEWARE EDGE-SAFETY CHECK ──"
if [ -f "middleware.ts" ]; then
  if grep -qE "from.*lib/auth|from.*lib/db|bcrypt" "middleware.ts" 2>/dev/null; then
    echo "✗ UNSAFE    middleware.ts imports Prisma/bcrypt — will crash on Edge Runtime"
  else
    echo "✓ SAFE      middleware.ts has no Node.js-only imports"
  fi
fi
```

### 8. Summary
Print a final count of issues found and what to fix.
