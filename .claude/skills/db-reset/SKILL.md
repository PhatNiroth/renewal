---
name: db-reset
description: Reset the database and reseed with fresh data. Runs prisma migrate reset --force then prisma db seed.
---

# DB Reset

Reset the database and reseed with fresh test data.

## Instructions

1. Warn the user before proceeding:
   > "This will wipe ALL data in the local database and reseed from scratch. Continue? (yes/no)"

2. Wait for confirmation. If no, stop.

3. Run the reset:
```bash
npx prisma migrate reset --force
```

4. Run the seed:
```bash
npx prisma db seed
```

5. Confirm success and summarize what was seeded (users, subscriptions, vendors, etc.)

## Important
- Only for LOCAL development — never run on production
- Requires PostgreSQL running on port 5436
- Seed credentials after reset: admin@krawma.com / admin123, ops@krawma.com / ops123
