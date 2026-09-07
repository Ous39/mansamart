# OceanBrown Vendor Category/Profile Upgrade

This upgrade makes vendor product posting depend on the vendor's shop profile.

## New behavior

- A vendor sets a primary shop category in Vendor Profile.
- The Add Product screen changes dynamically based on that category.
- Example: Fashion vendors see size/fabric/style fields; Electronics vendors see model/warranty/specification fields.
- Vendors can add extra allowed categories from their profile.
- Backend protects the rule: vendors cannot post products outside their profile category unless admin/allowed categories permit it.

## Added vendor profile tracking fields

- shopCategory
- allowedCategories
- subcategories
- logo and coverImage upload
- operatingHours
- deliveryZones
- supportPhone and supportEmail
- minOrderAmount
- businessRegistrationNo and taxNumber
- payment tracking: bank/mobile-money details
- internalNotes for admin tracking

## Added product fields

- productType
- sku
- modelNumber
- size
- condition
- warranty
- specs JSON

Run after extracting:

```bash
npm install
npm run db:push
npm run db:seed
npm run server:dev
```

Then:

```bash
npm run expo:dev
```
