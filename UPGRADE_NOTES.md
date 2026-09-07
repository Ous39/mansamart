# OceanBrown Creative Studio Upgrade Notes

## Completed

- Local API URL handling fixed for `http://127.0.0.1:5000`.
- Old marketplace branding replaced with OceanBrown / OceanBrown Creative Studio.
- Local backend, Expo, database push, seed, and type-check scripts added.
- Demo login accounts added for admin, vendor, service provider, delivery rider, and customer.
- App configuration updated for the OceanBrown package/scheme.

## Recommended next checks

1. Create the PostgreSQL database.
2. Run `npm install`.
3. Run `npm run db:push`.
4. Run `npm run db:seed`.
5. Run `npm run server:dev`.
6. Run `npm run expo:dev` in another terminal.
7. Test account login and account creation from the app.

## Frontend redesign refresh

This version restores a clean, consistent furniture/interior-design style based on the visual direction originally provided:

- Minimal OceanBrown Creative Studio branding
- Calm teal, cream, brown accent palette
- Clean onboarding screen with furniture/interior positioning
- Simplified header, search, category pills and trust strip
- Redesigned home screen with furniture hero, browse-by-space section, interior consultation panel and clean product sections
- Removed colorful mixed-marketplace look from the main customer UI
- Updated category labels toward furniture, decor, office, lighting, storage and delivery
