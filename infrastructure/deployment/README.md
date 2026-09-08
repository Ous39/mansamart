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
```

TLS certificates must be enabled before public launch. The included Nginx file defines the domain separation; use Certbot or the hosting provider's managed TLS to add HTTPS.
