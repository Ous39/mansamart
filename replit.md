# MansaMart

A full-featured Gambian general marketplace + services app with multi-role system. Sells every product category (fashion, electronics, food, beauty, furniture, sports, baby, agri, auto, books, jewellery). Built with Expo Router, React Native, and Express backend. Currency: GMD (Dalasi, prefix "D").

## Architecture

- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express.js on port 5000
- **State**: AsyncStorage for local persistence, React Context for cart/wishlist/auth/bookings
- **Styling**: React Native StyleSheet with consistent design tokens

## Color Theme (SHEIN-inspired)

- Primary: `#0EA47A` (teal green)
- Primary Light: `#E6FAF3`
- Deal/Sale: `#E63946` (red)
- Background: `#F7F8FA`
- Text: `#1A1A2E`
- Accent: `#E8813A` (orange)
- Vendor: `#2563EB` (blue)
- Provider: `#7B4FA3` (purple)
- Admin: `#0F172A` (dark navy)

## Currency

All prices displayed in GMD (Gambian Dalasi) with "D" prefix (e.g. "D 2,500").

## User Roles

- **User (Shopper)**: Browse/buy products, book services, manage wishlist & bookings
- **Vendor**: Sell products, manage inventory, view orders and revenue
- **Service Provider**: Offer home services, manage bookings, accept/complete jobs
- **Admin**: Full platform management — users, products, services, orders

## Demo Accounts

- Admin: admin@mansamart.com / admin123
- Vendor: vendor@mansamart.com / vendor123
- Service Provider: provider@mansamart.com / provider123

## App Structure

```
app/
  index.tsx              # Onboarding / welcome screen
  _layout.tsx            # Root layout with providers
  (auth)/
    login.tsx            # Login screen
    register.tsx         # 2-step role selection register (Shopper/Vendor/Provider)
    forgot-password.tsx  # Forgot password
  (tabs)/
    _layout.tsx          # 5-tab layout (NativeTabs on iOS 26+, classic fallback)
    index.tsx            # Home screen (SHEIN-style: banners, flash deals, grid)
    browse.tsx           # Browse/search all products
    services.tsx         # Browse services marketplace
    wishlist.tsx         # Wishlist + Bookings (tabbed)
    profile.tsx          # Profile with role-specific dashboard banners + menus
  product/[id].tsx       # Product detail
  service/[id].tsx       # Service detail + date/time booking flow
  cart.tsx               # Shopping cart
  checkout.tsx           # Checkout (Wave, Afrimoney, Orange Money, Ecobank)
  order-confirmed.tsx    # Order confirmation
  (vendor)/
    index.tsx            # Vendor dashboard (revenue in GMD, stats, recent orders)
    products.tsx         # Manage products list
    add-product.tsx      # Add new product form
    orders.tsx           # Incoming orders with accept/decline
  (provider)/
    index.tsx            # Provider dashboard (earnings in GMD, bookings)
    services.tsx         # Manage services list
    add-service.tsx      # Add new service form
    bookings.tsx         # Manage bookings (confirm/start/complete)
  (admin)/
    index.tsx            # Admin dashboard (full platform stats, activity feed)
    users.tsx            # Manage all users (search, filter by role, change role)
    products.tsx         # All products management
    services.tsx         # All services management
    orders.tsx           # All orders (products + services combined)
```

## Data

- `data/products.ts` — 34+ products across 11 categories with GMD prices
- `data/services.ts` — 6 home services with categories and booking types
- `assets/images/products/` — product images + app icon
- Products without images use `placeholderColor` + `placeholderIcon` for colored icon placeholder

## Contexts

- `AuthContext` — user auth, role management, all users list (admin)
- `CartContext` — cart items, totals
- `WishlistContext` — saved products
- `BookingContext` — service bookings CRUD

## Key Features

- Multi-role registration (2-step: choose role → fill details)
- 5-tab navigation always visible for all roles
- SHEIN-style home: hero banner carousel, category grid, flash deals countdown, 2-col product grid
- Fixed/sticky header with MansaMart branding, location picker, search bar
- Gambia-local payment methods: Wave, Afrimoney, Orange Money, Ecobank/GTBank
- Role-specific dashboard banners on Profile tab
- Services marketplace with booking flow (date/time picker, address, notes)
- Wishlist + Bookings combined in Saved tab
- Vendor Dashboard: GMD revenue stats, product management, order management
- Service Provider Dashboard: GMD earnings, booking management
- Admin Panel: platform stats, user role management, product/service/order oversight
