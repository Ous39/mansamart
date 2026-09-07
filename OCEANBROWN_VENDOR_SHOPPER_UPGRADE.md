# OceanBrown Vendor + Shopper Upgrade

## New backend/database improvements

- One main `users` table remains the account table for every login.
- Role-specific profile tables now separate extra data:
  - `vendor_profiles`
  - `provider_profiles`
  - `delivery_riders`
  - `shopper_profiles`
- New registrations automatically create the correct profile row and wallet.
- Added mobile-friendly image upload endpoint:
  - `POST /api/uploads/base64`
  - Stores images inside `/uploads`
  - Returns a public image URL for product images, vendor logos, etc.
- Backend now serves uploaded files from `/uploads`.
- Backend JSON limit increased to 25MB for mobile image uploads.
- Backend default host changed to `0.0.0.0` for same-Wi-Fi phone testing.

## New vendor improvements

- Advanced Add Product screen:
  - Upload image from phone gallery
  - Add image URL manually
  - Up to 5 product images
  - Stock quantity
  - Location
  - Material
  - Dimensions
  - Weight
  - Colors
  - Features
  - Tags
  - New arrival / sale / featured / free shipping toggles
- New vendor dashboard API:
  - `GET /api/vendor/dashboard`
  - Revenue
  - Orders
  - Pending orders
  - Product count
  - Average rating
  - Low-stock alerts
  - Category breakdown
  - Recent orders
  - Recent products
- New low-stock route:
  - `GET /api/vendor/low-stock`
- New stock update route:
  - `PUT /api/vendor/products/:id/stock`

## New shopper improvements

- Added shopper profile table.
- Added shopper dashboard API:
  - `GET /api/shopper/me`
  - Returns orders, wishlist count, bookings, loyalty points and recent orders.
- Admin users screen now labels customer accounts as `Shopper` instead of only `User`.

## Important run commands

```bash
npm install
npm run db:push
npm run db:seed
npm run server:dev
```

For Expo LAN mode:

```bash
npm run expo:dev
```

The script now uses LAN mode instead of localhost.

## Phone testing reminder

Your `.env` should use your laptop Wi-Fi IP:

```env
HOST=0.0.0.0
PORT=5000
EXPO_PUBLIC_DOMAIN=http://YOUR-LAPTOP-IP:5000
```

After changing `.env`, restart backend and Expo.
