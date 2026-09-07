# Auth/Login/Register Fix

This build adds an automatic database compatibility check on server startup.

Why this was needed:
- The app code was upgraded with new fields such as latitude, longitude, escrow_status, qr_code, profile locks, wallet fields, and tracking tables.
- If PostgreSQL still had the older schema, login/register could fail with errors like `column "latitude" does not exist` or other missing-column errors.

What changed:
- Added `server/startup-migrations.ts`.
- `server/index.ts` now runs `await runStartupMigrations()` before registering API routes.
- The migration safely uses `ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS`, so it can run many times.
- Removed the stale `patches/expo-asset+12.0.12.patch` file that caused `npm install` postinstall errors when `expo-asset` patch target was not present.

Still recommended:
```powershell
npm run db:push
npm run server:dev
```

If you test on a real phone, make sure `.env` uses your laptop LAN IP:
```env
HOST=0.0.0.0
PORT=5000
EXPO_PUBLIC_DOMAIN=http://YOUR-LAPTOP-IP:5000
```
