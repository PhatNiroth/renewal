---
name: check-db-sync
description: Verify Prisma schema matches the database. Detects missing migrations, schema drift, and unapplied changes. Run before deploying.
disable-model-invocation: true
---

# Check Database Sync

Verify the Prisma schema is in sync with the actual database state.

## Instructions

### 1. Validate schema file syntax
```bash
echo "=== DATABASE SYNC CHECK ==="
echo ""
echo "── SCHEMA VALIDATION ──"
npx prisma validate 2>&1 && echo "✓ Schema syntax is valid" || echo "✗ Schema has syntax errors — fix before continuing"
```

### 2. Check for pending migrations
```bash
echo ""
echo "── PENDING MIGRATIONS ──"
MIGRATE_STATUS=$(npx prisma migrate status 2>&1)
echo "$MIGRATE_STATUS"

if echo "$MIGRATE_STATUS" | grep -q "Database schema is up to date"; then
  echo ""
  echo "✓ Database is up to date — no pending migrations"
elif echo "$MIGRATE_STATUS" | grep -q "Following migration"; then
  echo ""
  echo "⚠ There are unapplied migrations. Run: npx prisma migrate deploy"
fi
```

### 3. Check migration history
```bash
echo ""
echo "── MIGRATION HISTORY ──"
MIGRATION_DIR="prisma/migrations"
if [ -d "$MIGRATION_DIR" ]; then
  MIGRATIONS=$(ls -1 "$MIGRATION_DIR" | grep -v migration_lock | sort)
  COUNT=$(echo "$MIGRATIONS" | grep -c . || echo 0)
  echo "Total migrations: $COUNT"
  echo ""
  echo "$MIGRATIONS" | while read migration; do
    if [ -n "$migration" ]; then
      SIZE=$(wc -l < "$MIGRATION_DIR/$migration/migration.sql" 2>/dev/null || echo "?")
      echo "  • $migration ($SIZE lines)"
    fi
  done
else
  echo "No migrations directory found"
fi
```

### 4. Check if Prisma client is up to date
```bash
echo ""
echo "── PRISMA CLIENT ──"
npx prisma generate --dry-run 2>&1 | head -5
echo ""
echo "Run 'npx prisma generate' if schema changed recently"
```

### 5. Quick DB connection test
```bash
echo ""
echo "── CONNECTION TEST ──"
npx prisma db execute --stdin 2>&1 <<'SQL' && echo "✓ Connected to database successfully" || echo "✗ Cannot connect — check DATABASE_URL in .env"
SELECT current_database(), current_user, version();
SQL
```

### 6. Summary
Based on the results above, report:
- Whether the DB is in sync with the schema
- Any migrations that need to be run
- Whether `npx prisma generate` needs to be run
- Next steps if anything is out of sync
