---
name: GambiaMart React Query key convention
description: How array query keys map to API URLs in lib/query-client.ts
---

## Convention
queryKey elements are joined with "/" to form the full path:
- `["/api/products"]` → `GET /api/products`
- `["/api/products", id]` → `GET /api/products/{id}`
- `["/api/services/provider/mine"]` → `GET /api/services/provider/mine`

## Key routes
- `/api/products/vendor/mine` — vendor's own products
- `/api/services/provider/mine` — provider's own services
- `/api/admin/stats` — platform stats (admin only)
- `/api/cart` — user's cart (GET array of {cartItem, product})
- `/api/wishlist` — user's wishlist (GET array of {wishlistItem, product})

**Why:** Default queryFn in QueryClient uses `queryKey.join("/")` — never define custom queryFn per query, it won't pick up auth headers.
