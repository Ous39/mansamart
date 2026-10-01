# MansaMart Admin Operations Suite

This release extends the Admin Control Centre with production operations workflows.

## Capabilities

- Live dashboard metrics and an action centre for delayed deliveries, payment exceptions, overdue disputes and critical incidents.
- Embedded Google Maps rider positions, with last-known/offline status retained by the existing delivery API.
- Structured disputes linked to an order or booking, evidence attachments, deadlines, internal/public case messages, assignment and typed resolutions.
- Document-level verification review for customer, vendor, provider and rider documents. Review actions are audited and notify the account holder.
- Support ownership, first-response/resolution timestamps, private notes and customer-visible responses.
- Payment/order/refund reconciliation with explicit mismatch reasons.
- Permission-protected UTF-8 CSV reports for users, orders and payments. Spreadsheet-formula prefixes are neutralized during export.
- API/database and external integration readiness checks that never return credentials.

## Database migration

Apply migrations in this order:

1. `admin_control_centre_migration.sql`
2. `admin_operations_suite_migration.sql`

Both are idempotent. Back up the production database and test the migrations on staging first.

## External configuration

The map uses the Google Maps embedded web surface for coordinates already provided by the rider app. The API health screen reports whether server integrations are configured, but never exposes environment values. Wave and WhatsApp must remain disabled until their production approvals are complete.
