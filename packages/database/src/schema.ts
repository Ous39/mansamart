import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, integer, boolean,
  timestamp, real, jsonb, pgEnum, uniqueIndex
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["user", "vendor", "service_provider", "delivery_rider", "admin"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending", "paid", "confirmed", "processing", "preparing", "ready_for_pickup",
  "searching_rider", "rider_searching", "rider_assigned", "rider_arrived_vendor",
  "picked_up", "on_the_way", "shipped", "delivered", "completed", "cancelled", "refunded"
]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  region: text("region"),
  area: text("area"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  locationAccuracy: real("location_accuracy"),
  gender: text("gender"),
  dateOfBirth: text("date_of_birth"),
  role: roleEnum("role").notNull().default("user"),
  businessName: text("business_name"),
  businessType: text("business_type"),
  bio: text("bio"),
  pin: text("pin"),
  avatar: text("avatar"),
  nationalId: text("national_id"),
  personalDocuments: jsonb("personal_documents").$type<{ type: string; url: string; name: string; uploadedAt?: string; status?: string }[]>().default([]),
  verificationStatus: text("verification_status").notNull().default("not_submitted"),
  isVerified: boolean("is_verified").notNull().default(false),
  profileEditLocked: boolean("profile_edit_locked").notNull().default(false),
  profileChangeStatus: text("profile_change_status").notNull().default("none"),
  pendingProfileChanges: jsonb("pending_profile_changes").$type<Record<string, any>>().default({}),
  profileChangeNote: text("profile_change_note"),
  profileChangeRequestedAt: timestamp("profile_change_requested_at"),
  profileChangeReviewedAt: timestamp("profile_change_reviewed_at"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  originalPrice: integer("original_price"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  productType: text("product_type"),
  sku: text("sku"),
  modelNumber: text("model_number"),
  size: text("size"),
  condition: text("condition"),
  warranty: text("warranty"),
  specs: jsonb("specs").$type<Record<string, string>>().default({}),
  images: jsonb("images").$type<string[]>().default([]),
  colors: jsonb("colors").$type<string[]>().default([]),
  features: jsonb("features").$type<string[]>().default([]),
  tags: jsonb("tags").$type<string[]>().default([]),
  material: text("material"),
  dimensions: text("dimensions"),
  weight: text("weight"),
  location: text("location").default("Banjul"),
  area: text("area"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  stock: integer("stock").notNull().default(100),
  inStock: boolean("in_stock").notNull().default(true),
  isSale: boolean("is_sale").notNull().default(false),
  isNew: boolean("is_new").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  freeShipping: boolean("free_shipping").notNull().default(false),
  soldCount: integer("sold_count").notNull().default(0),
  rating: real("rating").notNull().default(4.5),
  reviewCount: integer("review_count").notNull().default(0),
  vendorId: varchar("vendor_id").references(() => users.id, { onDelete: "set null" }),
  placeholderColor: text("placeholder_color"),
  placeholderIcon: text("placeholder_icon"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  priceType: text("price_type").notNull().default("fixed"),
  category: text("category").notNull(),
  duration: text("duration"),
  features: jsonb("features").$type<string[]>().default([]),
  serviceAreas: jsonb("service_areas").$type<string[]>().default(["Banjul", "Serrekunda", "Kanifing"]),
  area: text("area"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  providerName: text("provider_name").notNull(),
  providerId: varchar("provider_id").references(() => users.id, { onDelete: "set null" }),
  isAvailable: boolean("is_available").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  rating: real("rating").notNull().default(4.5),
  reviewCount: integer("review_count").notNull().default(0),
  imageUrl: text("image_url"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  items: jsonb("items").$type<{ productId: string; vendorId?: string | null; name: string; price: number; quantity: number; image?: string; selectedColor?: string | null; selectedSize?: string | null; selectedVariant?: string | null; selectedOptions?: Record<string, any>; category?: string | null; subcategory?: string | null; sku?: string | null; productType?: string | null; vendorName?: string | null }[]>().notNull(),
  subtotal: integer("subtotal").notNull(),
  shipping: integer("shipping").notNull().default(0),
  total: integer("total").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  fulfillmentType: text("fulfillment_type").notNull().default("delivery"), // delivery or pickup
  paymentStatus: text("payment_status").notNull().default("pending"),
  escrowStatus: text("escrow_status").notNull().default("not_started"),
  qrCode: text("qr_code"),
  qrSecret: text("qr_secret"),
  riderId: varchar("rider_id").references(() => users.id, { onDelete: "set null" }),
  pickupConfirmedAt: timestamp("pickup_confirmed_at"),
  deliveryConfirmedAt: timestamp("delivery_confirmed_at"),
  completedAt: timestamp("completed_at"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  phone: text("phone").notNull(),
  deliveryLatitude: real("delivery_latitude"),
  deliveryLongitude: real("delivery_longitude"),
  deliveryArea: text("delivery_area"),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
  trackingCode: text("tracking_code"),
  estimatedDelivery: text("estimated_delivery"),
  couponCode: text("coupon_code"),
  discount: integer("discount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
  serviceName: text("service_name").notNull(),
  userName: text("user_name").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  address: text("address"),
  notes: text("notes"),
  price: integer("price").notNull(),
  status: bookingStatusEnum("status").notNull().default("pending"),
  providerId: varchar("provider_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  targetId: varchar("target_id").notNull(),
  targetType: text("target_type").notNull(),
  name: text("name").notNull(),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  helpful: integer("helpful").notNull().default(0),
  images: jsonb("images").$type<string[]>().default([]),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  selectedColor: text("selected_color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  icon: text("icon").notNull().default("notifications-outline"),
  color: text("color").notNull().default("#6B7280"),
  actionRoute: text("action_route"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── NEW TABLES ────────────────────────────────────────────────────────────

export const userActivity = pgTable("user_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'view','search','purchase','wishlist','cart','booking'
  targetId: varchar("target_id"),
  category: text("category"),
  searchQuery: text("search_query"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const flashDeals = pgTable("flash_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  discountPercent: integer("discount_percent").notNull(),
  dealPrice: integer("deal_price").notNull(),
  originalPrice: integer("original_price").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  stockLimit: integer("stock_limit").default(50),
  sold: integer("sold").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  label: text("label").default("Flash Deal"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Home"),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shopperProfiles = pgTable("shopper_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  preferredCategories: jsonb("preferred_categories").$type<string[]>().default([]),
  preferredLocation: text("preferred_location"),
  defaultDeliveryAddress: text("default_delivery_address"),
  defaultPhone: text("default_phone"),
  loyaltyTier: text("loyalty_tier").notNull().default("Bronze"),
  wishlistCount: integer("wishlist_count").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vendorProfiles = pgTable("vendor_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  storeName: text("store_name").notNull(),
  shopCategory: text("shop_category").notNull().default("general"),
  allowedCategories: jsonb("allowed_categories").$type<string[]>().default([]),
  subcategories: jsonb("subcategories").$type<string[]>().default([]),
  description: text("description"),
  coverImage: text("cover_image"),
  logo: text("logo"),
  location: text("location"),
  operatingHours: text("operating_hours"),
  deliveryZones: jsonb("delivery_zones").$type<string[]>().default([]),
  supportPhone: text("support_phone"),
  supportEmail: text("support_email"),
  minOrderAmount: integer("min_order_amount").notNull().default(0),
  returnPolicy: text("return_policy").default("7-day return policy for all items."),
  shippingPolicy: text("shipping_policy").default("Delivery within 2-5 business days across The Gambia."),
  totalSales: integer("total_sales").notNull().default(0),
  totalRevenue: integer("total_revenue").notNull().default(0),
  rating: real("rating").notNull().default(4.5),
  reviewCount: integer("review_count").notNull().default(0),
  verificationStatus: text("verification_status").notNull().default("pending"),
  verificationNote: text("verification_note"),
  documents: jsonb("documents").$type<{ type: string; url: string; name: string; uploadedAt?: string; status?: string }[]>().default([]),
  profileEditLocked: boolean("profile_edit_locked").notNull().default(false),
  profileChangeStatus: text("profile_change_status").notNull().default("none"),
  pendingProfileChanges: jsonb("pending_profile_changes").$type<Record<string, any>>().default({}),
  profileChangeNote: text("profile_change_note"),
  profileChangeRequestedAt: timestamp("profile_change_requested_at"),
  profileChangeReviewedAt: timestamp("profile_change_reviewed_at"),
  whatsapp: text("whatsapp"),
  facebook: text("facebook"),
  instagram: text("instagram"),
  businessRegistrationNo: text("business_registration_no"),
  taxNumber: text("tax_number"),
  bankName: text("bank_name"),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  mobileMoneyProvider: text("mobile_money_provider"),
  mobileMoneyNumber: text("mobile_money_number"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const providerProfiles = pgTable("provider_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  profileImage: text("profile_image"),
  coverImage: text("cover_image"),
  location: text("location"),
  serviceAreas: jsonb("service_areas").$type<string[]>().default(["Banjul", "Serrekunda"]),
  portfolio: jsonb("portfolio").$type<string[]>().default([]),
  certifications: jsonb("certifications").$type<string[]>().default([]),
  totalJobs: integer("total_jobs").notNull().default(0),
  totalEarnings: integer("total_earnings").notNull().default(0),
  rating: real("rating").notNull().default(4.5),
  reviewCount: integer("review_count").notNull().default(0),
  verificationStatus: text("verification_status").notNull().default("pending"),
  verificationNote: text("verification_note"),
  documents: jsonb("documents").$type<{ type: string; url: string; name: string }[]>().default([]),
  responseTime: text("response_time").default("< 1 hour"),
  whatsapp: text("whatsapp"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  type: text("type").notNull().default("percent"),
  value: integer("value").notNull(),
  minOrder: integer("min_order").default(0),
  maxUses: integer("max_uses").default(100),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const banners = pgTable("banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  tag: text("tag"),
  color1: text("color1").notNull(),
  color2: text("color2").notNull(),
  icon: text("icon"),
  actionRoute: text("action_route"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});



// ─── MARKETPLACE FINANCE, DELIVERY, OFFICE & CHAT TABLES ─────────────────

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  pendingBalance: integer("pending_balance").notNull().default(0),
  lockedBalance: integer("locked_balance").notNull().default(0),
  currency: text("currency").notNull().default("GMD"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  type: text("type").notNull(), // deposit, purchase, commission, vendor_credit, provider_credit, payout, refund
  direction: text("direction").notNull().default("credit"), // credit or debit
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull().default(0),
  balanceAfter: integer("balance_after").notNull().default(0),
  status: text("status").notNull().default("pending"),
  method: text("method"),
  reference: text("reference"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentAttempts = pgTable("payment_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("wave"),
  status: text("status").notNull().default("pending"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  clientReference: text("client_reference").notNull().unique(),
  providerSessionId: text("provider_session_id").unique(),
  providerTransactionId: text("provider_transaction_id"),
  launchUrl: text("launch_url"),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>().default({}),
  expiresAt: timestamp("expires_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentWebhookEvents = pgTable("payment_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("wave"),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  providerSessionId: text("provider_session_id"),
  status: text("status").notNull().default("received"),
  failureMessage: text("failure_message"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const paymentRefunds = pgTable("payment_refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentAttemptId: varchar("payment_attempt_id").notNull().references(() => paymentAttempts.id, { onDelete: "cascade" }),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  requestedBy: varchar("requested_by").references(() => users.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("wave"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("pending"),
  reason: text("reason").notNull(),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const commissions = pgTable("commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  sellerId: varchar("seller_id").references(() => users.id, { onDelete: "set null" }),
  sellerType: text("seller_type").notNull(), // vendor or provider
  grossAmount: integer("gross_amount").notNull(),
  percentage: real("percentage").notNull().default(10),
  commissionAmount: integer("commission_amount").notNull(),
  sellerAmount: integer("seller_amount").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payouts = pgTable("payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliveryRiders = pgTable("delivery_riders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  bio: text("bio"),
  profilePhoto: text("profile_photo"),
  coverImage: text("cover_image"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  currentAddress: text("current_address"),
  homeAddress: text("home_address"),
  city: text("city"),
  district: text("district"),
  region: text("region"),
  area: text("area"),
  serviceZones: jsonb("service_zones").$type<string[]>().default([]),
  vehicleType: text("vehicle_type").notNull().default("motorbike"),
  vehicleModel: text("vehicle_model"),
  vehicleColor: text("vehicle_color"),
  vehiclePlate: text("vehicle_plate"),
  vehicleRegistrationNo: text("vehicle_registration_no"),
  licenseNumber: text("license_number"),
  drivingLicenseExpiry: text("driving_license_expiry"),
  nationalIdNumber: text("national_id_number"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  payoutMethod: text("payout_method"),
  mobileMoneyProvider: text("mobile_money_provider"),
  mobileMoneyNumber: text("mobile_money_number"),
  bankName: text("bank_name"),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  internalNotes: text("internal_notes"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  isOnline: boolean("is_online").notNull().default(false),
  isAvailable: boolean("is_available").notNull().default(true),
  rating: real("rating").notNull().default(4.5),
  completedDeliveries: integer("completed_deliveries").notNull().default(0),
  verificationStatus: text("verification_status").notNull().default("pending"),
  documents: jsonb("documents").$type<{ type: string; url: string; name: string; uploadedAt?: string; status?: string }[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliveries = pgTable("deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  riderId: varchar("rider_id").references(() => users.id, { onDelete: "set null" }),
  pickupAddress: text("pickup_address").notNull(),
  pickupLatitude: real("pickup_latitude"),
  pickupLongitude: real("pickup_longitude"),
  dropoffAddress: text("dropoff_address").notNull(),
  dropoffLatitude: real("dropoff_latitude"),
  dropoffLongitude: real("dropoff_longitude"),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  status: text("status").notNull().default("pending"),
  acceptedAt: timestamp("accepted_at"),
  pickedUpAt: timestamp("picked_up_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliveryRequests = pgTable("delivery_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deliveryId: varchar("delivery_id").notNull().references(() => deliveries.id, { onDelete: "cascade" }),
  riderId: varchar("rider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  distanceKm: real("distance_km"),
  status: text("status").notNull().default("offered"), // offered, accepted, expired, cancelled
  expiresAt: timestamp("expires_at"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  department: text("department").notNull().default("operations"),
  role: text("role").notNull().default("support_agent"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  assignedStaffId: varchar("assigned_staff_id").references(() => staff.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull().default("customer_vendor"),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  attachments: jsonb("attachments").$type<string[]>().default([]),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  value: text("value").notNull(),
  priceAdjustment: integer("price_adjustment").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  sku: text("sku"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serviceSlots = pgTable("service_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});



// ─── TRACKING, QR, REAL-TIME & ESCROW EXTENSIONS ──────────────────────────

export const orderTrackingEvents = pgTable("order_tracking_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorRole: text("actor_role"),
  status: text("status").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderQrCodes = pgTable("order_qr_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  purpose: text("purpose").notNull().default("order"), // order, pickup, delivery
  status: text("status").notNull().default("active"),
  usedBy: varchar("used_by").references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const riderLocations = pgTable("rider_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riderId: varchar("rider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deliveryId: varchar("delivery_id").references(() => deliveries.id, { onDelete: "set null" }),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  accuracy: real("accuracy"),
  heading: real("heading"),
  speed: real("speed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const riderEarnings = pgTable("rider_earnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riderId: varchar("rider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deliveryId: varchar("delivery_id").references(() => deliveries.id, { onDelete: "set null" }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const escrowTransactions = pgTable("escrow_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  payerId: varchar("payer_id").references(() => users.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  productAmount: integer("product_amount").notNull().default(0),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  commissionAmount: integer("commission_amount").notNull().default(0),
  vendorAmount: integer("vendor_amount").notNull().default(0),
  riderAmount: integer("rider_amount").notNull().default(0),
  status: text("status").notNull().default("held"),
  method: text("method").notNull().default("wallet"),
  reference: text("reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
});

export const settlements = pgTable("settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  beneficiaryId: varchar("beneficiary_id").references(() => users.id, { onDelete: "set null" }),
  beneficiaryType: text("beneficiary_type").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("completed"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const profileCompletionChecks = pgTable("profile_completion_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  score: integer("score").notNull().default(0),
  missingItems: jsonb("missing_items").$type<string[]>().default([]),
  restricted: boolean("restricted").notNull().default(false),
  lastReminderAt: timestamp("last_reminder_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pushNotifications = pgTable("push_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data").$type<Record<string, any>>().default({}),
  status: text("status").notNull().default("queued"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── WHATSAPP COMMERCE ───────────────────────────────────────────────

export const whatsappConnections = pgTable("whatsapp_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  businessPhone: text("business_phone").notNull(),
  displayName: text("display_name"),
  wabaId: text("waba_id"),
  phoneNumberId: text("phone_number_id"),
  status: text("status").notNull().default("pending"),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  humanHandoffEnabled: boolean("human_handoff_enabled").notNull().default(true),
  catalogSyncEnabled: boolean("catalog_sync_enabled").notNull().default(true),
  welcomeMessage: text("welcome_message").default("Welcome to our MansaMart shop. What are you looking for today?"),
  fallbackMessage: text("fallback_message").default("A member of the shop team will reply shortly."),
  connectedAt: timestamp("connected_at"),
  lastWebhookAt: timestamp("last_webhook_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vendorUnique: uniqueIndex("whatsapp_connections_vendor_unique").on(table.vendorId),
  phoneNumberIdUnique: uniqueIndex("whatsapp_connections_phone_number_id_unique").on(table.phoneNumberId),
}));

export const whatsappCustomers = pgTable("whatsapp_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  displayName: text("display_name"),
  optInStatus: text("opt_in_status").notNull().default("unknown"),
  tags: jsonb("tags").$type<string[]>().default([]),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vendorPhoneUnique: uniqueIndex("whatsapp_customers_vendor_phone_unique").on(table.vendorId, table.phone),
}));

export const whatsappThreads = pgTable("whatsapp_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").notNull().references(() => whatsappCustomers.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("open"),
  mode: text("mode").notNull().default("ai"),
  unreadCount: integer("unread_count").notNull().default(0),
  lastMessagePreview: text("last_message_preview"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vendorCustomerUnique: uniqueIndex("whatsapp_threads_vendor_customer_unique").on(table.vendorId, table.customerId),
}));

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => whatsappThreads.id, { onDelete: "cascade" }),
  providerMessageId: text("provider_message_id"),
  direction: text("direction").notNull(),
  type: text("type").notNull().default("text"),
  body: text("body"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  tokenUsage: integer("token_usage").notNull().default(0),
  deliveryStatus: text("delivery_status").notNull().default("received"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  providerMessageUnique: uniqueIndex("whatsapp_messages_provider_message_unique").on(table.providerMessageId),
}));

export const whatsappCarts = pgTable("whatsapp_carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").notNull().references(() => whatsappCustomers.id, { onDelete: "cascade" }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  items: jsonb("items").$type<{ productId: string; name: string; price: number; quantity: number; image?: string }[]>().default([]),
  subtotal: integer("subtotal").notNull().default(0),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  total: integer("total").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappCampaigns = pgTable("whatsapp_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  templateName: text("template_name"),
  message: text("message").notNull(),
  audience: jsonb("audience").$type<{ tags?: string[]; optInOnly?: boolean }>().default({ optInOnly: true }),
  status: text("status").notNull().default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiTokenAccounts = pgTable("ai_token_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(50000),
  lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
  lifetimeUsed: integer("lifetime_used").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vendorUnique: uniqueIndex("ai_token_accounts_vendor_unique").on(table.vendorId),
}));

export const aiUsageEvents = pgTable("ai_usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id").references(() => whatsappThreads.id, { onDelete: "set null" }),
  messageId: varchar("message_id").references(() => whatsappMessages.id, { onDelete: "set null" }),
  model: text("model").notNull().default("catalog-assistant"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const whatsappWebhookEvents = pgTable("whatsapp_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull(),
  phoneNumberId: text("phone_number_id"),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("received"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  failureMessage: text("failure_message"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  eventUnique: uniqueIndex("whatsapp_webhook_events_event_unique").on(table.eventId),
}));

// ─── INSERT SCHEMAS & TYPES ────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertAddressSchema = createInsertSchema(addresses).omit({ id: true, createdAt: true });
export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeliveryRiderSchema = createInsertSchema(deliveryRiders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertShopperProfileSchema = createInsertSchema(shopperProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeliverySchema = createInsertSchema(deliveries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderTrackingEventSchema = createInsertSchema(orderTrackingEvents).omit({ id: true, createdAt: true });
export const insertOrderQrCodeSchema = createInsertSchema(orderQrCodes).omit({ id: true, createdAt: true });
export const insertEscrowTransactionSchema = createInsertSchema(escrowTransactions).omit({ id: true, createdAt: true, releasedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type ShopperProfile = typeof shopperProfiles.$inferSelect;
export type VendorProfile = typeof vendorProfiles.$inferSelect;
export type ProviderProfile = typeof providerProfiles.$inferSelect;
export type FlashDeal = typeof flashDeals.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type UserActivity = typeof userActivity.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type PaymentWebhookEvent = typeof paymentWebhookEvents.$inferSelect;
export type PaymentRefund = typeof paymentRefunds.$inferSelect;
export type Commission = typeof commissions.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type DeliveryRider = typeof deliveryRiders.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type DeliveryRequest = typeof deliveryRequests.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ServiceSlot = typeof serviceSlots.$inferSelect;
export type OrderTrackingEvent = typeof orderTrackingEvents.$inferSelect;
export type OrderQrCode = typeof orderQrCodes.$inferSelect;
export type RiderLocation = typeof riderLocations.$inferSelect;
export type RiderEarning = typeof riderEarnings.$inferSelect;
export type EscrowTransaction = typeof escrowTransactions.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type ProfileCompletionCheck = typeof profileCompletionChecks.$inferSelect;
export type PushNotification = typeof pushNotifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
