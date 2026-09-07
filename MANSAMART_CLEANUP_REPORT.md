# MansaMart Cleanup Report

## Why this version was created

The previous working archive still contained mixed source labels from the previous studio brand, the previous marketplace label, and old furniture-first demo notes. This cleanup keeps the working codebase but aligns the project direction with the requested MansaMart marketplace ecosystem.

## What was corrected

- Replaced visible legacy brand labels with MansaMart across the active source code.
- Removed old furniture-only upgrade notes from the project root.
- Removed stale `.agents` memory files from the deliverable.
- Updated onboarding, header, cart, admin, settings, product fallback text, and notification copy.
- Kept the current working Expo Router + Express + PostgreSQL + Drizzle architecture.
- Preserved the legacy database role value `user` for shopper accounts to avoid breaking existing data.
- Added backend registration compatibility so external role value `shopper` maps safely to the existing `user` enum.
- Kept the health endpoint, location foundation, rider dashboard foundation, QR/escrow/tracking routes, and Socket.IO realtime foundation.
- Removed `.env` from the archive so local database credentials are not bundled. Use `.env.example` or keep your existing local `.env`.

## Important compatibility note

The UI says Shopper, but the database still stores shoppers as `user`. This is intentional because changing the PostgreSQL enum immediately can break existing data and APIs. A future migration can rename `user` to `shopper` safely after production planning.

## Recommended next work

1. Finish Phase 1 QA with real device tests on iOS and Android.
2. Complete rider delivery screens beyond the dashboard placeholder pages.
3. Add production push notification provider setup for Expo/EAS.
4. Add admin VPN/network restriction middleware at deployment level.
5. Add proper payment provider integration for Gambian wallets/banks.
6. Add full CRM/CLM web portal views and lifecycle automation.
