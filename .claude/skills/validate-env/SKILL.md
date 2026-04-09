---
name: validate-env
description: Check that all required environment variables are set in .env and none are placeholders. Run this before starting dev or deploying.
disable-model-invocation: true
---

# Validate Environment Variables

Check that all required `.env` variables are set and valid.

## Instructions

Run the following checks:

### 1. Check required variables exist and are not placeholders
```bash
echo "=== ENV VALIDATION ==="

check_var() {
  local key=$1
  local value=$(grep "^${key}=" .env 2>/dev/null | cut -d'=' -f2-)
  
  if [ -z "$value" ]; then
    echo "✗ MISSING   $key"
  elif echo "$value" | grep -qiE "placeholder|changeme|your_|xxx|sk-ant-placeholder|re_placeholder|whsec_placeholder|pk_test_placeholder|sk_test_placeholder"; then
    echo "⚠ PLACEHOLDER $key = $value"
  else
    # Show only first 8 chars for secrets
    short="${value:0:8}..."
    echo "✓ SET       $key = $short"
  fi
}

# Database
echo ""
echo "── DATABASE ──"
check_var "DATABASE_URL"

# Auth
echo ""
echo "── AUTH ──"
check_var "NEXTAUTH_SECRET"
check_var "NEXTAUTH_URL"

# Stripe
echo ""
echo "── STRIPE ──"
check_var "STRIPE_SECRET_KEY"
check_var "STRIPE_PUBLISHABLE_KEY"
check_var "STRIPE_WEBHOOK_SECRET"

# Email
echo ""
echo "── EMAIL ──"
check_var "RESEND_API_KEY"
check_var "EMAIL_FROM"

# AI
echo ""
echo "── AI ──"
check_var "ANTHROPIC_API_KEY"

# App
echo ""
echo "── APP ──"
check_var "NEXT_PUBLIC_APP_URL"
check_var "CRON_SECRET"
check_var "TEST_EMAIL_OVERRIDE"
```

### 2. Check DATABASE_URL points to port 5436
```bash
echo ""
echo "── DB PORT CHECK ──"
DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
if echo "$DB_URL" | grep -q "5436"; then
  echo "✓ DATABASE_URL uses correct port 5436"
else
  echo "⚠ DATABASE_URL does not use port 5436 — expected for this project"
fi
```

### 3. Validate Prisma can connect
```bash
echo ""
echo "── PRISMA CONNECTION ──"
npx prisma db execute --stdin <<'SQL' 2>&1 && echo "✓ Database connection OK" || echo "✗ Database connection FAILED"
SELECT 1;
SQL
```

### 4. Summary
After all checks, summarize:
- How many variables are missing
- How many are still placeholders
- Whether the database is reachable
- What needs to be fixed before the app will work
