# Local Dev Notes

## Database
- PostgreSQL runs on port **5436** (not default 5432)
- Connection: `postgresql://postgres@localhost:5436/krawma`
- Start DB check: `pg_lsclusters`

## Dev Server
- App runs at: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard
- Admin panel: http://localhost:3000/dashboard/admin

## Test Credentials (local seed)
- Admin: `admin@krawma.com` / `admin123`
- Ops user: `ops@krawma.com` / `ops123`
- Accounting: `acc@krawma.com` / `acc123`

## Common Local Commands
```bash
# Reset and reseed DB
npx prisma migrate reset --force && npx prisma db seed

# Run tests
npm test

# Type check only
npx tsc --noEmit

# Check DB connection
psql -h localhost -p 5436 -U postgres -c '\l'
```

## Notes
- Use `TEST_EMAIL_OVERRIDE` in `.env` to redirect all emails to yourself locally
- Telegram notifications only fire if `TELEGRAM_GROUP_CHAT_ID` is set
