# MansaMart Platform

MansaMart is a Gambian marketplace platform organized as independently deployable applications backed by one modular API and PostgreSQL database.

## Applications

| Workspace | Audience | Development port | Production target |
|---|---|---:|---|
| `apps/customer-mobile` | Customers | 8081 | iOS and Android |
| `apps/business-mobile` | Vendors and service providers | 8082 | iOS and Android |
| `apps/rider-mobile` | Delivery riders | 8083 | iOS and Android |
| `apps/web` | General marketplace and non-admin accounts | 4173 | `mansamart.gm` |
| `apps/admin-web` | Administrators only | 4174 | `admin.mansamart.gm` |
| `apps/api` | Shared backend | 5000 | `api.mansamart.gm` |

Administrator credentials are deliberately rejected by the general web and mobile login endpoint. The administrator application uses `/api/admin/auth/login`, has an eight-hour session, applies login rate limiting, and has no registration screen.

## Shared packages

- `@mansamart/database` — Drizzle schema and migrations
- `@mansamart/shared-types` — cross-application TypeScript contracts
- `@mansamart/api-client` — browser API client and application identity headers
- `@mansamart/authentication` — role routing and session storage helpers
- `@mansamart/design-system` — common brand tokens and responsive layout rules
- `@mansamart/validation` — shared validation schemas
- `@mansamart/business-logic` — marketplace calculations and rules

Role-specific screens remain inside their corresponding application. Shared packages contain only logic that truly must remain consistent across the platform.

## Requirements

- Node.js 22.13 or later
- pnpm 11
- PostgreSQL 16, or Docker Desktop

## Install

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm db:seed
```

Run the API and both web applications:

```bash
pnpm dev
```

Run a mobile application separately:

```bash
pnpm dev:customer
pnpm dev:business
pnpm dev:rider
```

When using a physical phone, copy the relevant application's `.env.example` to `.env` and replace `YOUR-LAPTOP-IP` with the computer's Wi-Fi IP address.

### Windows one-click Customer app launcher

For one menu that can open any MansaMart application, start every Docker service, or run the complete verification suite, double-click:

```text
run-mansamart.bat
```

The individual launchers below remain available when you want to open one application directly.

Install Node.js 22.13 or later, Docker Desktop, and Expo Go on the phone. Start Docker Desktop, then double-click:

```text
run-customer.bat
```

Choose option 1 to run the app on a physical phone or option 2 to open it in a browser. The launcher installs the exact pnpm dependencies, starts PostgreSQL and the API in Docker, applies the database schema, loads development seed data, waits for the API health check, and starts the Customer Expo application. For phone testing, keep the phone and computer on the same Wi-Fi and scan the displayed QR code using Expo Go.

Use option 3 when you want to stop the local PostgreSQL and API containers. Their database volume is preserved. Wave remains disabled by the provided development environment.

### Windows one-click Business app launcher

After installing Node.js 22.13+, Docker Desktop, and Expo Go, start Docker Desktop and double-click:

```text
run-business.bat
```

Choose option 1 for a physical Android or iPhone on the same Wi-Fi, or option 2 for a browser preview. The launcher installs locked dependencies, starts PostgreSQL and the API, applies the current schema, loads development seed accounts, waits for the health check, and runs the Business app on port 8082.

### Windows one-click Rider app launcher

After installing Node.js 22.13+, Docker Desktop, and Expo Go, start Docker Desktop and double-click:

```text
run-rider.bat
```

Choose option 1 for a physical Android or iPhone on the same Wi-Fi, or option 2 for a browser preview. The launcher installs locked dependencies, starts PostgreSQL and the API, waits for the health check, and runs the dedicated Rider app on port 8083. Rider location sharing is foreground-only: it runs while an accepted delivery is open and the app remains active.

### Windows one-click Website launcher

After installing Node.js 22.13+ and Docker Desktop, start Docker Desktop and double-click:

```text
run-web.bat
```

Choose option 1 to install the locked dependencies, start PostgreSQL and the API, load the development data, wait for the API health check, and open the general marketplace at `http://localhost:4173`. Choose option 2 to stop the local containers while preserving the database volume.

### Windows one-click Administrator launcher

Start Docker Desktop and double-click:

```text
run-admin.bat
```

The launcher starts PostgreSQL and the API, then opens the isolated administrator portal at `http://localhost:4174`. Development MFA is off by default. To test the complete two-step login locally, configure SMTP and `ADMIN_MFA_PEPPER`, then set `ADMIN_MFA_REQUIRED=true` in `.env.docker`.

## Docker

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker -f infrastructure/docker-compose.yml up --build
```

Local addresses:

- API health: `http://localhost:5000/api/health`
- Marketplace web: `http://localhost:4173`
- Administrator web: `http://localhost:4174`
- Customer Expo: `http://localhost:8081`
- Business Expo: `http://localhost:8082`
- Rider Expo: `http://localhost:8083`

## Verification

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm audit --prod --audit-level critical
```

On Windows, double-click `audit-all.bat` to install the locked dependency graph and run type-checking, tests, lint, builds, and the critical-vulnerability gate in order. GitHub Actions runs the same checks for pull requests and the protected development branches.

The complete audit currently reports two high-severity denial-of-service advisories in Expo Metro's transitive `image-size` build dependency. Forcing the patched `image-size` 2.0.3 release breaks Expo Router asset compilation, so it is not overridden. This package runs in the development/build toolchain rather than the API runtime; keep repository asset changes reviewed and upgrade Expo/Metro when it adopts the compatible patched release.

## Responsive device support

All five user interfaces are designed to reflow from compact 280–360 px phones through standard phones, tablets, landscape orientation, laptops, desktops, and wide displays. The three Expo applications use shared live-width breakpoints rather than a one-time screen measurement, allow device rotation, center their content on large browser previews, and change product/service grids between one and four columns. Forms, dashboard metrics, action rows, delivery maps, and navigation controls wrap instead of overflowing.

The marketplace and administrator websites add compact-phone layouts, horizontally scrollable data tables, dynamic-height dialogs, safe map sizing, wide-screen content caps, landscape handling, and reduced-motion support. Automated responsive-rule tests cover representative widths of 280, 390, 768, 1024, and 1920 pixels. Before each store release, still verify the native builds on at least one small Android phone, one modern iPhone, one Android tablet, and one iPad because operating-system font scaling and safe areas cannot be fully reproduced by browser exports.

## Customer mobile milestone

The customer application includes customer-only registration and login, marketplace browsing, product options, an account-specific offline cart and wishlist, saved delivery addresses, server-priced checkout, Wave handoff, order history and tracking, service booking, verified-purchase reviews, seven-day return/refund requests, notifications, support tickets, profile security, and in-app policy links.

For an existing PostgreSQL deployment, apply `packages/database/migrations/customer_experience_migration.sql` before deploying this customer release. It adds return requests, product-option cart fields, and duplicate-protection indexes. New installations can use `pnpm db:push`.

## General web milestone

The website includes public product and service discovery, search and filtering, detail pages, customer cart and server-priced Wave checkout, order and delivery tracking, bookings, notifications, support, vendor and service-provider dashboards, catalogue controls, finance and payout requests, returns, and rider delivery operations. Each authenticated account is routed to its own role area. Administrator sessions are rejected by the general authentication endpoint and the website sends administrators to the separate secured portal.

## Production authentication and notifications

Customer, Business, and Rider now support password login, passwordless phone OTP, Google identity tokens, Apple Sign in, secure native token storage, active-device review, session revocation, Expo push registration, notification deep links, and per-category push preferences. The general website supports password and phone OTP login plus the same session and preference controls. Administrator authentication remains isolated and never accepts phone or social login.

The API enforces these controls:

- OTP codes are HMAC-hashed, expire in ten minutes, allow five attempts, have a resend cooldown, and are consumed atomically.
- Development codes are returned only when `NODE_ENV` is not production and `PHONE_OTP_DEV_EXPOSE_CODE=true`.
- Google and Apple authentication accepts only signed ID tokens. The API verifies the provider issuer, exact client-ID audience, expiry, signing key, signature, optional nonce, and one-time token use.
- Sessions contain an application audience, device metadata, last-seen time, expiry, and revocation time. A session cannot cross from one MansaMart app to another.
- Expo push tokens belong to the authenticated user and app audience. Promotions are off by default; every in-app notification remains available even when its push category is disabled.

Apply the migration to an existing database:

```bash
psql "$DATABASE_URL" -f packages/database/migrations/0010_auth_notifications_production.sql
```

For a local OTP demonstration on Windows, copy `.env.docker.example` to `.env.docker`, set a long `PHONE_OTP_PEPPER`, then set `PHONE_OTP_ENABLED=true` and `PHONE_OTP_DEV_EXPOSE_CODE=true`. Start the desired application with `run-mansamart.bat` or its individual `.bat` launcher. The code is displayed only in the local UI. Production must set `PHONE_OTP_DEV_EXPOSE_CODE=false` and configure `SMS_PROVIDER_URL`, `SMS_PROVIDER_TOKEN`, and `SMS_SENDER_ID`.

Google sign-in requires OAuth client IDs restricted to each package/bundle identifier. Put every accepted client ID in the server-only `GOOGLE_CLIENT_IDS` allowlist and the matching public client ID in the mobile app environment. Apple client IDs belong in `APPLE_CLIENT_IDS`. Never put provider secrets in `EXPO_PUBLIC_*` variables.

Native Google/Apple sign-in and remote push notifications require a development or store build rather than relying on Expo Go. Run `eas init` for each mobile workspace so `extra.eas.projectId` is present, configure the iOS/Android push credentials in EAS, and test on a physical device. The `.bat` launchers still provide web and basic Expo previews; use an EAS development build for the complete authentication and push flow.

## Delivery maps and live tracking

The delivery flow now carries one verified map context from checkout through dispatch and delivery:

1. A customer can save a GPS pin with an address or select and drag the delivery pin during checkout.
2. The API stores the order's delivery coordinates and never substitutes a coordinate supplied by another order.
3. After every seller marks its items ready, a seller can dispatch the nearest verified available riders from the Business app.
4. The Rider app shows pickup and drop-off pins, distance and estimated travel time, and queues location samples while the network is unavailable.
5. The Customer app shows only the assigned rider's location for that delivery, with stale/offline status, remaining distance and ETA.
6. The Admin portal's **Live Map** section shows active deliveries and opens each rider or destination in Google Maps.

Location samples include their device recording time. The API rejects samples older than 24 hours or more than five minutes in the future, isolates samples by delivery, and prevents concurrent dispatch requests from creating two active deliveries for one order.

For an existing PostgreSQL deployment, apply:

```bash
psql "$DATABASE_URL" -f packages/database/migrations/delivery_maps_migration.sql
```

For native Customer builds configure `GOOGLE_MAPS_CUSTOMER_ANDROID_API_KEY` and `GOOGLE_MAPS_CUSTOMER_IOS_API_KEY`. For native Rider builds configure `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY`. Restrict every key in Google Cloud to the matching package/bundle ID (`gm.mansamart.customer` or `gm.mansamart.rider`) and enable only the required Android/iOS Maps SDK. Do not commit real keys. Written addresses and external Google Maps links remain available if a native map key is not configured.

## Wave Checkout

The customer app and API include a server-side Wave Checkout integration. It is deliberately disabled by default because production activation requires a Wave Business wallet, Checkout API permission, an API key, separate signing secrets, webhook registration, and written confirmation that the wallet accepts `GMD` checkout sessions.

The payment flow is:

1. The API reloads product prices and calculates the order total; client-submitted prices are ignored.
2. The API creates a Wave Checkout Session and returns only its safe launch URL.
3. The mobile app opens the Wave URL in the external browser.
4. `POST /api/webhooks/wave` verifies Wave's HMAC-SHA256 signature against the untouched request body.
5. The order becomes paid only after the webhook's session, reference, amount, currency and status match the stored payment attempt.

Configure the server with the empty placeholders documented in `.env.example`. Never expose Wave secrets through `EXPO_PUBLIC_*` or `VITE_*` variables. Register this production webhook in the Wave Business Portal:

```text
https://api.mansamart.gm/api/webhooks/wave
```

Set both `WAVE_ENABLED=true` and `WAVE_GMD_CONFIRMED=true` only after Wave confirms GMD support. The admin finance screen lists payment attempts and the API supports full Wave refunds with an audited administrator endpoint.

## WhatsApp Commerce

The MansaMart Business app now contains a WhatsApp Sales command centre. Vendors can register a WhatsApp Business number, sync their existing MansaMart catalogue, control AI and human handoff, review conversations and carts, and prepare opt-in campaigns. The first 50,000 AI tokens are created for each vendor account.

The public webhook endpoints are:

```text
GET  https://api.mansamart.gm/api/webhooks/whatsapp
POST https://api.mansamart.gm/api/webhooks/whatsapp
```

Apply `packages/database/migrations/whatsapp_commerce_migration.sql` before enabling the module. Configure `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` on the API server. Webhook payloads are rejected unless their Meta HMAC signature is valid. Keep `WHATSAPP_ENABLED=false` until the Meta Business app, WhatsApp Business Account and production phone number are approved.

## Production security checklist

- Serve every domain over HTTPS.
- Set exact `CORS_ORIGINS` and `ADMIN_CORS_ORIGINS` values.
- Replace all seed/demo passwords before production.
- Disable `SEED_ON_START`.
- Use managed object storage for uploads.
- Add a licensed payment provider before treating wallet entries as real funds.
- Configure SMTP and a long random `ADMIN_MFA_PEPPER`. The API always requires administrator email MFA when `NODE_ENV=production`; production administrator login fails closed if MFA delivery is not configured.
- Store secrets outside Git and rotate them regularly.

Apply `packages/database/migrations/full_system_audit_migration.sql` to an existing database before deploying this audited release. It scopes sessions to their source application, adds password-reset and administrator-MFA challenges, prevents duplicate helpful votes and profile-completion rows, and adds checkout/refund race-condition constraints.

The detailed engineering and security review is in `docs/FULL_SYSTEM_AUDIT.md`.

Deployment and Nginx examples are in `infrastructure/`.
