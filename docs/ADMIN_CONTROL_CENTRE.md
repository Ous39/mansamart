# MansaMart Admin Control Centre

The administrator application is isolated at `admin.mansamart.gm`. Administrator accounts cannot authenticate through the public web or mobile applications. Production administrator sign-in requires password verification followed by a short-lived email MFA code.

## Staff roles

The control centre supports `super_admin`, `operations_manager`, `finance_officer`, `verification_officer`, `rider_coordinator`, `support_agent`, `content_moderator`, and read-only `auditor` roles. Each role receives least-privilege permissions. A super administrator can grant additional listed permissions to a staff profile. Permission failures return HTTP 403 and are written to the audit trail.

Existing administrator accounts without an access profile are treated as super administrators for backward compatibility. Create explicit staff profiles before inviting additional administrators.

## Protected operations

- User suspension immediately revokes every active session. Suspended accounts are rejected during password login, MFA completion, token authentication, and optional authentication.
- Staff access changes, account suspension, role changes, platform setting changes, payouts and refunds require server-side authorization. Sensitive changes also require the administrator's current password.
- Verification decisions, support cases, returns, operational incidents, payouts and configuration changes create audit records.
- The last administrator cannot be deleted or demoted, and administrators cannot suspend themselves.

## Platform settings

Only predefined non-sensitive settings can be changed through the portal. Secret values and provider credentials must remain in the server environment. Wave and WhatsApp remain disabled until the relevant provider approvals and production checks are complete.

## Migration

Apply `packages/database/migrations/admin_control_centre_migration.sql` after the existing migrations. It adds account status fields, administrator access profiles, platform settings and operational incidents. The migration is idempotent and seeds safe disabled defaults for Wave and WhatsApp.
