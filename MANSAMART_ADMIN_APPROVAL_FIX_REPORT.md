# MansaMart Admin Approval + Navigation Fix v6

## Summary
This patch fixes the admin approval workflow and cleans the Expo navigation warnings reported during development.

## Fixed Issues

### 1. Admin rider approval was incomplete
The rider approval page only called `/api/admin/riders/:userId/verify`, while the main verification queue did not include riders and there was no `/api/admin/verify/rider/:userId` route.

Fixed by adding:
- Rider records to `/api/admin/verifications`
- Rider count to `/api/admin/verifications/count`
- New `/api/admin/verify/rider/:userId` endpoint
- Stronger `/api/admin/riders/:userId/verify` endpoint
- Proper rider/user verification synchronization
- Rider approval/rejection notifications
- Admin UI success/error alerts
- Query invalidation for riders, verifications, and counts

### 2. Vendor/provider approval hardening
The admin verification endpoints now return clear 404 responses if the vendor/provider profile is missing instead of silently returning empty results.

### 3. Verification queue now supports riders
The Admin Verification screen now has a Rider tab and can approve/reject riders from the same queue as vendors/providers/personal verification.

### 4. GO_BACK navigator warning fixed
The app was calling `router.back()` even when there was no previous screen in navigation history. This caused the Expo warning:

`The action 'GO_BACK' was not handled by any navigator.`

Fixed by adding `lib/navigation.ts` with `safeBack()` and replacing risky `router.back()` calls with a fallback route.

### 5. Expo ImagePicker deprecation warning fixed
Updated image upload picker options away from deprecated `ImagePicker.MediaTypeOptions`.

## Validation
- Ran `npm install --ignore-scripts --prefer-offline --no-audit --no-fund`
- Ran `npm run typecheck`
- TypeScript check completed successfully.

## Admin test path
1. Login as admin.
2. Open Admin Dashboard.
3. Go to Verifications.
4. Check Rider tab.
5. Approve/reject a rider.
6. Go to Delivery Riders.
7. Confirm rider status changes to verified/rejected.

## Notes
Existing users and database data are preserved. This patch does not rebuild the project and does not remove existing modules.
