# MansaMart deployment

Build the two web applications independently and deploy their output to separate virtual hosts:

```bash
pnpm --filter @mansamart/web build
pnpm --filter @mansamart/admin-web build
pnpm --filter @mansamart/api build
```

- `apps/web/dist` → `/var/www/mansamart/web` → `mansamart.gm`
- `apps/admin-web/dist` → `/var/www/mansamart/admin` → `admin.mansamart.gm`
- `apps/api/dist` → API service → `api.mansamart.gm`

Set production API variables:

```env
NODE_ENV=production
PUBLIC_API_URL=https://api.mansamart.gm
CORS_ORIGINS=https://mansamart.gm,https://www.mansamart.gm,https://admin.mansamart.gm
ADMIN_CORS_ORIGINS=https://admin.mansamart.gm
WAVE_ENABLED=false
WAVE_GMD_CONFIRMED=false
WAVE_API_BASE_URL=https://api.wave.com
WAVE_API_KEY=
WAVE_REQUEST_SIGNING_SECRET=
WAVE_WEBHOOK_SECRET=
WAVE_CURRENCY=GMD
WAVE_SUCCESS_URL=https://mansamart.gm/payment/wave/success
WAVE_ERROR_URL=https://mansamart.gm/payment/wave/error
```

TLS certificates must be enabled before public launch. The included Nginx file defines the domain separation; use Certbot or the hosting provider's managed TLS to add HTTPS.

Keep Wave disabled until its secrets are injected through the production secret manager and Wave confirms GMD Checkout support for the connected business wallet. Register `https://api.mansamart.gm/api/webhooks/wave` with a Wave signing secret. The API verifies the raw request body and rejects signatures older than five minutes.
