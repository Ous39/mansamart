# MansaMart v7 — Order Tracking, Rider Panel, Maps, Scan Order & Role Guard Fix

## Summary
This patch continues the existing MansaMart project without rebuilding it. It focuses on the issues reported after v6:

- Rider accounts still reaching shopper screens/profile.
- Rider dashboard/profile not feeling complete like vendor/provider panels.
- Admin/vendor/rider order workflow needing tracking, QR verification, maps, and notifications.
- Scan order action needing to be visible beside search.
- Delivery vs pickup workflow needing clearer control.

## Major Fixes

### 1. Rider no longer opens shopper panel
Added route guards for all role panels:

- Shopper tabs only allow `user` accounts.
- Vendor panel only allows `vendor` accounts.
- Provider panel only allows `service_provider` accounts.
- Rider panel only allows `delivery_rider` accounts.
- Admin panel only allows `admin` accounts.

Also added backend role reconciliation so old accounts that were saved as `user` but already have a rider/vendor/provider profile are corrected on login or `/api/auth/me`.

### 2. Rider dashboard upgraded
The rider dashboard now includes:

- Verification status.
- Online/available control.
- Delivery offers.
- Active deliveries.
- Earnings summary.
- Rating/performance cards.
- Map/navigation cards for vendor pickup and shopper drop-off.
- Scan Order button.
- Profile & verification shortcut.

### 3. Order tracking improved
The order detail screen now includes:

- Improved status timeline.
- Live tracking event history.
- Vendor/pickup map card.
- Shopper/drop-off map card.
- Latest rider GPS card.
- Rider “Mark On The Way” action.
- QR verification card showing pickup/delivery codes.

### 4. Maps and navigation foundation
Added a reusable `MapPreviewCard` and map helper utilities.

Supported behavior:

- Open Apple Maps on iOS.
- Open Google Maps web/navigation URLs on Android/web-compatible environments.
- Show vendor, shopper, and rider coordinates when available.

### 5. Scan Order moved beside search
The header scan icon beside search now says **Scan Order** and opens `/scan-order`.

The Scan Order screen verifies QR values through:

`POST /api/orders/verify-qr`

### 6. QR verification workflow improved
Added generic QR verification backend route:

`POST /api/orders/verify-qr`

Supported QR purposes:

- `pickup`: Vendor or assigned rider confirms Vendor → Rider handover.
- `delivery`: Shopper or admin confirms Rider → Shopper delivery.

QR codes are marked as used after verification to prevent reuse.

### 7. Vendor order workflow improved
Vendor Orders now supports:

- Track order.
- Confirm order.
- Mark ready for pickup/delivery.
- Dispatch rider.
- Cancel pending/paid order.

Fixed the frontend status update method from `PATCH` to `PUT` to match the backend route.

### 8. Rider dispatch improved
When a rider accepts a delivery request:

- The first rider gets assigned.
- Other offered riders are notified that the delivery was already assigned.
- Order status changes to `rider_assigned`.
- Delivery status changes to `assigned`.
- Tracking event and notifications are created.

### 9. Real-time notification improvements
Notification context now connects to Socket.IO and invalidates order/rider queries when real-time notifications arrive.

Events supported:

- `notification:new`
- `order:tracking`
- `rider:location`

### 10. Incomplete registration reminder
Vendors, riders, and providers now get an in-app reminder if their profile is incomplete after 24 hours. The reminder can repeat every 10 minutes while they are using the app.

The reminder opens the correct role-specific profile page.

## Important Notes

- This patch does not remove existing functionality.
- It preserves the legacy shopper role mapping where the database role `user` means shopper.
- It keeps backward compatibility with existing accounts.
- It does not add new native dependencies, so no extra Expo install is required.
- Camera-based barcode scanning can be added later with `expo-camera`, but this patch uses a safe QR text verification flow to avoid breaking installs.

## Run Instructions

Keep your local `.env`, then run:

```powershell
npm install
npm run dev:server
```

In another PowerShell window:

```powershell
npx expo start --lan -c
```

## Recommended Test Flow

1. Login as rider and confirm it opens the Rider Panel, not Shopper tabs.
2. Open Rider Profile and confirm it has full rider verification/profile fields.
3. Login as shopper, place an order, choose pickup or delivery.
4. Login as vendor, open Orders, confirm order, mark ready, dispatch rider.
5. Login as rider, go online, accept the delivery request.
6. Use Scan Order to verify pickup/delivery QR values.
7. Check order detail to confirm tracking timeline and maps update.
8. Login as admin and open Orders/Verifications to confirm full visibility.
