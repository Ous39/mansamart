# MansaMart Role Routing Fix Report

## Issue fixed
Vendor, Service Provider, Rider, and Admin accounts were being sent to the Shopper tab area after login, registration PIN setup, PIN verification, and app restart.

The backend role could be saved correctly, but the frontend was using `router.replace("/(tabs)")` for every authenticated account. In this app, `/(tabs)` is the Shopper area, so every role looked like a Shopper after authentication.

## Files changed

- `lib/role-routing.ts`
  - Added a single role-to-dashboard helper.
  - Shopper / legacy `user` goes to `/(tabs)`.
  - Vendor goes to `/(vendor)`.
  - Service Provider goes to `/(provider)`.
  - Rider goes to `/(rider)`.
  - Admin goes to `/(admin)`.

- `app/index.tsx`
  - On app restart, authenticated users now go to the correct role dashboard.

- `app/(auth)/login.tsx`
  - Login now redirects users according to their real role.

- `app/pin-setup.tsx`
  - After creating or skipping PIN setup, users now go to their correct role dashboard.

- `app/pin-entry.tsx`
  - After PIN verification, users now go to their correct role dashboard.

- `contexts/AuthContext.tsx`
  - Login now returns both `hasPin` and the logged-in `user`, so the login screen can route correctly immediately.

- `server/routes.ts`
  - Role normalization is now safer.
  - Only `shopper`, `customer`, `buyer`, or `user` map to the legacy DB role `user`.
  - `vendor` stays vendor.
  - `provider` maps to `service_provider`.
  - `rider` maps to `delivery_rider`.
  - Admin role updates now create the proper default profile after changing a user's role.
  - Admin accounts no longer accidentally create shopper profiles through the default profile helper.

## Validation

`npm run typecheck` completed successfully after installing dependencies.

## Important note about existing test accounts

If you already created vendor/provider/rider accounts while the bug existed, check their stored database role.

Run this in PostgreSQL:

```sql
SELECT id, name, email, role, business_name, business_type, created_at
FROM users
ORDER BY created_at DESC;
```

If an account is wrongly stored as `user`, update it manually:

```sql
UPDATE users SET role = 'vendor' WHERE email = 'vendor@example.com';
UPDATE users SET role = 'service_provider' WHERE email = 'provider@example.com';
UPDATE users SET role = 'delivery_rider' WHERE email = 'rider@example.com';
```

After updating a role manually, log in as Admin and open/edit that user once, or use the Admin role editor. The patched Admin role editor will create the missing vendor/provider/rider profile automatically.
