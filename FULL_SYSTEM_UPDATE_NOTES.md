# OceanBrown Creative Studio — Full System Update

This version focuses on making the system cleaner for real marketplace operations, especially vendor tracking and category-specific product management.

## Main upgrades

### Vendor product form
- Product add/edit screens are now controlled by the vendor shop profile.
- A fashion shop sees fashion fields such as size, fabric/material, colors and condition.
- An electronics shop sees model, condition, warranty, specifications and SKU fields.
- Furniture, food, beauty, agriculture, auto parts, books and jewellery all have their own subcategories and form fields.
- Vendors can only post products in the primary category or extra categories allowed in their vendor profile.
- The backend now enforces this on both product creation and product editing.

### Vendor profile
- Vendor profile now stores shop type, allowed extra categories, custom subcategories, logo, cover image, delivery zones, support contact, operating hours, payment information, registration details and internal notes.
- Profile data is used to control product forms and admin tracking.

### Product images
- Product add and edit support up to five images.
- First image is used as the main shopper product image.
- Image uploads are supported through the base64 upload endpoint and served from `/uploads`.

### Admin vendor tracking
- Added a new Admin → Vendor Tracking screen.
- Admin can track each vendor's category, verification status, product count, active products, low stock count, stock total, revenue, rating and profile completeness.
- Added filters for pending, approved, rejected, low stock and incomplete vendor profiles.

### Backend tracking
- `/api/admin/vendors` now returns product counts, active product counts, low stock counts, total stock, last product date, profile completeness score and profile health label.
- `/api/vendor/dashboard` now includes profile completeness and profile health.
- Product update route now validates allowed fields and protects category rules.

### Stability fixes kept
- Babel preset fix.
- Verification null safety fix.
- Admin products image helper fix.
- ProductCard mobile text rendering fix.
- Expo LAN script retained for phone testing.

## Run after extracting

```bash
npm install
npm run db:push
npm run db:seed
npm run server:dev
```

Then open another terminal:

```bash
npm run expo:dev
```

For real phones, keep `.env` using your laptop Wi-Fi IP:

```env
HOST=0.0.0.0
EXPO_PUBLIC_DOMAIN=http://YOUR-LAPTOP-IP:5000
```
