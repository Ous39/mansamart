# Order Tracking, Rider Dispatch, QR and Escrow Upgrade

This package extends the existing app without rebuilding it.

## Added
- Full order tracking events API for shopper, vendor, rider, and admin.
- QR code payload generation per order.
- Vendor/rider pickup QR verification endpoint.
- Shopper/rider delivery QR verification endpoint.
- Escrow payment hold and release flow.
- Automatic settlement to vendor and rider wallets after delivery confirmation.
- Rider dashboard API with offers, active deliveries, history, earnings, and profile completion checks.
- Rider live location endpoint.
- Admin live orders endpoint.
- Pickup vs home delivery option in checkout.
- Better rider dashboard with earnings, completion warnings, and Google Maps buttons.
- Order detail screen now shows QR payload and live tracking events.

## Required after download
Run:

```powershell
npm install
npm run db:push
```

If PostgreSQL enum/table changes are not fully applied, run the manual SQL file:

```text
scripts/order_tracking_qr_escrow_migration.sql
```

Then restart:

```powershell
npm run server:dev
npx expo start -c
```

## Important flow
1. Shopper places order.
2. Payment is confirmed and held in escrow.
3. Vendor confirms and marks order ready.
4. Rider dispatch sends offers to nearby riders.
5. First rider accepts.
6. QR confirms pickup.
7. QR confirms delivery.
8. Escrow releases vendor earning, rider fee, and records commission/settlement.
