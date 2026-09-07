---
name: GambiaMart full-stack architecture
description: Key patterns for the GambiaMart Expo + Express app's auth, data fetching, and context setup
---

## Auth
- JWT stored in AsyncStorage via `lib/auth-token.ts` (getToken() sync after loadToken())
- Token sent as `Authorization: Bearer <token>` header via `authHeaders()` in `lib/query-client.ts`
- Sessions table exists in DB but JWT pattern is used (not server sessions)

## Data Fetching
- All queries use default queryFn from `lib/query-client.ts` — DO NOT define queryFn in useQuery
- Array query keys join with "/" to form URL: `["/api/products", id]` → `/api/products/{id}`
- Mutations use `apiRequest(method, route, data)` from `lib/query-client.ts`
- CartContext/WishlistContext use apiCall helper (fire-and-forget) + AsyncStorage fallback

## Demo accounts (all at @gambiamart.com)
- admin/admin123, vendor/vendor123, provider/provider123, user/user123

## Roles
- "user", "vendor", "service_provider", "admin"

**Why:** Keeps all server state in React Query cache with 5-min stale time; AsyncStorage provides offline fallback for cart/wishlist.
