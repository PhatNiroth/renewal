# Krawma Renewal

Subscription & renewal management app. Runs at `dashboard.krawma.com/renewal`.

> Login is handled by `dashboard.krawma.com` — this app has no login page.

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL running on port **5436**

### 1. Install dependencies
```bash
npm install
```

### 2. Create the database
```bash
psql -U postgres -c "CREATE DATABASE krawma_renewal;"
```

### 3. Set up environment variables
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

Key values to update:
- `DATABASE_URL` — your local PostgreSQL connection string
- `NEXTAUTH_SECRET` — must match the value in `dashboard.krawma.com`'s `.env`
- `AUTH_SECRET` — same value as `NEXTAUTH_SECRET`

### 4. Create tables
```bash
npx prisma migrate deploy
```

### 5. Seed initial data
```bash
npx prisma db seed
```

This creates default accounts:
| Email | Password | Role |
|---|---|---|
| admin@company.com | admin123 | Admin |
| ops@company.com | ops123 | Operations |
| accounting@company.com | acc123 | Accounting |

### 6. Run the dev server
```bash
npm run dev
```

App runs at: http://localhost:3000/renewal

---

## Database Changes

When you change `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name describe_your_change
```
Then commit the generated files in `prisma/migrations/`.

---

## Useful Commands
```bash
npm run dev                 # Dev server
npm test                    # Run tests
npx tsc --noEmit            # Type check
npx prisma studio           # Browse database
npx prisma migrate dev      # New migration (after schema change)
npx prisma db seed          # Re-seed database
```
