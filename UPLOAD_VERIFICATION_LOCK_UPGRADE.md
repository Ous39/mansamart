# Upload + Verified Vendor Lock Upgrade

## Fixed uploads
- Reworked the Expo upload helper so vendor logo, cover image, product images, and document/ID images all use the same safe upload pipeline.
- Upload route now accepts a `kind` value so files are saved with cleaner names.
- Vendor logo/cover uploads now immediately save to the backend instead of only updating local screen state.
- Product add/edit image upload uses the same fixed upload helper.
- Uploaded files are still served from `/uploads` and are resolved on mobile using `EXPO_PUBLIC_DOMAIN`.

## Vendor verification documents
Vendors can now upload documents/images for verification from Vendor Profile:
- Business Registration
- Owner ID
- Tax Document
- Shop License
- Bank Proof
- Other Document

Documents are stored in `vendor_profiles.documents` with type, URL, name, uploadedAt, and status.

## Verified vendor profile lock
When admin verifies a vendor:
- `verificationStatus` becomes `verified`
- `profileEditLocked` becomes `true`
- the vendor can no longer directly update their live profile

If a verified vendor edits their profile:
- changes are saved in `pendingProfileChanges`
- `profileChangeStatus` becomes `pending`
- admin can approve or reject the change request

## Admin review
Admin Verification screen now includes:
- normal vendor/provider verification requests
- verified vendor profile change requests

When admin approves a profile change, pending changes are applied to the live vendor profile.
