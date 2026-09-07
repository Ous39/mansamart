# Auth Login/Register Fix Notes

This package adds stronger auth compatibility fixes for older local PostgreSQL databases.

## What was changed

1. Added startup migrations for auth-critical tables and columns:
   - `sessions`
   - `notifications`
   - `vendor_profiles`
   - `provider_profiles`
   - `delivery_riders`
   - user/profile/location columns

2. Removed `expo/fetch` imports from auth/query files and uses the normal React Native/global `fetch`.

3. Added clearer network error messages showing:
   - API base URL
   - full request URL
   - original error

4. Added diagnostics endpoints:
   - `GET /api/health`
   - `GET /api/debug/env`

## Required steps

Run these in order:

```powershell
npm install
npm run db:push
npm run server:dev
npx expo start -c
```

## Test backend from browser

Open from laptop:

```text
http://127.0.0.1:5000/api/health
```

Open from phone using your laptop LAN IP:

```text
http://YOUR-LAPTOP-IP:5000/api/health
```

If phone cannot open that URL, the app cannot login/register because the phone cannot reach the backend.

## Test registration directly from PowerShell

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/auth/register" `
-Method POST `
-ContentType "application/json" `
-Body '{"name":"Test User","email":"testuser123@gmail.com","password":"test1234","phone":"1234567","role":"user"}'
```

If this returns a token and user, backend auth is working. Any remaining issue is the phone API URL/network.
