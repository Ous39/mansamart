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
- `@mansamart/design-system` — common brand tokens
- `@mansamart/validation` — shared validation schemas
- `@mansamart/business-logic` — marketplace calculations and rules

Role-specific screens remain inside their corresponding application. Shared packages contain only logic that truly must remain consistent across the platform.

## Requirements

- Node.js 20 or later
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

Install Node.js 20 or later, Docker Desktop, and Expo Go on the phone. Start Docker Desktop, then double-click:

```text
run-customer.bat
```

Choose option 1 to run the app on a physical phone or option 2 to open it in a browser. The launcher installs the exact pnpm dependencies, starts PostgreSQL and the API in Docker, applies the database schema, loads development seed data, waits for the API health check, and starts the Customer Expo application. For phone testing, keep the phone and computer on the same Wi-Fi and scan the displayed QR code using Expo Go.

Use option 3 when you want to stop the local PostgreSQL and API containers. Their database volume is preserved. Wave remains disabled by the provided development environment.

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
pnpm build
```

## Customer mobile milestone

The customer application includes customer-only registration and login, marketplace browsing, product options, an account-specific offline cart and wishlist, saved delivery addresses, server-priced checkout, Wave handoff, order history and tracking, service booking, verified-purchase reviews, seven-day return/refund requests, notifications, support tickets, profile security, and in-app policy links.

For an existing PostgreSQL deployment, apply `packages/database/migrations/customer_experience_migration.sql` before deploying this customer release. It adds return requests, product-option cart fields, and duplicate-protection indexes. New installations can use `pnpm db:push`.

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

## Production security checklist

- Serve every domain over HTTPS.
- Set exact `CORS_ORIGINS` and `ADMIN_CORS_ORIGINS` values.
- Replace all seed/demo passwords before production.
- Disable `SEED_ON_START`.
- Use managed object storage for uploads.
- Add a licensed payment provider before treating wallet entries as real funds.
- Enable administrator multi-factor authentication before public launch.
- Store secrets outside Git and rotate them regularly.

Deployment and Nginx examples are in `infrastructure/`.
