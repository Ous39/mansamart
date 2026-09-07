# OceanBrown Product Image & Shopper Viewing Upgrade

This version improves how products are uploaded and viewed on Android, iOS, and web.

## Added / improved

- Product cards now display the first uploaded product image.
- Product cards show a photo-count badge when a product has multiple images.
- Product cards show low-stock badges.
- Product detail page now has a large product image gallery.
- Product detail page now supports multiple thumbnails.
- Product detail page now shows richer shopper information:
  - stock status
  - rating and sold count
  - discount badge
  - vendor badge
  - quick info chips
  - colors
  - material, dimensions, weight, location, category, stock
  - features and tags
  - vendor store card
  - similar products
  - buy-now button
- Vendor edit product page now supports phone gallery image uploads, not only pasted URLs.
- Cart, wishlist, vendor products, and admin products now resolve uploaded images correctly.
- Added shared image URL resolver so `/uploads/...` images also work on real phones when the backend is running on your laptop IP.

## Important

When testing on phones, your `.env` must use your laptop Wi-Fi IP:

```env
HOST=0.0.0.0
EXPO_PUBLIC_DOMAIN=http://YOUR-LAPTOP-IP:5000
```

Then restart backend and Expo.
