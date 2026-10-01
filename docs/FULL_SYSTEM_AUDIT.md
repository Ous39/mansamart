# MansaMart Full-System Audit

Audit date: 2026-09-29
Audit branch: `codex/full-system-audit-v2`

## Scope

This review covers the Customer, Business, Rider, general Web and Administrator applications; the shared Express API; PostgreSQL schema and migrations; Wave payment boundaries; WhatsApp commerce integration; real-time Socket.IO access; Docker/Nginx configuration; Windows launchers; dependency security; and repository hygiene.

The audit branch combines the latest published progressive application work through `codex/rider-mobile-v1` with the separate `codex/whatsapp-commerce` branch. The merge is preserved as a local commit before the audit changes.

## Application access matrix

| Application audience | Permitted roles |
|---|---|
| Customer mobile | `user` |
| Business mobile | `vendor`, `service_provider` |
| Rider mobile | `delivery_rider` |
| General web | Every non-administrator role |
| Administrator web | `admin` only |

Sessions are stored as SHA-256 token digests and include the issuing application audience. Protected HTTP and Socket.IO requests must present the same audience, and the role must be permitted for it. The normal login endpoint rejects administrators; the administrator endpoint rejects non-administrators and non-admin origins.

## Remediations completed

### Authentication and administrator security

- Replaced raw stored bearer tokens with SHA-256 session digests.
- Bound sessions to Customer, Business, Rider, Web or Admin audiences.
- Invalidated legacy unscoped/plaintext sessions in the migration.
- Added real, single-use, 30-minute password reset tokens and SMTP delivery.
- Added authentication throttling and eight-hour administrator sessions.
- Added production-mandatory administrator email MFA with 10-minute, single-use, HMAC-protected codes and a five-attempt limit.
- Added reauthentication for role changes, user deletion, payout completion and Wave refunds.
- Prevented deleting the current administrator or the final administrator account.
- Expanded immutable audit events for privileged financial and administrator actions.

### Authorization and privacy

- Removed administrators from normal vendor, provider, rider, customer and QR operational routes; administrator data is served from dedicated `/api/admin/*` endpoints.
- Added ownership checks for orders, bookings, products, services, deliveries, support requests and real-time rooms.
- Restricted live Socket.IO rooms to actual order and delivery participants.
- Removed payout, banking, identity-document and internal-review fields from public business profiles.
- Removed QR secrets from general order responses and limited visible codes by participant role.
- Changed review helpful votes to one atomic vote per customer.

### Commerce, payments and inventory

- Calculates order totals, product snapshots and delivery fees on the server.
- Aggregates duplicate cart lines before validating inventory.
- Keeps Wave disabled unless both platform activation and explicit GMD confirmation are present.
- Verifies Wave signatures against the exact raw body and rejects replayed events.
- Locks orders, payments and products while completing a payment.
- Decrements inventory only after a valid completed Wave event.
- Marks captured duplicate or out-of-stock payments as requiring a refund.
- Allows one active Wave checkout and one full provider refund per payment attempt at the database layer.
- Requires administrator password confirmation and an audit reason for refunds.
- Keeps internal wallet funding and wallet order payments disabled unless explicitly enabled.

### Uploads, database and runtime safety

- Limits API bodies and base64 images, validates JPEG/PNG/WebP magic bytes, uses random filenames and writes with restrictive permissions.
- Removed runtime uploads, environment files and internal agent-memory files from source control.
- Added explicit PostgreSQL TLS controls and removed credential examples from database errors.
- Made profile-completion checks a real upsert with one row per user.
- Limited rider location collection to foreground delivery use.
- Added strict Nginx limits, admin login/MFA throttling and no-store caching for authentication/payment responses.

### Developer workflow

- Added `run-admin.bat`, `run-mansamart.bat` and `audit-all.bat`.
- Added GitHub Actions checks for install, type-check, test, lint, build and critical dependency advisories.
- Pinned patched transitive dependency releases and regenerated the pnpm lockfile.
- Added the idempotent `full_system_audit_migration.sql` for existing deployments.

## Verification gates

The release is accepted only when all of these commands pass from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm audit --prod --audit-level critical
git diff --check
```

Automated coverage includes role/audience isolation, customer rules, seller fulfillment, booking transitions, review eligibility, returns, rider availability and delivery transitions, QR checkpoints, escrow release, Wave request/webhook security, session token storage, upload validation, administrator MFA, and general-web role routing.

Results from the final local verification:

| Gate | Result |
|---|---|
| Locked pnpm install | Passed across 14 workspaces |
| TypeScript | Passed across every configured workspace |
| Automated tests | 34 passed: 30 API and 4 Web |
| Configured Expo lint | Passed with zero errors and zero warnings |
| Production builds | API, database package, Web, Admin, Customer, Business and Rider passed |
| Critical dependency gate | Passed; no critical advisories |
| Git diff and manifest syntax | Passed |
| Common committed-secret scan | Passed |
| Tracked environment/internal/upload artifacts | None found |

The full dependency report contains two high-severity denial-of-service advisories for Expo Metro's transitive `image-size` build dependency and no critical advisories. The patched `image-size` 2.0.3 release was tested and rejected because it breaks Expo Router PNG compilation. It is not used by the API image-upload path, which has its own byte-level allowlist and size limit. Until Expo/Metro accepts a compatible patched version, asset changes from untrusted contributors must not be built without review.

Docker, PostgreSQL and Windows are not installed in the audit runner. Therefore Docker Compose startup, applying the SQL migration to a live database, the `.bat` launchers, real SMTP delivery and live Wave/Meta provider calls require staging validation. The scripts, JSON/YAML manifests and batch label targets were checked statically.

## Required deployment work

The code audit cannot replace production-provider approval or an infrastructure penetration test. Before launch:

1. Apply `packages/database/migrations/full_system_audit_migration.sql` to a backed-up staging database and then production through the normal migration process.
2. Store database, SMTP, MFA, Wave and WhatsApp secrets in the deployment secret manager—never in Git.
3. Configure SMTP and a strong `ADMIN_MFA_PEPPER`; test successful, expired, reused and five-times-invalid administrator codes.
4. Keep Wave off until Wave has approved the wallet, supplied API credentials and confirmed GMD Checkout. Test signed webhooks and refunds in the provider environment.
5. Keep WhatsApp off until Meta has approved the app, business account and phone number. Register and test the signed production webhook.
6. Replace development seed accounts/passwords, disable `SEED_ON_START`, configure managed object storage, backups, monitoring and alerting.
7. Deploy to staging, perform browser/device workflow testing for every role, and commission an independent security test before processing real payments or personal documents.

For higher-assurance administrator access, TOTP or WebAuthn can later replace email as the second factor without changing the separate admin-audience boundary.
