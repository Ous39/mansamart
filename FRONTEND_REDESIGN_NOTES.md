# OceanBrown Creative Studio - Frontend Redesign Notes

This version fixes the mixed marketplace look and rebuilds the customer frontend around one consistent OceanBrown design system.

## Main changes

- Rebuilt the onboarding screen with a clean, scroll-safe studio welcome design.
- Rebuilt the customer home screen with a premium furniture/interior layout.
- Rebuilt the fixed header to remove the mixed ecommerce feel and use OceanBrown category labels.
- Rebuilt the browse screen filters, headings, category names, and product browsing experience.
- Rebuilt product cards with softer OceanBrown styling, better spacing, cleaner badges, and consistent price/rating layout.
- Kept backend/database/auth fixes from the previous version.
- The frontend now focuses on furniture, decor, lighting, storage, office, and interior services instead of showing a mixed general marketplace first.

## Tested

- TypeScript check passed with `npm run typecheck`.

## Run

```bash
npm install
npm run db:push
npm run db:seed
npm run server:dev
```

Second terminal:

```bash
npm run expo:dev
```
