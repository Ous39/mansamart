var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import "dotenv/config";
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import crypto2 from "node:crypto";

// server/db.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  addresses: () => addresses,
  auditLogs: () => auditLogs,
  banners: () => banners,
  bookingStatusEnum: () => bookingStatusEnum,
  bookings: () => bookings,
  cartItems: () => cartItems,
  commissions: () => commissions,
  conversations: () => conversations,
  coupons: () => coupons,
  deliveries: () => deliveries,
  deliveryRequests: () => deliveryRequests,
  deliveryRiders: () => deliveryRiders,
  escrowTransactions: () => escrowTransactions,
  flashDeals: () => flashDeals,
  insertAddressSchema: () => insertAddressSchema,
  insertBookingSchema: () => insertBookingSchema,
  insertDeliveryRiderSchema: () => insertDeliveryRiderSchema,
  insertDeliverySchema: () => insertDeliverySchema,
  insertEscrowTransactionSchema: () => insertEscrowTransactionSchema,
  insertOrderQrCodeSchema: () => insertOrderQrCodeSchema,
  insertOrderSchema: () => insertOrderSchema,
  insertOrderTrackingEventSchema: () => insertOrderTrackingEventSchema,
  insertProductSchema: () => insertProductSchema,
  insertReviewSchema: () => insertReviewSchema,
  insertServiceSchema: () => insertServiceSchema,
  insertShopperProfileSchema: () => insertShopperProfileSchema,
  insertUserSchema: () => insertUserSchema,
  insertWalletSchema: () => insertWalletSchema,
  messages: () => messages,
  notifications: () => notifications,
  orderQrCodes: () => orderQrCodes,
  orderStatusEnum: () => orderStatusEnum,
  orderTrackingEvents: () => orderTrackingEvents,
  orders: () => orders,
  payouts: () => payouts,
  productVariants: () => productVariants,
  products: () => products,
  profileCompletionChecks: () => profileCompletionChecks,
  providerProfiles: () => providerProfiles,
  pushNotifications: () => pushNotifications,
  reviews: () => reviews,
  riderEarnings: () => riderEarnings,
  riderLocations: () => riderLocations,
  roleEnum: () => roleEnum,
  serviceSlots: () => serviceSlots,
  services: () => services,
  sessions: () => sessions,
  settlements: () => settlements,
  shopperProfiles: () => shopperProfiles,
  staff: () => staff,
  supportTickets: () => supportTickets,
  transactions: () => transactions,
  userActivity: () => userActivity,
  users: () => users,
  vendorProfiles: () => vendorProfiles,
  wallets: () => wallets,
  wishlistItems: () => wishlistItems
});
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var roleEnum = pgEnum("role", ["user", "vendor", "service_provider", "delivery_rider", "admin"]);
var orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "confirmed",
  "processing",
  "preparing",
  "ready_for_pickup",
  "searching_rider",
  "rider_searching",
  "rider_assigned",
  "rider_arrived_vendor",
  "picked_up",
  "on_the_way",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "refunded"
]);
var bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]);
var users = pgTable("users", {
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
  personalDocuments: jsonb("personal_documents").$type().default([]),
  verificationStatus: text("verification_status").notNull().default("not_submitted"),
  isVerified: boolean("is_verified").notNull().default(false),
  profileEditLocked: boolean("profile_edit_locked").notNull().default(false),
  profileChangeStatus: text("profile_change_status").notNull().default("none"),
  pendingProfileChanges: jsonb("pending_profile_changes").$type().default({}),
  profileChangeNote: text("profile_change_note"),
  profileChangeRequestedAt: timestamp("profile_change_requested_at"),
  profileChangeReviewedAt: timestamp("profile_change_reviewed_at"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var products = pgTable("products", {
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
  specs: jsonb("specs").$type().default({}),
  images: jsonb("images").$type().default([]),
  colors: jsonb("colors").$type().default([]),
  features: jsonb("features").$type().default([]),
  tags: jsonb("tags").$type().default([]),
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
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  priceType: text("price_type").notNull().default("fixed"),
  category: text("category").notNull(),
  duration: text("duration"),
  features: jsonb("features").$type().default([]),
  serviceAreas: jsonb("service_areas").$type().default(["Banjul", "Serrekunda", "Kanifing"]),
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
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  items: jsonb("items").$type().notNull(),
  subtotal: integer("subtotal").notNull(),
  shipping: integer("shipping").notNull().default(0),
  total: integer("total").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  fulfillmentType: text("fulfillment_type").notNull().default("delivery"),
  // delivery or pickup
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
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var bookings = pgTable("bookings", {
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
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  targetId: varchar("target_id").notNull(),
  targetType: text("target_type").notNull(),
  name: text("name").notNull(),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  helpful: integer("helpful").notNull().default(0),
  images: jsonb("images").$type().default([]),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  selectedColor: text("selected_color"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  icon: text("icon").notNull().default("notifications-outline"),
  color: text("color").notNull().default("#6B7280"),
  actionRoute: text("action_route"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var userActivity = pgTable("user_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  // 'view','search','purchase','wishlist','cart','booking'
  targetId: varchar("target_id"),
  category: text("category"),
  searchQuery: text("search_query"),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var flashDeals = pgTable("flash_deals", {
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
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Home"),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var shopperProfiles = pgTable("shopper_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  preferredCategories: jsonb("preferred_categories").$type().default([]),
  preferredLocation: text("preferred_location"),
  defaultDeliveryAddress: text("default_delivery_address"),
  defaultPhone: text("default_phone"),
  loyaltyTier: text("loyalty_tier").notNull().default("Bronze"),
  wishlistCount: integer("wishlist_count").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var vendorProfiles = pgTable("vendor_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  storeName: text("store_name").notNull(),
  shopCategory: text("shop_category").notNull().default("general"),
  allowedCategories: jsonb("allowed_categories").$type().default([]),
  subcategories: jsonb("subcategories").$type().default([]),
  description: text("description"),
  coverImage: text("cover_image"),
  logo: text("logo"),
  location: text("location"),
  operatingHours: text("operating_hours"),
  deliveryZones: jsonb("delivery_zones").$type().default([]),
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
  documents: jsonb("documents").$type().default([]),
  profileEditLocked: boolean("profile_edit_locked").notNull().default(false),
  profileChangeStatus: text("profile_change_status").notNull().default("none"),
  pendingProfileChanges: jsonb("pending_profile_changes").$type().default({}),
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
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var providerProfiles = pgTable("provider_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  profileImage: text("profile_image"),
  coverImage: text("cover_image"),
  location: text("location"),
  serviceAreas: jsonb("service_areas").$type().default(["Banjul", "Serrekunda"]),
  portfolio: jsonb("portfolio").$type().default([]),
  certifications: jsonb("certifications").$type().default([]),
  totalJobs: integer("total_jobs").notNull().default(0),
  totalEarnings: integer("total_earnings").notNull().default(0),
  rating: real("rating").notNull().default(4.5),
  reviewCount: integer("review_count").notNull().default(0),
  verificationStatus: text("verification_status").notNull().default("pending"),
  verificationNote: text("verification_note"),
  documents: jsonb("documents").$type().default([]),
  responseTime: text("response_time").default("< 1 hour"),
  whatsapp: text("whatsapp"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var coupons = pgTable("coupons", {
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
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var banners = pgTable("banners", {
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
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  pendingBalance: integer("pending_balance").notNull().default(0),
  lockedBalance: integer("locked_balance").notNull().default(0),
  currency: text("currency").notNull().default("GMD"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  // deposit, purchase, commission, vendor_credit, provider_credit, payout, refund
  direction: text("direction").notNull().default("credit"),
  // credit or debit
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull().default(0),
  balanceAfter: integer("balance_after").notNull().default(0),
  status: text("status").notNull().default("pending"),
  method: text("method"),
  reference: text("reference"),
  description: text("description"),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var commissions = pgTable("commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  sellerId: varchar("seller_id").references(() => users.id, { onDelete: "set null" }),
  sellerType: text("seller_type").notNull(),
  // vendor or provider
  grossAmount: integer("gross_amount").notNull(),
  percentage: real("percentage").notNull().default(10),
  commissionAmount: integer("commission_amount").notNull(),
  sellerAmount: integer("seller_amount").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var payouts = pgTable("payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var deliveryRiders = pgTable("delivery_riders", {
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
  serviceZones: jsonb("service_zones").$type().default([]),
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
  documents: jsonb("documents").$type().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var deliveries = pgTable("deliveries", {
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
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var deliveryRequests = pgTable("delivery_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deliveryId: varchar("delivery_id").notNull().references(() => deliveries.id, { onDelete: "cascade" }),
  riderId: varchar("rider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  distanceKm: real("distance_km"),
  status: text("status").notNull().default("offered"),
  // offered, accepted, expired, cancelled
  expiresAt: timestamp("expires_at"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  department: text("department").notNull().default("operations"),
  role: text("role").notNull().default("support_agent"),
  permissions: jsonb("permissions").$type().default([]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  assignedStaffId: varchar("assigned_staff_id").references(() => staff.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull().default("customer_vendor"),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  attachments: jsonb("attachments").$type().default([]),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  value: text("value").notNull(),
  priceAdjustment: integer("price_adjustment").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  sku: text("sku"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var serviceSlots = pgTable("service_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var orderTrackingEvents = pgTable("order_tracking_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorRole: text("actor_role"),
  status: text("status").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var orderQrCodes = pgTable("order_qr_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  purpose: text("purpose").notNull().default("order"),
  // order, pickup, delivery
  status: text("status").notNull().default("active"),
  usedBy: varchar("used_by").references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var riderLocations = pgTable("rider_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riderId: varchar("rider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deliveryId: varchar("delivery_id").references(() => deliveries.id, { onDelete: "set null" }),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  accuracy: real("accuracy"),
  heading: real("heading"),
  speed: real("speed"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var riderEarnings = pgTable("rider_earnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riderId: varchar("rider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deliveryId: varchar("delivery_id").references(() => deliveries.id, { onDelete: "set null" }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at")
});
var escrowTransactions = pgTable("escrow_transactions", {
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
  releasedAt: timestamp("released_at")
});
var settlements = pgTable("settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  beneficiaryId: varchar("beneficiary_id").references(() => users.id, { onDelete: "set null" }),
  beneficiaryType: text("beneficiary_type").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("completed"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var profileCompletionChecks = pgTable("profile_completion_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  score: integer("score").notNull().default(0),
  missingItems: jsonb("missing_items").$type().default([]),
  restricted: boolean("restricted").notNull().default(false),
  lastReminderAt: timestamp("last_reminder_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var pushNotifications = pgTable("push_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data").$type().default({}),
  status: text("status").notNull().default("queued"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  metadata: jsonb("metadata").$type().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
var insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
var insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
var insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
var insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
var insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
var insertAddressSchema = createInsertSchema(addresses).omit({ id: true, createdAt: true });
var insertWalletSchema = createInsertSchema(wallets).omit({ id: true, createdAt: true, updatedAt: true });
var insertDeliveryRiderSchema = createInsertSchema(deliveryRiders).omit({ id: true, createdAt: true, updatedAt: true });
var insertShopperProfileSchema = createInsertSchema(shopperProfiles).omit({ id: true, createdAt: true, updatedAt: true });
var insertDeliverySchema = createInsertSchema(deliveries).omit({ id: true, createdAt: true, updatedAt: true });
var insertOrderTrackingEventSchema = createInsertSchema(orderTrackingEvents).omit({ id: true, createdAt: true });
var insertOrderQrCodeSchema = createInsertSchema(orderQrCodes).omit({ id: true, createdAt: true });
var insertEscrowTransactionSchema = createInsertSchema(escrowTransactions).omit({ id: true, createdAt: true, releasedAt: true });

// server/db.ts
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Create a .env file in the project root, then restart the server. Example: DATABASE_URL=postgres://postgres:NoVirus123@localhost:5432/oceanbrown"
  );
}
var pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : false
});
var db = drizzle(pool, { schema: schema_exports });

// server/routes.ts
import { eq as eq2, and as and2, desc, ilike, or, inArray, ne, gt as gt2, count, sql as sql2 } from "drizzle-orm";

// server/auth.ts
import { eq, and, gt } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
function generateToken() {
  return crypto.randomBytes(48).toString("hex");
}
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}
async function comparePassword(password, hash2) {
  return bcrypt.compare(password, hash2);
}
async function hashPin(pin) {
  return bcrypt.hash(pin, 10);
}
async function comparePin(pin, hash2) {
  return bcrypt.compare(pin, hash2);
}
async function createSession(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
  await db.insert(sessions).values({ userId, token, expiresAt });
  return token;
}
async function getSessionUser(token) {
  const [session] = await db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.token, token), gt(sessions.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
  return session?.user ?? null;
}
async function deleteSession(token) {
  await db.delete(sessions).where(eq(sessions.token, token));
}
function getTokenFromRequest(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}
async function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  const user = await getSessionUser(token);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  req.user = user;
  next();
}
async function optionalAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (token) {
    const user = await getSessionUser(token);
    if (user) req.user = user;
  }
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

// server/routes.ts
import { z } from "zod";
var realtimeEmitter = () => {
};
function emitRealtime(event, payload, rooms) {
  try {
    realtimeEmitter(event, payload, rooms);
  } catch (error) {
    console.warn("[realtime skipped]", event, error);
  }
}
function socketCorsOrigins() {
  return (process.env.CORS_ORIGIN || process.env.EXPO_PUBLIC_DOMAIN || process.env.EXPO_PUBLIC_API_URL || "").split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
}
function safeSocketUser(user) {
  if (!user) return null;
  const { password, pin, ...safe } = user;
  return safe;
}
function safeUser(u) {
  const { password, pin, ...safe } = u;
  return safe;
}
function param(req, key) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}
function publicUrl(req, relativePath) {
  const explicitBase = process.env.EXPO_PUBLIC_DOMAIN || process.env.PUBLIC_URL || "";
  if (explicitBase) return `${explicitBase.replace(/\/$/, "")}${relativePath}`;
  const proto = req.header("x-forwarded-proto") || req.protocol || "http";
  const host = req.header("x-forwarded-host") || req.get("host");
  return `${proto}://${host}${relativePath}`;
}
function getPublicProductFilters() {
  return [eq2(products.inStock, true), gt2(products.stock, 0)];
}
function toNumber(value) {
  if (value === void 0 || value === null || value === "") return void 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : void 0;
}
function distanceKm(aLat, aLng, bLat, bLng) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return 999999;
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function withDistance(rows, latitude, longitude, radiusKm) {
  return rows.map((row) => ({ ...row, distanceKm: distanceKm(row.latitude, row.longitude, latitude, longitude) })).filter((row) => radiusKm == null || row.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
}
function isPersonalProfileLocked(user) {
  return user?.isVerified === true || user?.verificationStatus === "verified" || user?.profileEditLocked === true;
}
async function submitPersonalProfileChange(user, data) {
  const [updated] = await db.update(users).set({
    pendingProfileChanges: data,
    profileChangeStatus: "pending",
    profileChangeNote: null,
    profileChangeRequestedAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(users.id, user.id)).returning();
  return updated;
}
function vendorProfileCompleteness(profile, productCount = 0) {
  const checks = [
    !!profile?.storeName,
    !!profile?.shopCategory && profile.shopCategory !== "general",
    !!profile?.description,
    !!profile?.logo,
    !!profile?.coverImage,
    !!profile?.location,
    Array.isArray(profile?.deliveryZones) && profile.deliveryZones.length > 0,
    !!profile?.supportPhone || !!profile?.whatsapp,
    !!profile?.returnPolicy,
    !!profile?.shippingPolicy,
    !!profile?.mobileMoneyNumber || !!profile?.accountNumber,
    productCount > 0
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round(complete / checks.length * 100);
}
function vendorHealthLabel(score, verificationStatus) {
  if (verificationStatus === "rejected") return "Needs verification review";
  if (score >= 85) return "Strong profile";
  if (score >= 60) return "Good but incomplete";
  return "Needs setup";
}
function base64ToFile(dataUri, fileName = "upload.jpg") {
  const match = dataUri.match(/^data:(.+);base64,(.*)$/);
  const mimeType = match?.[1] || "image/jpeg";
  const base64 = match?.[2] || dataUri;
  const extFromMime = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/\.+/g, ".");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : extFromMime;
  const finalName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext || extFromMime}`;
  const uploadDir = path.resolve(process.cwd(), "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, finalName);
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  return { relativePath: `/uploads/${finalName}`, mimeType, filePath };
}
async function createDefaultProfiles(user) {
  try {
    await db.insert(wallets).values({ userId: user.id }).onConflictDoNothing();
  } catch {
  }
  try {
    if (user.role === "vendor") {
      await db.insert(vendorProfiles).values({
        userId: user.id,
        storeName: user.businessName || user.name,
        description: user.bio,
        shopCategory: user.businessType || "general",
        allowedCategories: [],
        subcategories: [],
        location: user.city || user.region || "The Gambia",
        deliveryZones: [user.city || user.region || "The Gambia"],
        supportPhone: user.phone || void 0,
        whatsapp: user.phone || void 0
      }).onConflictDoNothing();
    } else if (user.role === "service_provider") {
      await db.insert(providerProfiles).values({
        userId: user.id,
        displayName: user.businessName || user.name,
        bio: user.bio,
        location: user.city || user.region || "The Gambia",
        whatsapp: user.phone || void 0
      }).onConflictDoNothing();
    } else if (user.role === "delivery_rider") {
      await db.insert(deliveryRiders).values({
        userId: user.id,
        displayName: user.businessName || user.name,
        bio: user.bio || void 0,
        phone: user.phone || void 0,
        whatsapp: user.phone || void 0,
        currentAddress: user.address || void 0,
        city: user.city || void 0,
        region: user.region || void 0,
        area: user.area || void 0,
        serviceZones: [user.city || user.region || user.area || "The Gambia"].filter(Boolean),
        vehicleType: user.businessType || "motorbike",
        latitude: user.latitude,
        longitude: user.longitude,
        isOnline: false,
        isAvailable: false
      }).onConflictDoNothing();
    } else {
      await db.insert(shopperProfiles).values({
        userId: user.id,
        preferredLocation: user.city || user.region,
        defaultDeliveryAddress: user.address,
        defaultPhone: user.phone
      }).onConflictDoNothing();
    }
  } catch (err) {
    console.warn("Default profile creation skipped:", err);
  }
}
async function getOrdersForVendor(vendorId) {
  const vendorProducts = await db.select().from(products).where(eq2(products.vendorId, vendorId));
  const ids = new Set(vendorProducts.map((p) => p.id));
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  return allOrders.filter((o) => Array.isArray(o.items) && o.items.some((item) => ids.has(item.productId)));
}
async function getOrCreateWalletGlobal(userId) {
  const [existing] = await db.select().from(wallets).where(eq2(wallets.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(wallets).values({ userId, balance: 0, pendingBalance: 0, lockedBalance: 0 }).returning();
  return created;
}
async function addWalletTransaction(args) {
  const wallet = await getOrCreateWalletGlobal(args.userId);
  const before = wallet.balance;
  const after = args.direction === "credit" ? before + args.amount : before - args.amount;
  if (after < 0) throw new Error("Insufficient wallet balance");
  const [updatedWallet] = await db.update(wallets).set({ balance: after, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(wallets.id, wallet.id)).returning();
  const [tx] = await db.insert(transactions).values({
    walletId: wallet.id,
    userId: args.userId,
    orderId: args.orderId,
    bookingId: args.bookingId,
    type: args.type,
    direction: args.direction,
    amount: args.amount,
    balanceBefore: before,
    balanceAfter: after,
    status: args.status ?? "completed",
    method: args.method,
    reference: args.reference,
    description: args.description
  }).returning();
  return { wallet: updatedWallet, transaction: tx };
}
function generateOrderQrCode(orderId, purpose = "order") {
  const secret = crypto2.randomBytes(16).toString("hex");
  const code = `MM-${purpose.toUpperCase()}-${orderId.slice(0, 8).toUpperCase()}-${secret.slice(0, 10).toUpperCase()}`;
  return { code, secret };
}
async function notifyUser(userId, type, title, body, actionRoute, data = {}) {
  if (!userId) return;
  const [notification] = await db.insert(notifications).values({
    userId,
    type,
    title,
    body,
    icon: type === "delivery" ? "bicycle-outline" : type === "payment" ? "wallet-outline" : "notifications-outline",
    color: type === "delivery" ? "#E8813A" : type === "payment" ? "#0EA47A" : "#2563EB",
    actionRoute
  }).returning().catch(() => []);
  await db.insert(pushNotifications).values({ userId, title, body, data: { ...data, actionRoute, type } }).catch(() => {
  });
  emitRealtime("notification:new", { notification, data: { ...data, actionRoute, type } }, [`user:${userId}`]);
}
async function audit(actorId, action, entityType, entityId, metadata = {}) {
  await db.insert(auditLogs).values({ actorId: actorId || null, action, entityType, entityId, metadata }).catch(() => {
  });
}
async function addTracking(orderId, status, title, message, actor, metadata = {}) {
  const [event] = await db.insert(orderTrackingEvents).values({
    orderId,
    actorId: actor?.id || null,
    actorRole: actor?.role || null,
    status,
    title,
    message,
    metadata
  }).returning();
  await audit(actor?.id, `order.${status}`, "order", orderId, metadata);
  emitRealtime("order:tracking", { orderId, status, event }, [`order:${orderId}`, "role:admin"]);
  return event;
}
async function ensureOrderQr(orderId, purpose = "delivery") {
  const [existing] = await db.select().from(orderQrCodes).where(and2(eq2(orderQrCodes.orderId, orderId), eq2(orderQrCodes.purpose, purpose), eq2(orderQrCodes.status, "active"))).limit(1);
  if (existing) return existing;
  const { code, secret } = generateOrderQrCode(orderId, purpose);
  const [qr] = await db.insert(orderQrCodes).values({
    orderId,
    code,
    purpose,
    expiresAt: new Date(Date.now() + 1e3 * 60 * 60 * 24 * 14)
  }).returning();
  if (purpose === "delivery") {
    await db.update(orders).set({ qrCode: code, qrSecret: secret, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, orderId));
  }
  return qr;
}
async function ensureOrderQrs(orderId) {
  const pickup = await ensureOrderQr(orderId, "pickup");
  const delivery = await ensureOrderQr(orderId, "delivery");
  return { pickup, delivery };
}
async function getOrderParties(order) {
  const vendorIds = /* @__PURE__ */ new Set();
  for (const item of order.items || []) {
    if (item.vendorId) vendorIds.add(item.vendorId);
    else if (item.productId) {
      const [product] = await db.select().from(products).where(eq2(products.id, item.productId)).limit(1);
      if (product?.vendorId) vendorIds.add(product.vendorId);
    }
  }
  return { shopperId: order.userId, vendorIds: [...vendorIds], riderId: order.riderId };
}
async function notifyOrderParties(order, title, body, type = "order") {
  const parties = await getOrderParties(order);
  const userIds = /* @__PURE__ */ new Set();
  if (parties.shopperId) userIds.add(parties.shopperId);
  if (parties.riderId) userIds.add(parties.riderId);
  parties.vendorIds.forEach((id) => userIds.add(id));
  for (const userId of userIds) await notifyUser(userId, type, title, body, `/order/${order.id}`, { orderId: order.id, status: order.status });
}
function getVendorTotals(order) {
  const totals = {};
  for (const item of order.items || []) {
    if (item.vendorId) totals[item.vendorId] = (totals[item.vendorId] || 0) + Number(item.price) * Number(item.quantity);
  }
  return totals;
}
async function calculateVendorTotalsFromDb(order) {
  const totals = getVendorTotals(order);
  for (const item of order.items || []) {
    if (!item.vendorId && item.productId) {
      const [product] = await db.select().from(products).where(eq2(products.id, item.productId)).limit(1);
      if (product?.vendorId) totals[product.vendorId] = (totals[product.vendorId] || 0) + Number(item.price) * Number(item.quantity);
    }
  }
  return totals;
}
async function releaseEscrowForOrder(order, actor) {
  const [escrow] = await db.select().from(escrowTransactions).where(and2(eq2(escrowTransactions.orderId, order.id), eq2(escrowTransactions.status, "held"))).limit(1);
  if (!escrow) return { released: false, message: "No held escrow found" };
  const vendorTotals = await calculateVendorTotalsFromDb(order);
  const commissionPercent = 5;
  for (const [vendorId, gross] of Object.entries(vendorTotals)) {
    const commission = Math.round(Number(gross) * commissionPercent / 100);
    const vendorAmount = Number(gross) - commission;
    await db.insert(commissions).values({ orderId: order.id, sellerId: vendorId, sellerType: "vendor", grossAmount: Number(gross), percentage: commissionPercent, commissionAmount: commission, sellerAmount: vendorAmount, status: "earned" }).catch(() => {
    });
    await addWalletTransaction({ userId: vendorId, type: "vendor_credit", direction: "credit", amount: vendorAmount, orderId: order.id, description: `Escrow released for order #${order.id.slice(0, 8).toUpperCase()}` });
    await db.insert(settlements).values({ orderId: order.id, beneficiaryId: vendorId, beneficiaryType: "vendor", amount: vendorAmount, note: "Vendor settlement after confirmed delivery" }).catch(() => {
    });
    await notifyUser(vendorId, "payment", "Payment Released", `D ${vendorAmount.toLocaleString()} has been released to your wallet.`, `/order/${order.id}`, { orderId: order.id });
  }
  const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.orderId, order.id)).limit(1);
  if (delivery?.riderId && delivery.deliveryFee > 0) {
    await addWalletTransaction({ userId: delivery.riderId, type: "rider_credit", direction: "credit", amount: delivery.deliveryFee, orderId: order.id, description: `Delivery earning for order #${order.id.slice(0, 8).toUpperCase()}` });
    await db.insert(riderEarnings).values({ riderId: delivery.riderId, deliveryId: delivery.id, orderId: order.id, amount: delivery.deliveryFee, status: "completed", paidAt: /* @__PURE__ */ new Date() }).catch(() => {
    });
    await db.insert(settlements).values({ orderId: order.id, beneficiaryId: delivery.riderId, beneficiaryType: "rider", amount: delivery.deliveryFee, note: "Rider delivery fee released" }).catch(() => {
    });
    await notifyUser(delivery.riderId, "payment", "Delivery Fee Released", `D ${delivery.deliveryFee.toLocaleString()} has been released to your wallet.`, `/(rider)/deliveries`, { orderId: order.id });
  }
  await db.update(escrowTransactions).set({ status: "released", releasedAt: /* @__PURE__ */ new Date() }).where(eq2(escrowTransactions.id, escrow.id));
  await db.update(orders).set({ status: "completed", escrowStatus: "released", paymentStatus: "settled", completedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, order.id));
  await addTracking(order.id, "completed", "Order completed", "Escrow has been released after successful verification.", actor);
  await notifyOrderParties({ ...order, status: "completed" }, "Order Completed", "The order is complete and payments have been released.", "order");
  return { released: true };
}
async function computeProfileCompletion(user) {
  const missing = [];
  if (!user.avatar) missing.push("Profile photo");
  if (!user.phone) missing.push("Phone number");
  if (!user.address && !user.city && !user.region) missing.push("Address/location");
  if (user.role === "vendor") {
    const [vp] = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, user.id)).limit(1);
    if (!vp?.storeName) missing.push("Store name");
    if (!vp?.logo) missing.push("Store logo");
    if (!vp?.mobileMoneyNumber && !vp?.accountNumber) missing.push("Bank/mobile money details");
    if (!Array.isArray(vp?.documents) || vp.documents.length === 0) missing.push("Business documents");
    if (vp?.verificationStatus !== "verified") missing.push("Admin verification");
  }
  if (user.role === "service_provider") {
    const [pp] = await db.select().from(providerProfiles).where(eq2(providerProfiles.userId, user.id)).limit(1);
    if (!pp?.profileImage) missing.push("Profile image");
    if (!pp?.whatsapp) missing.push("WhatsApp/contact");
    if (!Array.isArray(pp?.documents) || pp.documents.length === 0) missing.push("ID/certification documents");
    if (pp?.verificationStatus !== "verified") missing.push("Admin verification");
  }
  if (user.role === "delivery_rider") {
    const [rp] = await db.select().from(deliveryRiders).where(eq2(deliveryRiders.userId, user.id)).limit(1);
    if (!rp?.vehicleType) missing.push("Vehicle type");
    if (!rp?.vehiclePlate) missing.push("Vehicle plate");
    if (!Array.isArray(rp?.documents) || rp.documents.length === 0) missing.push("ID/license documents");
    if (rp?.verificationStatus !== "verified") missing.push("Admin verification");
  }
  const total = missing.length + 1;
  const score = Math.max(0, Math.round((total - missing.length) / total * 100));
  const restricted = ["vendor", "service_provider", "delivery_rider"].includes(user.role) && missing.length > 0;
  const [check] = await db.insert(profileCompletionChecks).values({ userId: user.id, role: user.role, score, missingItems: missing, restricted }).returning().catch(async () => {
    const [updated] = await db.update(profileCompletionChecks).set({ score, missingItems: missing, restricted, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(profileCompletionChecks.userId, user.id)).returning();
    return [updated];
  });
  return check || { score, missingItems: missing, restricted };
}
async function registerRoutes(app2) {
  app2.post("/api/uploads/base64", requireAuth, async (req, res) => {
    try {
      const { image, fileName, kind } = z.object({
        image: z.string().min(100),
        fileName: z.string().optional(),
        kind: z.string().optional()
      }).parse(req.body);
      const saved = base64ToFile(image, fileName || `${kind || "upload"}.jpg`);
      return res.status(201).json({
        url: publicUrl(req, saved.relativePath),
        path: saved.relativePath,
        mimeType: saved.mimeType
      });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid image" });
      console.error(err);
      return res.status(500).json({ message: "Image upload failed" });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        area: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        locationAccuracy: z.number().optional(),
        gender: z.string().optional(),
        dateOfBirth: z.string().optional(),
        role: z.enum(["user", "vendor", "service_provider", "delivery_rider"]).default("user"),
        businessName: z.string().optional(),
        businessType: z.string().optional(),
        bio: z.string().optional()
      });
      const parsed = schema.parse(req.body);
      const data = { ...parsed, email: parsed.email.trim().toLowerCase() };
      const existing = await db.select().from(users).where(eq2(users.email, data.email)).limit(1);
      if (existing.length > 0) return res.status(409).json({ message: "Email already registered" });
      const hashedPassword = await hashPassword(data.password);
      const [user] = await db.insert(users).values({
        ...data,
        password: hashedPassword
      }).returning();
      await createDefaultProfiles(user);
      const token = await createSession(user.id);
      await db.insert(notifications).values({
        userId: user.id,
        type: "system",
        title: "Welcome to MansaMart!",
        body: "Discover thousands of products and book home services from Gambian businesses.",
        icon: "information-circle-outline",
        color: "#0EA47A"
      });
      return res.status(201).json({ token, user: safeUser(user) });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid data" });
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string()
      }).parse(req.body);
      const loginEmail = email.trim().toLowerCase();
      const [user] = await db.select().from(users).where(eq2(users.email, loginEmail)).limit(1);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });
      const valid = await comparePassword(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });
      const token = await createSession(user.id);
      return res.json({ token, user: safeUser(user), hasPin: !!user.pin });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid data" });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/auth/verify-pin", requireAuth, async (req, res) => {
    try {
      const { pin } = z.object({ pin: z.string().length(6) }).parse(req.body);
      const user = req.user;
      if (!user.pin) return res.status(400).json({ message: "No PIN set" });
      const valid = await comparePin(pin, user.pin);
      if (!valid) return res.status(401).json({ message: "Incorrect PIN" });
      return res.json({ verified: true });
    } catch {
      return res.status(400).json({ message: "Invalid PIN" });
    }
  });
  app2.post("/api/auth/set-pin", requireAuth, async (req, res) => {
    try {
      const { pin } = z.object({ pin: z.string().length(6).regex(/^\d{6}$/) }).parse(req.body);
      const user = req.user;
      const hashed = await hashPin(pin);
      await db.update(users).set({ pin: hashed }).where(eq2(users.id, user.id));
      return res.json({ success: true });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: "PIN must be 6 digits" });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/auth/me", requireAuth, (req, res) => {
    const user = req.user;
    return res.json({ user: safeUser(user), hasPin: !!user.pin });
  });
  app2.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const schema = z.object({
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        area: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        locationAccuracy: z.number().optional(),
        gender: z.string().optional(),
        dateOfBirth: z.string().optional(),
        businessName: z.string().optional(),
        businessType: z.string().optional(),
        bio: z.string().optional(),
        avatar: z.string().optional()
      });
      const data = schema.parse(req.body);
      if (isPersonalProfileLocked(user)) {
        const updated2 = await submitPersonalProfileChange(user, data);
        return res.json({ user: safeUser(updated2), changeRequestSubmitted: true, message: "Your verified personal profile is locked. Changes were submitted for admin approval." });
      }
      const [updated] = await db.update(users).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id)).returning();
      return res.json({ user: safeUser(updated) });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/auth/logout", requireAuth, async (req, res) => {
    const token = getTokenFromRequest(req);
    if (token) await deleteSession(token);
    return res.json({ success: true });
  });
  app2.put("/api/location/me", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const data = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        locationAccuracy: z.number().optional(),
        region: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        area: z.string().optional()
      }).parse(req.body);
      const [updated] = await db.update(users).set({
        latitude: data.latitude,
        longitude: data.longitude,
        locationAccuracy: data.locationAccuracy,
        region: data.region,
        city: data.city,
        area: data.area || data.district,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(users.id, user.id)).returning();
      if (user.role === "delivery_rider") {
        await db.update(deliveryRiders).set({ latitude: data.latitude, longitude: data.longitude, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, user.id));
      }
      return res.json({ user: safeUser(updated) });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Location update failed" });
    }
  });
  app2.get("/api/nearby", async (req, res) => {
    try {
      const latitude = toNumber(req.query.latitude);
      const longitude = toNumber(req.query.longitude);
      const radiusKm = toNumber(req.query.radiusKm) ?? 10;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 30) || 30, 1), 100);
      if (latitude == null || longitude == null) return res.status(400).json({ message: "latitude and longitude are required" });
      const productRows = await db.select().from(products).where(and2(...getPublicProductFilters())).orderBy(desc(products.createdAt)).limit(500);
      const serviceRows = await db.select().from(services).where(eq2(services.isAvailable, true)).orderBy(desc(services.createdAt)).limit(500);
      const vendorUsers = await db.select().from(users).where(eq2(users.role, "vendor")).limit(500);
      const riderRows = await db.select().from(deliveryRiders).where(and2(eq2(deliveryRiders.isOnline, true), eq2(deliveryRiders.isAvailable, true), eq2(deliveryRiders.verificationStatus, "verified"))).limit(200);
      return res.json({
        radiusKm,
        products: withDistance(productRows, latitude, longitude, radiusKm).slice(0, limit),
        services: withDistance(serviceRows, latitude, longitude, radiusKm).slice(0, limit),
        vendors: withDistance(vendorUsers, latitude, longitude, radiusKm).slice(0, limit),
        riders: withDistance(riderRows, latitude, longitude, radiusKm).slice(0, limit)
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Nearby lookup failed" });
    }
  });
  app2.get("/api/products", async (req, res) => {
    try {
      const { category, search, sale, newOnly, limit: limitStr, offset: offsetStr, latitude: latStr, longitude: lngStr, radiusKm: radiusStr } = req.query;
      const filters = [];
      if (category && category !== "all") filters.push(eq2(products.category, category));
      if (search) filters.push(or(ilike(products.name, `%${search}%`), ilike(products.brand, `%${search}%`)));
      if (sale === "true") filters.push(eq2(products.isSale, true));
      if (newOnly === "true") filters.push(eq2(products.isNew, true));
      filters.push(...getPublicProductFilters());
      const limit = Math.min(Math.max(parseInt(limitStr ?? "100", 10) || 100, 1), 200);
      const offset = Math.max(parseInt(offsetStr ?? "0", 10) || 0, 0);
      const latitude = toNumber(latStr);
      const longitude = toNumber(lngStr);
      const radiusKm = toNumber(radiusStr);
      const rawRows = await db.select().from(products).where(filters.length > 0 ? and2(...filters) : void 0).orderBy(desc(products.createdAt)).limit(latitude != null && longitude != null ? 500 : limit).offset(latitude != null && longitude != null ? 0 : offset);
      const rows = latitude != null && longitude != null ? withDistance(rawRows, latitude, longitude, radiusKm).slice(offset, offset + limit) : rawRows;
      return res.json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/products/:id", optionalAuth, async (req, res) => {
    const [p] = await db.select().from(products).where(eq2(products.id, param(req, "id"))).limit(1);
    if (!p) return res.status(404).json({ message: "Product not found" });
    const viewer = req.user;
    const canSeeHidden = viewer?.role === "admin" || viewer?.id === p.vendorId;
    if (!canSeeHidden && (!p.inStock || Number(p.stock || 0) <= 0)) return res.status(404).json({ message: "Product not available" });
    return res.json(p);
  });
  app2.post("/api/products", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const schema = z.object({
        name: z.string().min(1),
        brand: z.string().min(1),
        description: z.string().optional(),
        price: z.number().positive(),
        originalPrice: z.number().optional(),
        category: z.string(),
        subcategory: z.string().optional(),
        productType: z.string().optional(),
        sku: z.string().optional(),
        modelNumber: z.string().optional(),
        size: z.string().optional(),
        condition: z.string().optional(),
        warranty: z.string().optional(),
        specs: z.record(z.string()).optional(),
        images: z.array(z.string()).optional(),
        colors: z.array(z.string()).optional(),
        features: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        material: z.string().optional(),
        dimensions: z.string().optional(),
        weight: z.string().optional(),
        location: z.string().optional(),
        area: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        stock: z.number().int().min(0).optional(),
        inStock: z.boolean().optional(),
        isSale: z.boolean().optional(),
        isNew: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        freeShipping: z.boolean().optional(),
        placeholderColor: z.string().optional(),
        placeholderIcon: z.string().optional()
      });
      const data = schema.parse(req.body);
      let vendorProfileForProduct = null;
      if (user.role !== "admin") {
        const [vp] = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, user.id)).limit(1);
        vendorProfileForProduct = vp;
        const primaryCategory = vp?.shopCategory || user.businessType || "general";
        const allowedCategories = /* @__PURE__ */ new Set([primaryCategory, ...Array.isArray(vp?.allowedCategories) ? vp.allowedCategories : []]);
        if (primaryCategory !== "general" && !allowedCategories.has(data.category)) {
          return res.status(403).json({ message: `Your shop profile is set as ${primaryCategory}. Update your vendor profile before posting ${data.category} products.` });
        }
      }
      const stockValue = Number(data.stock ?? 100);
      const cleanImages = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 8) : [];
      const productData = { ...data };
      if (user.role !== "admin") {
        productData.brand = vendorProfileForProduct?.storeName || user.businessName || user.name || data.brand;
        productData.location = vendorProfileForProduct?.location || data.location || user.area || user.city || user.region || "The Gambia";
        productData.area = data.area || user.area || user.city || vendorProfileForProduct?.location || productData.location;
        productData.latitude = data.latitude ?? user.latitude ?? null;
        productData.longitude = data.longitude ?? user.longitude ?? null;
      }
      const [p] = await db.insert(products).values({ ...productData, images: cleanImages, stock: stockValue, inStock: stockValue > 0, vendorId: user.id, rating: 4.5, reviewCount: 0 }).returning();
      return res.status(201).json(p);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.put("/api/products/:id", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const [p] = await db.select().from(products).where(eq2(products.id, param(req, "id"))).limit(1);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (user.role !== "admin" && p.vendorId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const schema = z.object({
        name: z.string().min(1).optional(),
        brand: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        price: z.number().positive().optional(),
        originalPrice: z.number().nullable().optional(),
        category: z.string().optional(),
        subcategory: z.string().optional().nullable(),
        productType: z.string().optional().nullable(),
        sku: z.string().optional().nullable(),
        modelNumber: z.string().optional().nullable(),
        size: z.string().optional().nullable(),
        condition: z.string().optional().nullable(),
        warranty: z.string().optional().nullable(),
        specs: z.record(z.any()).optional(),
        images: z.array(z.string()).optional(),
        colors: z.array(z.string()).optional(),
        features: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        material: z.string().optional().nullable(),
        dimensions: z.string().optional().nullable(),
        weight: z.string().optional().nullable(),
        location: z.string().optional().nullable(),
        area: z.string().optional().nullable(),
        latitude: z.number().optional().nullable(),
        longitude: z.number().optional().nullable(),
        stock: z.number().int().min(0).optional(),
        inStock: z.boolean().optional(),
        isSale: z.boolean().optional(),
        isNew: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        freeShipping: z.boolean().optional(),
        placeholderColor: z.string().optional().nullable(),
        placeholderIcon: z.string().optional().nullable()
      });
      const data = schema.parse(req.body);
      if (user.role !== "admin" && data.category) {
        const [vp] = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, user.id)).limit(1);
        const primaryCategory = vp?.shopCategory || user.businessType || "general";
        const allowedCategories = /* @__PURE__ */ new Set([primaryCategory, ...Array.isArray(vp?.allowedCategories) ? vp.allowedCategories : []]);
        if (primaryCategory !== "general" && !allowedCategories.has(data.category)) {
          return res.status(403).json({ message: `Your shop profile is set as ${primaryCategory}. Update your vendor profile before posting ${data.category} products.` });
        }
      }
      const updateData = { ...data };
      if (user.role !== "admin") {
        const [vp] = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, user.id)).limit(1);
        updateData.brand = vp?.storeName || user.businessName || user.name || p.brand;
        updateData.location = vp?.location || data.location || user.area || user.city || user.region || p.location || "The Gambia";
        updateData.area = data.area || user.area || user.city || vp?.location || p.area || updateData.location;
        updateData.latitude = data.latitude ?? user.latitude ?? p.latitude ?? null;
        updateData.longitude = data.longitude ?? user.longitude ?? p.longitude ?? null;
      }
      if (Array.isArray(updateData.images)) updateData.images = updateData.images.filter(Boolean).slice(0, 8);
      if (typeof updateData.stock === "number") updateData.inStock = updateData.stock > 0;
      const [updated] = await db.update(products).set(updateData).where(eq2(products.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.delete("/api/products/:id", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const [p] = await db.select().from(products).where(eq2(products.id, param(req, "id"))).limit(1);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (user.role !== "admin" && p.vendorId !== user.id) return res.status(403).json({ message: "Forbidden" });
      await db.delete(products).where(eq2(products.id, param(req, "id")));
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/products/vendor/mine", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    const user = req.user;
    const rows = await db.select().from(products).where(eq2(products.vendorId, user.id)).orderBy(desc(products.createdAt));
    return res.json(rows);
  });
  app2.get("/api/services", async (req, res) => {
    const { latitude: latStr, longitude: lngStr, radiusKm: radiusStr, category, limit: limitStr } = req.query;
    const filters = [eq2(services.isAvailable, true)];
    if (category && category !== "all") filters.push(eq2(services.category, category));
    const latitude = toNumber(latStr);
    const longitude = toNumber(lngStr);
    const radiusKm = toNumber(radiusStr);
    const limit = Math.min(Math.max(parseInt(limitStr ?? "100", 10) || 100, 1), 200);
    const rawRows = await db.select().from(services).where(and2(...filters)).orderBy(desc(services.createdAt)).limit(latitude != null && longitude != null ? 500 : limit);
    const rows = latitude != null && longitude != null ? withDistance(rawRows, latitude, longitude, radiusKm).slice(0, limit) : rawRows;
    return res.json(rows);
  });
  app2.get("/api/services/:id", async (req, res) => {
    const [s] = await db.select().from(services).where(eq2(services.id, param(req, "id"))).limit(1);
    if (!s) return res.status(404).json({ message: "Service not found" });
    return res.json(s);
  });
  app2.post("/api/services", requireAuth, requireRole("service_provider", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const schema = z.object({
        name: z.string().min(1),
        description: z.string(),
        price: z.number().positive(),
        priceType: z.enum(["fixed", "hourly", "per_room"]).default("fixed"),
        category: z.string(),
        duration: z.string().optional(),
        features: z.array(z.string()).optional(),
        serviceAreas: z.array(z.string()).optional(),
        area: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        imageUrl: z.string().optional(),
        isFeatured: z.boolean().optional()
      });
      const data = schema.parse(req.body);
      const [s] = await db.insert(services).values({
        ...data,
        area: data.area || user.area || user.city || user.region || "The Gambia",
        latitude: data.latitude ?? user.latitude ?? null,
        longitude: data.longitude ?? user.longitude ?? null,
        providerId: user.id,
        providerName: user.businessName ?? user.name,
        rating: 4.5,
        reviewCount: 0
      }).returning();
      return res.status(201).json(s);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.put("/api/services/:id", requireAuth, requireRole("service_provider", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const [s] = await db.select().from(services).where(eq2(services.id, param(req, "id"))).limit(1);
      if (!s) return res.status(404).json({ message: "Not found" });
      if (user.role !== "admin" && s.providerId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().positive().optional(),
        priceType: z.enum(["fixed", "hourly", "per_room"]).optional(),
        category: z.string().optional(),
        duration: z.string().optional().nullable(),
        features: z.array(z.string()).optional(),
        serviceAreas: z.array(z.string()).optional(),
        area: z.string().optional().nullable(),
        latitude: z.number().optional().nullable(),
        longitude: z.number().optional().nullable(),
        imageUrl: z.string().optional().nullable(),
        isAvailable: z.boolean().optional(),
        isFeatured: z.boolean().optional()
      });
      const data = schema.parse(req.body);
      const updateData = { ...data };
      if (user.role !== "admin") {
        updateData.area = data.area || user.area || user.city || user.region || s.area || "The Gambia";
        updateData.latitude = data.latitude ?? user.latitude ?? s.latitude ?? null;
        updateData.longitude = data.longitude ?? user.longitude ?? s.longitude ?? null;
        updateData.providerName = user.businessName ?? user.name;
      }
      const [updated] = await db.update(services).set(updateData).where(eq2(services.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/services/provider/mine", requireAuth, requireRole("service_provider", "admin"), async (req, res) => {
    const user = req.user;
    const rows = await db.select().from(services).where(eq2(services.providerId, user.id)).orderBy(desc(services.createdAt));
    return res.json(rows);
  });
  app2.get("/api/orders", requireAuth, async (req, res) => {
    const user = req.user;
    if (user.role === "admin") {
      const rows2 = await db.select().from(orders).orderBy(desc(orders.createdAt));
      return res.json(rows2);
    }
    if (user.role === "vendor") {
      const rows2 = await getOrdersForVendor(user.id);
      return res.json(rows2);
    }
    const rows = await db.select().from(orders).where(eq2(orders.userId, user.id)).orderBy(desc(orders.createdAt));
    return res.json(rows);
  });
  app2.get("/api/orders/:id", requireAuth, async (req, res) => {
    const user = req.user;
    const [o] = await db.select().from(orders).where(eq2(orders.id, param(req, "id"))).limit(1);
    if (!o) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && o.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
    return res.json(o);
  });
  app2.post("/api/orders", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const schema = z.object({
        items: z.array(z.object({
          productId: z.string(),
          vendorId: z.string().optional().nullable(),
          name: z.string(),
          price: z.number(),
          quantity: z.number(),
          image: z.string().optional(),
          selectedColor: z.string().optional().nullable(),
          selectedSize: z.string().optional().nullable(),
          selectedVariant: z.string().optional().nullable(),
          selectedOptions: z.record(z.any()).optional(),
          category: z.string().optional().nullable(),
          subcategory: z.string().optional().nullable(),
          sku: z.string().optional().nullable(),
          productType: z.string().optional().nullable(),
          vendorName: z.string().optional().nullable()
        })),
        subtotal: z.number(),
        shipping: z.number(),
        total: z.number(),
        address: z.string(),
        city: z.string(),
        phone: z.string(),
        paymentMethod: z.string(),
        fulfillmentType: z.enum(["delivery", "pickup"]).default("delivery"),
        deliveryLatitude: z.number().optional(),
        deliveryLongitude: z.number().optional(),
        deliveryArea: z.string().optional(),
        notes: z.string().optional()
      });
      const data = schema.parse(req.body);
      const [o] = await db.insert(orders).values({ ...data, userId: user.id, fulfillmentType: data.fulfillmentType }).returning();
      const qrs = await ensureOrderQrs(o.id);
      await db.delete(cartItems).where(eq2(cartItems.userId, user.id));
      await addTracking(o.id, "pending", "Order placed", `Order #${o.id.slice(0, 8).toUpperCase()} was created.`, user, { fulfillmentType: data.fulfillmentType });
      await notifyOrderParties({ ...o, qrCode: qrs.delivery.code }, "New Order Placed", `Order #${o.id.slice(0, 8).toUpperCase()} has been placed.`, "order");
      return res.status(201).json({ ...o, qrCode: qrs.delivery.code, qrs });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.put("/api/orders/:id/status", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const user = req.user;
      const [o] = await db.update(orders).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, param(req, "id"))).returning();
      await addTracking(o.id, status, `Order status updated`, `Order status changed to ${status}.`, user);
      await notifyOrderParties(o, "Order Updated", `Order status changed to ${status}.`, "order");
      return res.json(o);
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/bookings", requireAuth, async (req, res) => {
    const user = req.user;
    let rows;
    if (user.role === "admin") {
      rows = await db.select().from(bookings).orderBy(desc(bookings.createdAt));
    } else if (user.role === "service_provider") {
      rows = await db.select().from(bookings).where(eq2(bookings.providerId, user.id)).orderBy(desc(bookings.createdAt));
    } else {
      rows = await db.select().from(bookings).where(eq2(bookings.userId, user.id)).orderBy(desc(bookings.createdAt));
    }
    return res.json(rows);
  });
  app2.post("/api/bookings", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const schema = z.object({
        serviceId: z.string(),
        serviceName: z.string(),
        date: z.string(),
        time: z.string(),
        address: z.string().optional(),
        notes: z.string().optional(),
        price: z.number(),
        providerId: z.string().optional()
      });
      const data = schema.parse(req.body);
      const [b] = await db.insert(bookings).values({
        ...data,
        userId: user.id,
        userName: user.name
      }).returning();
      await db.insert(notifications).values({
        userId: user.id,
        type: "booking",
        title: "Booking Submitted!",
        body: `Your booking for ${data.serviceName} on ${data.date} at ${data.time} is pending confirmation.`,
        icon: "calendar-outline",
        color: "#7B4FA3",
        actionRoute: "/(tabs)/wishlist"
      });
      return res.status(201).json(b);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.put("/api/bookings/:id/status", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const [b] = await db.update(bookings).set({ status }).where(eq2(bookings.id, param(req, "id"))).returning();
      return res.json(b);
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/cart", requireAuth, async (req, res) => {
    const user = req.user;
    const items = await db.select({ cartItem: cartItems, product: products }).from(cartItems).innerJoin(products, eq2(cartItems.productId, products.id)).where(and2(eq2(cartItems.userId, user.id), eq2(products.inStock, true), gt2(products.stock, 0)));
    return res.json(items);
  });
  app2.post("/api/cart", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const { productId, quantity = 1 } = z.object({ productId: z.string(), quantity: z.number().optional() }).parse(req.body);
      const [product] = await db.select().from(products).where(eq2(products.id, productId)).limit(1);
      if (!product || !product.inStock || Number(product.stock || 0) <= 0) return res.status(400).json({ message: "Product is out of stock" });
      const [existing] = await db.select().from(cartItems).where(and2(eq2(cartItems.userId, user.id), eq2(cartItems.productId, productId))).limit(1);
      if (existing) {
        const [updated] = await db.update(cartItems).set({ quantity: existing.quantity + (quantity ?? 1) }).where(eq2(cartItems.id, existing.id)).returning();
        return res.json(updated);
      }
      const [item] = await db.insert(cartItems).values({ userId: user.id, productId, quantity }).returning();
      return res.status(201).json(item);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid data" });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.put("/api/cart/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const { quantity } = z.object({ quantity: z.number().min(1) }).parse(req.body);
      const [item] = await db.select().from(cartItems).where(eq2(cartItems.id, param(req, "id"))).limit(1);
      if (!item || item.userId !== user.id) return res.status(404).json({ message: "Not found" });
      const [updated] = await db.update(cartItems).set({ quantity }).where(eq2(cartItems.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.delete("/api/cart/:id", requireAuth, async (req, res) => {
    const user = req.user;
    await db.delete(cartItems).where(and2(eq2(cartItems.id, param(req, "id")), eq2(cartItems.userId, user.id)));
    return res.json({ success: true });
  });
  app2.delete("/api/cart", requireAuth, async (req, res) => {
    const user = req.user;
    await db.delete(cartItems).where(eq2(cartItems.userId, user.id));
    return res.json({ success: true });
  });
  app2.get("/api/wishlist", requireAuth, async (req, res) => {
    const user = req.user;
    const items = await db.select({ wishlistItem: wishlistItems, product: products }).from(wishlistItems).innerJoin(products, eq2(wishlistItems.productId, products.id)).where(and2(eq2(wishlistItems.userId, user.id), eq2(products.inStock, true), gt2(products.stock, 0)));
    return res.json(items);
  });
  app2.post("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const { productId } = z.object({ productId: z.string() }).parse(req.body);
      const [existing] = await db.select().from(wishlistItems).where(and2(eq2(wishlistItems.userId, user.id), eq2(wishlistItems.productId, productId))).limit(1);
      if (existing) return res.json(existing);
      const [item] = await db.insert(wishlistItems).values({ userId: user.id, productId }).returning();
      return res.status(201).json(item);
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.delete("/api/wishlist/:productId", requireAuth, async (req, res) => {
    const user = req.user;
    await db.delete(wishlistItems).where(
      and2(eq2(wishlistItems.userId, user.id), eq2(wishlistItems.productId, param(req, "productId")))
    );
    return res.json({ success: true });
  });
  app2.get("/api/reviews/:targetId", async (req, res) => {
    const rows = await db.select().from(reviews).where(eq2(reviews.targetId, param(req, "targetId"))).orderBy(desc(reviews.createdAt));
    return res.json(rows);
  });
  app2.post("/api/reviews", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const schema = z.object({
        targetId: z.string(),
        targetType: z.enum(["product", "service"]),
        rating: z.number().min(1).max(5),
        text: z.string().min(5)
      });
      const data = schema.parse(req.body);
      const [r] = await db.insert(reviews).values({ ...data, userId: user.id, name: user.name }).returning();
      return res.status(201).json(r);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/notifications", requireAuth, async (req, res) => {
    const user = req.user;
    const rows = await db.select().from(notifications).where(eq2(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
    return res.json(rows);
  });
  app2.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const user = req.user;
    await db.update(notifications).set({ isRead: true }).where(and2(eq2(notifications.id, param(req, "id")), eq2(notifications.userId, user.id)));
    return res.json({ success: true });
  });
  app2.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    const user = req.user;
    await db.update(notifications).set({ isRead: true }).where(eq2(notifications.userId, user.id));
    return res.json({ success: true });
  });
  app2.get("/api/admin/stats", requireAuth, requireRole("admin"), async (_req, res) => {
    const [allUsers, allProducts, allServices, allOrders, allBookings] = await Promise.all([
      db.select().from(users),
      db.select().from(products),
      db.select().from(services),
      db.select().from(orders),
      db.select().from(bookings)
    ]);
    const revenue = allOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
    return res.json({
      users: allUsers.length,
      vendors: allUsers.filter((u) => u.role === "vendor").length,
      providers: allUsers.filter((u) => u.role === "service_provider").length,
      products: allProducts.length,
      services: allServices.length,
      orders: allOrders.length,
      bookings: allBookings.length,
      revenue
    });
  });
  app2.get("/api/admin/users", requireAuth, requireRole("admin"), async (req, res) => {
    const { search, role } = req.query;
    let rows = await db.select().from(users).orderBy(desc(users.createdAt));
    if (role && role !== "all") rows = rows.filter((u) => u.role === role);
    if (search) rows = rows.filter(
      (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    );
    return res.json(rows.map(safeUser));
  });
  app2.put("/api/admin/users/:id/role", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { role } = z.object({ role: z.enum(["user", "vendor", "service_provider", "delivery_rider", "admin"]) }).parse(req.body);
      const [u] = await db.update(users).set({ role }).where(eq2(users.id, param(req, "id"))).returning();
      return res.json(safeUser(u));
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.delete("/api/admin/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
    await db.delete(users).where(eq2(users.id, param(req, "id")));
    return res.json({ success: true });
  });
  app2.get("/api/admin/orders", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    return res.json(rows);
  });
  app2.get("/api/admin/bookings", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(bookings).orderBy(desc(bookings.createdAt));
    return res.json(rows);
  });
  app2.get("/api/banners", async (_req, res) => {
    const rows = await db.select().from(banners).where(eq2(banners.isActive, true)).orderBy(banners.sortOrder);
    return res.json(rows);
  });
  app2.get("/api/flash-deals", async (_req, res) => {
    const now = /* @__PURE__ */ new Date();
    const deals = await db.select().from(flashDeals).where(and2(eq2(flashDeals.isActive, true), gt2(flashDeals.endTime, now))).orderBy(desc(flashDeals.discountPercent));
    if (deals.length === 0) return res.json([]);
    const productIds = deals.map((d) => d.productId);
    const prods = await db.select().from(products).where(and2(inArray(products.id, productIds), eq2(products.inStock, true), gt2(products.stock, 0)));
    return res.json(deals.map((d) => ({ ...d, product: prods.find((p) => p.id === d.productId) })).filter((d) => d.product));
  });
  app2.post("/api/activity", optionalAuth, async (req, res) => {
    const user = req.user;
    const { type, targetId, category, searchQuery } = req.body;
    if (user) {
      await db.insert(userActivity).values({ userId: user.id, type, targetId: targetId ?? null, category: category ?? null, searchQuery: searchQuery ?? null }).catch(() => {
      });
    }
    return res.json({ success: true });
  });
  app2.get("/api/recommendations", optionalAuth, async (req, res) => {
    const user = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 12, 24);
    if (user) {
      const activity = await db.select().from(userActivity).where(eq2(userActivity.userId, user.id)).orderBy(desc(userActivity.createdAt)).limit(100);
      const catCounts = {};
      for (const a of activity) {
        if (a.category) catCounts[a.category] = (catCounts[a.category] || 0) + 1;
      }
      const preferredCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 3);
      const viewedIds = activity.filter((a) => a.type === "view" && a.targetId).map((a) => a.targetId);
      if (preferredCats.length > 0) {
        const catProds = await db.select().from(products).where(and2(eq2(products.inStock, true), gt2(products.stock, 0), inArray(products.category, preferredCats))).orderBy(desc(products.soldCount)).limit(limit);
        const filtered = catProds.filter((p) => !viewedIds.includes(p.id));
        if (filtered.length >= 4) return res.json(filtered.slice(0, limit));
      }
    }
    const recs = await db.select().from(products).where(and2(eq2(products.inStock, true), gt2(products.stock, 0), eq2(products.isFeatured, true))).orderBy(desc(products.soldCount)).limit(limit);
    return res.json(recs);
  });
  app2.get("/api/search", async (req, res) => {
    const { q, category, minPrice, maxPrice, minRating, sort, freeShipping, isNew, isSale } = req.query;
    let rows = await db.select().from(products).where(and2(eq2(products.inStock, true), gt2(products.stock, 0)));
    if (q) {
      const ql = q.toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(ql) || p.brand.toLowerCase().includes(ql) || (p.description || "").toLowerCase().includes(ql) || p.category.toLowerCase().includes(ql));
    }
    if (category && category !== "all") rows = rows.filter((p) => p.category === category);
    if (minPrice) rows = rows.filter((p) => p.price >= parseInt(minPrice));
    if (maxPrice) rows = rows.filter((p) => p.price <= parseInt(maxPrice));
    if (minRating) rows = rows.filter((p) => p.rating >= parseFloat(minRating));
    if (freeShipping === "true") rows = rows.filter((p) => p.freeShipping);
    if (isNew === "true") rows = rows.filter((p) => p.isNew);
    if (isSale === "true") rows = rows.filter((p) => p.isSale);
    if (sort === "price_asc") rows.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") rows.sort((a, b) => b.price - a.price);
    else if (sort === "rating") rows.sort((a, b) => b.rating - a.rating);
    else if (sort === "newest") rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else rows.sort((a, b) => b.soldCount - a.soldCount);
    return res.json(rows);
  });
  app2.get("/api/addresses", requireAuth, async (req, res) => {
    const user = req.user;
    const rows = await db.select().from(addresses).where(eq2(addresses.userId, user.id)).orderBy(desc(addresses.isDefault));
    return res.json(rows);
  });
  app2.post("/api/addresses", requireAuth, async (req, res) => {
    const user = req.user;
    const schema = z.object({ label: z.string().default("Home"), fullName: z.string().min(1), phone: z.string().min(1), address: z.string().min(1), city: z.string().min(1), region: z.string().min(1), isDefault: z.boolean().default(false) });
    const data = schema.parse(req.body);
    if (data.isDefault) await db.update(addresses).set({ isDefault: false }).where(eq2(addresses.userId, user.id));
    const [addr] = await db.insert(addresses).values({ ...data, userId: user.id }).returning();
    return res.json(addr);
  });
  app2.put("/api/addresses/:id", requireAuth, async (req, res) => {
    const user = req.user;
    const schema = z.object({ label: z.string().optional(), fullName: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), city: z.string().optional(), region: z.string().optional(), isDefault: z.boolean().optional() });
    const data = schema.parse(req.body);
    if (data.isDefault) await db.update(addresses).set({ isDefault: false }).where(eq2(addresses.userId, user.id));
    const [addr] = await db.update(addresses).set(data).where(and2(eq2(addresses.id, param(req, "id")), eq2(addresses.userId, user.id))).returning();
    return res.json(addr);
  });
  app2.delete("/api/addresses/:id", requireAuth, async (req, res) => {
    const user = req.user;
    await db.delete(addresses).where(and2(eq2(addresses.id, param(req, "id")), eq2(addresses.userId, user.id)));
    return res.json({ success: true });
  });
  app2.get("/api/vendors/me/profile", requireAuth, async (req, res) => {
    const user = req.user;
    const [vp] = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, user.id)).limit(1);
    return res.json(vp || null);
  });
  app2.get("/api/admin/vendors", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select({ profile: vendorProfiles, user: users }).from(vendorProfiles).leftJoin(users, eq2(vendorProfiles.userId, users.id)).orderBy(desc(vendorProfiles.updatedAt));
    const allProducts = await db.select().from(products);
    return res.json(rows.map((r) => {
      const vendorProducts = allProducts.filter((p) => p.vendorId === r.profile.userId);
      const lowStockProducts = vendorProducts.filter((p) => Number(p.stock || 0) <= 5);
      const completenessScore = vendorProfileCompleteness(r.profile, vendorProducts.length);
      const totalStock = vendorProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
      const lastProductAt = vendorProducts.map((p) => p.createdAt).filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
      return {
        ...r.profile,
        user: r.user ? safeUser(r.user) : null,
        productCount: vendorProducts.length,
        activeProductCount: vendorProducts.filter((p) => p.inStock).length,
        lowStockCount: lowStockProducts.length,
        totalStock,
        lastProductAt,
        completenessScore,
        profileHealth: vendorHealthLabel(completenessScore, r.profile.verificationStatus),
        tracking: {
          category: r.profile.shopCategory,
          verificationStatus: r.profile.verificationStatus,
          totalSales: r.profile.totalSales,
          totalRevenue: r.profile.totalRevenue,
          rating: r.profile.rating,
          productCount: vendorProducts.length,
          lowStockCount: lowStockProducts.length,
          completenessScore
        }
      };
    }));
  });
  app2.get("/api/vendors/:id", async (req, res) => {
    const [vp] = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, param(req, "id"))).limit(1);
    if (!vp) return res.status(404).json({ message: "Vendor not found" });
    const [vendorUser] = await db.select().from(users).where(eq2(users.id, param(req, "id"))).limit(1);
    const vendorProducts = await db.select().from(products).where(and2(eq2(products.vendorId, param(req, "id")), eq2(products.inStock, true), gt2(products.stock, 0))).orderBy(desc(products.soldCount));
    const vendorReviews = await db.select().from(reviews).where(and2(eq2(reviews.targetId, param(req, "id")), eq2(reviews.targetType, "vendor"))).orderBy(desc(reviews.createdAt)).limit(10);
    return res.json({ ...vp, vendorName: vendorUser?.name, products: vendorProducts, reviews: vendorReviews, productCount: vendorProducts.length });
  });
  app2.put("/api/vendors/profile", requireAuth, requireRole("vendor"), async (req, res) => {
    const user = req.user;
    const schema = z.object({
      storeName: z.string().optional(),
      shopCategory: z.string().optional(),
      allowedCategories: z.array(z.string()).optional(),
      subcategories: z.array(z.string()).optional(),
      description: z.string().optional(),
      coverImage: z.string().optional(),
      logo: z.string().optional(),
      location: z.string().optional(),
      operatingHours: z.string().optional(),
      deliveryZones: z.array(z.string()).optional(),
      supportPhone: z.string().optional(),
      supportEmail: z.string().email().optional().or(z.literal("")),
      minOrderAmount: z.number().int().min(0).optional(),
      returnPolicy: z.string().optional(),
      shippingPolicy: z.string().optional(),
      whatsapp: z.string().optional(),
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      businessRegistrationNo: z.string().optional(),
      taxNumber: z.string().optional(),
      bankName: z.string().optional(),
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      mobileMoneyProvider: z.string().optional(),
      mobileMoneyNumber: z.string().optional(),
      internalNotes: z.string().optional()
    });
    const data = schema.parse(req.body);
    const existing = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, user.id)).limit(1);
    if (existing.length === 0) {
      const [vp2] = await db.insert(vendorProfiles).values({ userId: user.id, storeName: data.storeName || user.businessName || user.name, ...data }).returning();
      return res.json(vp2);
    }
    const current = existing[0];
    const isLockedVerified = current.verificationStatus === "verified" || current.profileEditLocked === true;
    if (isLockedVerified) {
      const [vp2] = await db.update(vendorProfiles).set({
        pendingProfileChanges: data,
        profileChangeStatus: "pending",
        profileChangeNote: null,
        profileChangeRequestedAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(vendorProfiles.userId, user.id)).returning();
      await db.insert(notifications).values({
        userId: user.id,
        type: "profile_change_request",
        title: "Profile update request submitted",
        body: "Your store is verified, so profile changes must be approved by admin before they go live.",
        icon: "shield-checkmark",
        color: "#0EA47A"
      });
      return res.json({ ...vp2, changeRequestSubmitted: true, message: "Profile change request submitted for admin approval." });
    }
    const [vp] = await db.update(vendorProfiles).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(vendorProfiles.userId, user.id)).returning();
    return res.json(vp);
  });
  app2.get("/api/providers/me/profile", requireAuth, async (req, res) => {
    const user = req.user;
    const [pp] = await db.select().from(providerProfiles).where(eq2(providerProfiles.userId, user.id)).limit(1);
    return res.json(pp || null);
  });
  app2.get("/api/providers/:id", async (req, res) => {
    const [pp] = await db.select().from(providerProfiles).where(eq2(providerProfiles.userId, param(req, "id"))).limit(1);
    if (!pp) return res.status(404).json({ message: "Provider not found" });
    const providerServices = await db.select().from(services).where(eq2(services.providerId, param(req, "id")));
    const providerReviews = await db.select().from(reviews).where(and2(eq2(reviews.targetId, param(req, "id")), eq2(reviews.targetType, "provider"))).orderBy(desc(reviews.createdAt)).limit(10);
    return res.json({ ...pp, services: providerServices, reviews: providerReviews, serviceCount: providerServices.length });
  });
  app2.put("/api/providers/profile", requireAuth, requireRole("service_provider"), async (req, res) => {
    const user = req.user;
    const schema = z.object({ displayName: z.string().optional(), bio: z.string().optional(), location: z.string().optional(), serviceAreas: z.array(z.string()).optional(), certifications: z.array(z.string()).optional(), whatsapp: z.string().optional(), responseTime: z.string().optional() });
    const data = schema.parse(req.body);
    const existing = await db.select().from(providerProfiles).where(eq2(providerProfiles.userId, user.id)).limit(1);
    if (existing.length === 0) {
      const [pp2] = await db.insert(providerProfiles).values({ userId: user.id, displayName: data.displayName || user.businessName || user.name, ...data }).returning();
      return res.json(pp2);
    }
    const [pp] = await db.update(providerProfiles).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(providerProfiles.userId, user.id)).returning();
    return res.json(pp);
  });
  app2.post("/api/coupons/validate", requireAuth, async (req, res) => {
    const { code, orderTotal } = req.body;
    if (!code) return res.status(400).json({ message: "Coupon code required" });
    const [coupon] = await db.select().from(coupons).where(and2(eq2(coupons.code, code.toUpperCase()), eq2(coupons.isActive, true))).limit(1);
    if (!coupon) return res.status(404).json({ message: "Invalid coupon code" });
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return res.status(400).json({ message: "Coupon usage limit reached" });
    if (coupon.expiresAt && /* @__PURE__ */ new Date() > coupon.expiresAt) return res.status(400).json({ message: "Coupon has expired" });
    if (coupon.minOrder && orderTotal < coupon.minOrder) return res.status(400).json({ message: `Min order D${coupon.minOrder} required` });
    const discount = coupon.type === "percent" ? Math.round(orderTotal * (coupon.value / 100)) : coupon.value;
    return res.json({ valid: true, coupon, discount: Math.min(discount, orderTotal), description: coupon.description });
  });
  app2.get("/api/reviews/:targetType/:targetId", async (req, res) => {
    const rows = await db.select().from(reviews).where(and2(eq2(reviews.targetId, param(req, "targetId")), eq2(reviews.targetType, param(req, "targetType")))).orderBy(desc(reviews.createdAt)).limit(50);
    return res.json(rows);
  });
  app2.post("/api/reviews/:targetType/:targetId", requireAuth, async (req, res) => {
    const user = req.user;
    const targetType = param(req, "targetType");
    const targetId = param(req, "targetId");
    const { rating, text: text2 } = z.object({ rating: z.number().min(1).max(5), text: z.string().min(5) }).parse(req.body);
    const [rev] = await db.insert(reviews).values({ userId: user.id, targetId, targetType, name: user.name, rating, text: text2, verified: true }).returning();
    return res.json(rev);
  });
  app2.post("/api/reviews/:id/helpful", requireAuth, async (req, res) => {
    const [rev] = await db.select().from(reviews).where(eq2(reviews.id, param(req, "id"))).limit(1);
    if (!rev) return res.status(404).json({ message: "Review not found" });
    const [updated] = await db.update(reviews).set({ helpful: rev.helpful + 1 }).where(eq2(reviews.id, param(req, "id"))).returning();
    return res.json(updated);
  });
  app2.get("/api/profile/me", requireAuth, async (req, res) => {
    const user = req.user;
    const [u] = await db.select().from(users).where(eq2(users.id, user.id)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    const [[oc], [wc], [bc]] = await Promise.all([
      db.select({ value: count() }).from(orders).where(eq2(orders.userId, u.id)),
      db.select({ value: count() }).from(wishlistItems).where(eq2(wishlistItems.userId, u.id)),
      db.select({ value: count() }).from(bookings).where(eq2(bookings.userId, u.id))
    ]);
    return res.json({ ...safeUser(u), stats: { orders: Number(oc.value), wishlist: Number(wc.value), bookings: Number(bc.value) } });
  });
  app2.put("/api/profile", requireAuth, async (req, res) => {
    const user = req.user;
    const schema = z.object({ name: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), city: z.string().optional(), region: z.string().optional(), gender: z.string().optional(), dateOfBirth: z.string().optional(), bio: z.string().optional(), businessName: z.string().optional(), businessType: z.string().optional(), avatar: z.string().optional() });
    const data = schema.parse(req.body);
    if (isPersonalProfileLocked(user)) {
      const u2 = await submitPersonalProfileChange(user, data);
      return res.json({ ...safeUser(u2), changeRequestSubmitted: true, message: "Your verified personal details are locked. Changes were sent to admin for approval." });
    }
    const [u] = await db.update(users).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id)).returning();
    return res.json(safeUser(u));
  });
  app2.put("/api/profile/documents", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const { documents, avatar } = z.object({
        documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string(), uploadedAt: z.string().optional(), status: z.string().optional() })).optional(),
        avatar: z.string().optional()
      }).parse(req.body);
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (documents) {
        updateData.personalDocuments = documents.map((d) => ({ ...d, status: d.status || "submitted", uploadedAt: d.uploadedAt || (/* @__PURE__ */ new Date()).toISOString() }));
        if (user.verificationStatus === "not_submitted") updateData.verificationStatus = "pending";
      }
      if (avatar) {
        if (isPersonalProfileLocked(user)) {
          updateData.pendingProfileChanges = { ...user.pendingProfileChanges || {}, avatar };
          updateData.profileChangeStatus = "pending";
          updateData.profileChangeRequestedAt = /* @__PURE__ */ new Date();
        } else {
          updateData.avatar = avatar;
        }
      }
      const [u] = await db.update(users).set(updateData).where(eq2(users.id, user.id)).returning();
      return res.json(safeUser(u));
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.put("/api/profile/change-password", requireAuth, async (req, res) => {
    const user = req.user;
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string(), newPassword: z.string().min(6) }).parse(req.body);
    const [u] = await db.select().from(users).where(eq2(users.id, user.id)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    const valid = await comparePassword(currentPassword, u.password);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
    const hashed = await hashPassword(newPassword);
    await db.update(users).set({ password: hashed, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
    return res.json({ success: true });
  });
  app2.get("/api/admin/verifications", requireAuth, requireRole("admin"), async (_req, res) => {
    const pendingPersonal = await db.select().from(users).where(eq2(users.verificationStatus, "pending"));
    const pendingVendors = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.verificationStatus, "pending"));
    const pendingProviders = await db.select().from(providerProfiles).where(eq2(providerProfiles.verificationStatus, "pending"));
    const pendingRiders = await db.select().from(deliveryRiders).where(eq2(deliveryRiders.verificationStatus, "pending"));
    const allIds = [
      ...pendingVendors.map((v) => v.userId),
      ...pendingProviders.map((p) => p.userId),
      ...pendingRiders.map((r) => r.userId)
    ];
    const allUsers = allIds.length > 0 ? await db.select().from(users).where(inArray(users.id, allIds)) : [];
    return res.json([
      ...pendingPersonal.map((u) => ({ ...safeUser(u), type: "personal", userId: u.id, user: safeUser(u) })),
      ...pendingVendors.map((v) => ({ ...v, type: "vendor", user: allUsers.find((u) => u.id === v.userId) })),
      ...pendingProviders.map((p) => ({ ...p, type: "provider", user: allUsers.find((u) => u.id === p.userId) })),
      ...pendingRiders.map((r) => ({ ...r, type: "rider", user: allUsers.find((u) => u.id === r.userId) }))
    ]);
  });
  app2.put("/api/admin/verify/personal/:userId", requireAuth, requireRole("admin"), async (req, res) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [u] = await db.update(users).set({ verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified", profileChangeNote: note, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, param(req, "userId"))).returning();
    if (!u) return res.status(404).json({ message: "User not found" });
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "\u{1F389} Profile Verified!" : "Verification Update", body: status === "verified" ? "Your personal profile has been verified. Future personal changes require admin approval." : `Verification update: ${note || "Please resubmit your documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(safeUser(u));
  });
  app2.put("/api/admin/verify/vendor/:userId", requireAuth, requireRole("admin"), async (req, res) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [vp] = await db.update(vendorProfiles).set({ verificationStatus: status, verificationNote: note, profileEditLocked: status === "verified", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(vendorProfiles.userId, param(req, "userId"))).returning();
    if (!vp) return res.status(404).json({ message: "Vendor profile not found" });
    await db.update(users).set({ role: "vendor", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq2(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "\u{1F389} Store Verified!" : "Verification Update", body: status === "verified" ? "Your store has been verified! You can now sell on MansaMart." : `Verification update: ${note || "Please resubmit your documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(vp);
  });
  app2.put("/api/admin/verify/provider/:userId", requireAuth, requireRole("admin"), async (req, res) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [pp] = await db.update(providerProfiles).set({ verificationStatus: status, verificationNote: note }).where(eq2(providerProfiles.userId, param(req, "userId"))).returning();
    if (!pp) return res.status(404).json({ message: "Provider profile not found" });
    await db.update(users).set({ role: "service_provider", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq2(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "\u{1F389} Profile Verified!" : "Verification Update", body: status === "verified" ? "Your provider profile has been verified!" : `Update: ${note || "Please resubmit documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(pp);
  });
  app2.put("/api/admin/verify/rider/:userId", requireAuth, requireRole("admin"), async (req, res) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [rider] = await db.update(deliveryRiders).set({ verificationStatus: status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, param(req, "userId"))).returning();
    if (!rider) return res.status(404).json({ message: "Rider profile not found" });
    await db.update(users).set({ role: "delivery_rider", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq2(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "Rider Approved" : "Rider Application Update", body: status === "verified" ? "You can now receive delivery requests on MansaMart." : note || "Your rider application was not approved.", icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(rider);
  });
  app2.get("/api/admin/personal-profile-change-requests", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(users).where(eq2(users.profileChangeStatus, "pending")).orderBy(desc(users.profileChangeRequestedAt));
    return res.json(rows.map((u) => ({ ...safeUser(u), type: "personal_change" })));
  });
  app2.put("/api/admin/personal-profile-change/:userId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { action, note } = z.object({ action: z.enum(["approve", "reject"]), note: z.string().optional() }).parse(req.body);
      const [u] = await db.select().from(users).where(eq2(users.id, param(req, "userId"))).limit(1);
      if (!u) return res.status(404).json({ message: "User not found" });
      const pending = u.pendingProfileChanges || {};
      const updateData = { profileChangeReviewedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
      if (action === "approve") {
        Object.assign(updateData, pending, { pendingProfileChanges: {}, profileChangeStatus: "approved", profileChangeNote: note || "Approved" });
      } else {
        Object.assign(updateData, { profileChangeStatus: "rejected", profileChangeNote: note || "Rejected" });
      }
      const [updated] = await db.update(users).set(updateData).where(eq2(users.id, param(req, "userId"))).returning();
      return res.json(safeUser(updated));
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/admin/vendor-profile-change-requests", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select({ profile: vendorProfiles, user: users }).from(vendorProfiles).leftJoin(users, eq2(vendorProfiles.userId, users.id)).where(eq2(vendorProfiles.profileChangeStatus, "pending")).orderBy(desc(vendorProfiles.profileChangeRequestedAt));
    return res.json(rows.map((r) => ({ ...r.profile, user: r.user ? safeUser(r.user) : null })));
  });
  app2.put("/api/admin/vendor-profile-change/:userId", requireAuth, requireRole("admin"), async (req, res) => {
    const { action, note } = z.object({ action: z.enum(["approve", "reject"]), note: z.string().optional() }).parse(req.body);
    const userId = param(req, "userId");
    const [profile] = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, userId)).limit(1);
    if (!profile) return res.status(404).json({ message: "Vendor profile not found" });
    const pending = profile.pendingProfileChanges || {};
    const updateData = {
      profileChangeStatus: action === "approve" ? "approved" : "rejected",
      profileChangeNote: note || null,
      profileChangeReviewedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (action === "approve") {
      Object.assign(updateData, pending);
      updateData.pendingProfileChanges = {};
    }
    const [updated] = await db.update(vendorProfiles).set(updateData).where(eq2(vendorProfiles.userId, userId)).returning();
    await db.insert(notifications).values({
      userId,
      type: "profile_change_review",
      title: action === "approve" ? "Profile changes approved" : "Profile changes rejected",
      body: action === "approve" ? "Your requested store profile changes are now live." : note || "Your requested profile changes were not approved.",
      icon: action === "approve" ? "checkmark-circle" : "close-circle",
      color: action === "approve" ? "#0EA47A" : "#E63946"
    });
    return res.json(updated);
  });
  app2.get("/api/admin/verifications/count", requireAuth, requireRole("admin"), async (_req, res) => {
    const [uc] = await db.select({ value: count() }).from(users).where(eq2(users.verificationStatus, "pending"));
    const [vc] = await db.select({ value: count() }).from(vendorProfiles).where(eq2(vendorProfiles.verificationStatus, "pending"));
    const [pc] = await db.select({ value: count() }).from(providerProfiles).where(eq2(providerProfiles.verificationStatus, "pending"));
    const [cc] = await db.select({ value: count() }).from(vendorProfiles).where(eq2(vendorProfiles.profileChangeStatus, "pending"));
    const [ucc] = await db.select({ value: count() }).from(users).where(eq2(users.profileChangeStatus, "pending"));
    return res.json({ total: Number(uc.value) + Number(vc.value) + Number(pc.value) + Number(cc.value) + Number(ucc.value), personal: Number(uc.value), vendors: Number(vc.value), providers: Number(pc.value), profileChanges: Number(cc.value) + Number(ucc.value) });
  });
  app2.get("/api/vendor/dashboard", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const [profile] = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, user.id)).limit(1);
      const vendorProducts = await db.select().from(products).where(eq2(products.vendorId, user.id)).orderBy(desc(products.createdAt));
      const vendorOrders = await getOrdersForVendor(user.id);
      const revenue = vendorOrders.filter((o) => o.status !== "cancelled").reduce((sum, o) => {
        const vendorProductIds = new Set(vendorProducts.map((p) => p.id));
        const orderTotal = o.items.filter((i) => vendorProductIds.has(i.productId)).reduce((s, i) => s + Number(i.price) * Number(i.quantity || 1), 0);
        return sum + orderTotal;
      }, 0);
      const lowStock = vendorProducts.filter((p) => p.stock <= 5).slice(0, 10);
      const categoryStats = Object.values(vendorProducts.reduce((acc, p) => {
        const key = p.category || "Other";
        acc[key] = acc[key] || { category: key, products: 0, revenue: 0, sold: 0 };
        acc[key].products += 1;
        acc[key].sold += p.soldCount || 0;
        return acc;
      }, {}));
      const completenessScore = vendorProfileCompleteness(profile, vendorProducts.length);
      const stats = {
        products: vendorProducts.length,
        activeProducts: vendorProducts.filter((p) => p.inStock).length,
        lowStock: lowStock.length,
        orders: vendorOrders.length,
        pendingOrders: vendorOrders.filter((o) => o.status === "pending" || o.status === "processing").length,
        revenue,
        avgRating: vendorProducts.length ? Number((vendorProducts.reduce((s, p) => s + p.rating, 0) / vendorProducts.length).toFixed(1)) : 0,
        completenessScore,
        profileHealth: vendorHealthLabel(completenessScore, profile?.verificationStatus)
      };
      return res.json({ profile, stats, lowStock, categoryStats, recentOrders: vendorOrders.slice(0, 8), recentProducts: vendorProducts.slice(0, 8) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to load vendor dashboard" });
    }
  });
  app2.get("/api/vendor/low-stock", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    const user = req.user;
    const rows = await db.select().from(products).where(eq2(products.vendorId, user.id)).orderBy(products.stock);
    return res.json(rows.filter((p) => p.stock <= 10));
  });
  app2.put("/api/vendor/products/:id/stock", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const { stock } = z.object({ stock: z.number().int().min(0) }).parse(req.body);
      const [product] = await db.select().from(products).where(and2(eq2(products.id, param(req, "id")), eq2(products.vendorId, user.id))).limit(1);
      if (!product && user.role !== "admin") return res.status(404).json({ message: "Product not found" });
      const [updated] = await db.update(products).set({ stock, inStock: stock > 0 }).where(eq2(products.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/shopper/me", requireAuth, async (req, res) => {
    const user = req.user;
    const [profile] = await db.select().from(shopperProfiles).where(eq2(shopperProfiles.userId, user.id)).limit(1);
    const [[orderCount], [wishCount], [bookingCount]] = await Promise.all([
      db.select({ value: count() }).from(orders).where(eq2(orders.userId, user.id)),
      db.select({ value: count() }).from(wishlistItems).where(eq2(wishlistItems.userId, user.id)),
      db.select({ value: count() }).from(bookings).where(eq2(bookings.userId, user.id))
    ]);
    const userOrders = await db.select().from(orders).where(eq2(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(5);
    return res.json({
      profile,
      stats: { orders: Number(orderCount.value), wishlist: Number(wishCount.value), bookings: Number(bookingCount.value), loyaltyPoints: user.loyaltyPoints || 0 },
      recentOrders: userOrders
    });
  });
  app2.put("/api/shopper/me", requireAuth, async (req, res) => {
    const user = req.user;
    const data = z.object({
      preferredCategories: z.array(z.string()).optional(),
      preferredLocation: z.string().optional(),
      defaultDeliveryAddress: z.string().optional(),
      defaultPhone: z.string().optional(),
      notes: z.string().optional()
    }).parse(req.body);
    const [existing] = await db.select().from(shopperProfiles).where(eq2(shopperProfiles.userId, user.id)).limit(1);
    if (!existing) {
      const [created] = await db.insert(shopperProfiles).values({ userId: user.id, ...data }).returning();
      return res.json(created);
    }
    const [updated] = await db.update(shopperProfiles).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(shopperProfiles.userId, user.id)).returning();
    return res.json(updated);
  });
  app2.get("/api/vendor/flash-deals", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const vendorProds = await db.select().from(products).where(eq2(products.vendorId, user.id));
      const productIds = vendorProds.map((p) => p.id);
      if (productIds.length === 0) return res.json([]);
      const deals = await db.select().from(flashDeals).where(
        and2(inArray(flashDeals.productId, productIds), eq2(flashDeals.isActive, true))
      ).orderBy(desc(flashDeals.createdAt));
      const dealsWithProducts = deals.map((d) => ({ ...d, product: vendorProds.find((p) => p.id === d.productId) }));
      return res.json(dealsWithProducts);
    } catch {
      return res.json([]);
    }
  });
  app2.post("/api/vendor/flash-deals", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const { productId, dealPrice, discountPercent, durationHours } = z.object({
        productId: z.string(),
        dealPrice: z.number().positive(),
        discountPercent: z.number().min(1).max(99),
        durationHours: z.number().min(1).max(168)
      }).parse(req.body);
      const [product] = await db.select().from(products).where(and2(eq2(products.id, productId), eq2(products.vendorId, user.id))).limit(1);
      if (!product) return res.status(404).json({ message: "Product not found or not yours" });
      const startTime = /* @__PURE__ */ new Date();
      const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1e3);
      const [deal] = await db.insert(flashDeals).values({
        productId,
        dealPrice,
        discountPercent,
        originalPrice: product.price,
        startTime,
        endTime,
        isActive: true
      }).returning();
      return res.status(201).json({ ...deal, product });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.delete("/api/vendor/flash-deals/:id", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const [deal] = await db.select().from(flashDeals).where(eq2(flashDeals.id, param(req, "id"))).limit(1);
      if (!deal) return res.status(404).json({ message: "Not found" });
      await db.update(flashDeals).set({ isActive: false }).where(eq2(flashDeals.id, param(req, "id")));
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/vendor/promote/:id", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const [product] = await db.select().from(products).where(and2(eq2(products.id, param(req, "id")), eq2(products.vendorId, user.id))).limit(1);
      if (!product) return res.status(404).json({ message: "Product not found or not yours" });
      const [updated] = await db.update(products).set({ isFeatured: true }).where(eq2(products.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.put("/api/vendors/me/documents", requireAuth, requireRole("vendor"), async (req, res) => {
    try {
      const user = req.user;
      const { documents, logo, coverImage } = z.object({
        documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string(), uploadedAt: z.string().optional(), status: z.string().optional() })).optional(),
        logo: z.string().optional(),
        coverImage: z.string().optional()
      }).parse(req.body);
      const existing = await db.select().from(vendorProfiles).where(eq2(vendorProfiles.userId, user.id)).limit(1);
      if (!existing.length) return res.status(404).json({ message: "Vendor profile not found" });
      const current = existing[0];
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (documents) {
        updateData.documents = documents.map((d) => ({ ...d, status: d.status || "submitted", uploadedAt: d.uploadedAt || (/* @__PURE__ */ new Date()).toISOString() }));
        if (current.verificationStatus === "not_submitted") updateData.verificationStatus = "pending";
      }
      if (logo || coverImage) {
        if (current.verificationStatus === "verified" || current.profileEditLocked === true) {
          updateData.pendingProfileChanges = { ...current.pendingProfileChanges || {}, ...logo ? { logo } : {}, ...coverImage ? { coverImage } : {} };
          updateData.profileChangeStatus = "pending";
          updateData.profileChangeRequestedAt = /* @__PURE__ */ new Date();
        } else {
          if (logo) updateData.logo = logo;
          if (coverImage) updateData.coverImage = coverImage;
        }
      }
      const [vp] = await db.update(vendorProfiles).set(updateData).where(eq2(vendorProfiles.userId, user.id)).returning();
      if (!vp) return res.status(404).json({ message: "Vendor profile not found" });
      return res.json(vp);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.put("/api/providers/me/documents", requireAuth, requireRole("service_provider"), async (req, res) => {
    try {
      const user = req.user;
      const { certifications, documents, profileImage, coverImage } = z.object({
        certifications: z.array(z.string()).optional(),
        documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string() })).optional(),
        profileImage: z.string().optional(),
        coverImage: z.string().optional()
      }).parse(req.body);
      const [pp] = await db.update(providerProfiles).set({ ...certifications ? { certifications } : {}, ...documents ? { documents } : {}, ...profileImage ? { profileImage } : {}, ...coverImage ? { coverImage } : {}, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(providerProfiles.userId, user.id)).returning();
      if (!pp) return res.status(404).json({ message: "Provider profile not found" });
      return res.json(pp);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  async function getOrCreateWallet(userId) {
    const [existing] = await db.select().from(wallets).where(eq2(wallets.userId, userId)).limit(1);
    if (existing) return existing;
    const [created] = await db.insert(wallets).values({ userId, balance: 0, pendingBalance: 0, lockedBalance: 0 }).returning();
    return created;
  }
  async function addWalletTransaction2(args) {
    const wallet = await getOrCreateWallet(args.userId);
    const before = wallet.balance;
    const after = args.direction === "credit" ? before + args.amount : before - args.amount;
    if (after < 0) throw new Error("Insufficient wallet balance");
    const [updatedWallet] = await db.update(wallets).set({ balance: after, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(wallets.id, wallet.id)).returning();
    const [tx] = await db.insert(transactions).values({
      walletId: wallet.id,
      userId: args.userId,
      orderId: args.orderId,
      bookingId: args.bookingId,
      type: args.type,
      direction: args.direction,
      amount: args.amount,
      balanceBefore: before,
      balanceAfter: after,
      status: args.status ?? "completed",
      method: args.method,
      reference: args.reference,
      description: args.description
    }).returning();
    return { wallet: updatedWallet, transaction: tx };
  }
  app2.get("/api/wallet", requireAuth, async (req, res) => {
    const user = req.user;
    const wallet = await getOrCreateWallet(user.id);
    const recent = await db.select().from(transactions).where(eq2(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(30);
    return res.json({ wallet, transactions: recent });
  });
  app2.post("/api/wallet/deposit/manual", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const { amount, method, reference } = z.object({
        amount: z.number().int().positive(),
        method: z.string().default("manual_mobile_money"),
        reference: z.string().optional()
      }).parse(req.body);
      const wallet = await getOrCreateWallet(user.id);
      const [tx] = await db.insert(transactions).values({
        walletId: wallet.id,
        userId: user.id,
        type: "deposit",
        direction: "credit",
        amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        status: "pending",
        method,
        reference,
        description: "Manual wallet top-up awaiting admin confirmation"
      }).returning();
      await db.insert(notifications).values({ userId: user.id, type: "wallet", title: "Deposit Submitted", body: `Your wallet top-up of D ${amount.toLocaleString()} is pending confirmation.`, icon: "wallet-outline", color: "#0EA47A" });
      return res.status(201).json(tx);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/wallet/pay-order/:orderId", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const [order] = await db.select().from(orders).where(and2(eq2(orders.id, param(req, "orderId")), eq2(orders.userId, user.id))).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      await addWalletTransaction2({ userId: user.id, type: "escrow_payment", direction: "debit", amount: order.total, orderId: order.id, description: `Escrow payment for order #${order.id.slice(0, 8).toUpperCase()}` });
      const vendorTotals = await calculateVendorTotalsFromDb(order);
      const productAmount = Object.values(vendorTotals).reduce((a, b) => a + b, 0);
      const commissionAmount = Math.round(productAmount * 0.05);
      await db.insert(escrowTransactions).values({
        orderId: order.id,
        payerId: user.id,
        amount: order.total,
        productAmount,
        deliveryFee: order.shipping || 0,
        commissionAmount,
        vendorAmount: Math.max(0, productAmount - commissionAmount),
        riderAmount: order.shipping || 0,
        status: "held",
        method: "wallet"
      }).catch(() => {
      });
      const qrs = await ensureOrderQrs(order.id);
      const [updated] = await db.update(orders).set({ paymentMethod: "wallet", paymentStatus: "paid", escrowStatus: "held", status: "paid", qrCode: qrs.delivery.code, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, order.id)).returning();
      await addTracking(order.id, "paid", "Payment received", "Funds are held in MansaMart escrow until delivery is verified.", user);
      await notifyOrderParties(updated, "Payment Received", "Payment is confirmed and held in escrow.", "payment");
      return res.json({ order: updated, paid: true, escrow: "held", qrs });
    } catch (err) {
      if (err.message === "Insufficient wallet balance") return res.status(400).json({ message: err.message });
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/payouts", requireAuth, requireRole("vendor", "service_provider", "delivery_rider"), async (req, res) => {
    try {
      const user = req.user;
      const { amount, method, accountName, accountNumber } = z.object({ amount: z.number().int().positive(), method: z.string(), accountName: z.string().optional(), accountNumber: z.string().optional() }).parse(req.body);
      const wallet = await getOrCreateWallet(user.id);
      if (wallet.balance < amount) return res.status(400).json({ message: "Insufficient wallet balance" });
      const [payout] = await db.insert(payouts).values({ userId: user.id, amount, method, accountName, accountNumber, status: "pending" }).returning();
      return res.status(201).json(payout);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/admin/wallet/deposits", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(transactions).where(and2(eq2(transactions.type, "deposit"), eq2(transactions.status, "pending"))).orderBy(desc(transactions.createdAt));
    return res.json(rows);
  });
  app2.put("/api/admin/wallet/deposits/:id/confirm", requireAuth, requireRole("admin"), async (req, res) => {
    const [tx] = await db.select().from(transactions).where(eq2(transactions.id, param(req, "id"))).limit(1);
    if (!tx || tx.status !== "pending" || !tx.userId) return res.status(404).json({ message: "Pending deposit not found" });
    const wallet = await getOrCreateWallet(tx.userId);
    const after = wallet.balance + tx.amount;
    await db.update(wallets).set({ balance: after, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(wallets.id, wallet.id));
    const [updated] = await db.update(transactions).set({ status: "completed", balanceBefore: wallet.balance, balanceAfter: after }).where(eq2(transactions.id, tx.id)).returning();
    await db.insert(notifications).values({ userId: tx.userId, type: "wallet", title: "Deposit Confirmed", body: `D ${tx.amount.toLocaleString()} has been added to your wallet.`, icon: "wallet", color: "#0EA47A" });
    return res.json(updated);
  });
  app2.get("/api/admin/commissions", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(commissions).orderBy(desc(commissions.createdAt)).limit(100);
    return res.json(rows);
  });
  app2.get("/api/admin/settlements", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(settlements).orderBy(desc(settlements.createdAt)).limit(100);
    return res.json(rows);
  });
  app2.get("/api/admin/payouts", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(payouts).orderBy(desc(payouts.createdAt)).limit(100);
    return res.json(rows);
  });
  const riderDocumentSchema = z.object({
    type: z.string(),
    url: z.string(),
    name: z.string(),
    uploadedAt: z.string().optional(),
    status: z.string().optional()
  });
  const riderProfileSchema = z.object({
    displayName: z.string().optional(),
    bio: z.string().optional(),
    profilePhoto: z.string().optional(),
    coverImage: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    currentAddress: z.string().optional(),
    homeAddress: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    region: z.string().optional(),
    area: z.string().optional(),
    serviceZones: z.array(z.string()).optional(),
    vehicleType: z.string().optional(),
    vehicleModel: z.string().optional(),
    vehicleColor: z.string().optional(),
    vehiclePlate: z.string().optional(),
    vehicleRegistrationNo: z.string().optional(),
    licenseNumber: z.string().optional(),
    drivingLicenseExpiry: z.string().optional(),
    nationalIdNumber: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    payoutMethod: z.string().optional(),
    mobileMoneyProvider: z.string().optional(),
    mobileMoneyNumber: z.string().optional(),
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    internalNotes: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    documents: z.array(riderDocumentSchema).optional()
  });
  async function ensureRiderProfile(user) {
    const [existing] = await db.select().from(deliveryRiders).where(eq2(deliveryRiders.userId, user.id)).limit(1);
    if (existing) return existing;
    const [created] = await db.insert(deliveryRiders).values({
      userId: user.id,
      displayName: user.businessName || user.name,
      bio: user.bio || void 0,
      phone: user.phone || void 0,
      whatsapp: user.phone || void 0,
      currentAddress: user.address || void 0,
      city: user.city || void 0,
      region: user.region || void 0,
      area: user.area || void 0,
      serviceZones: [user.city || user.region || user.area || "The Gambia"].filter(Boolean),
      vehicleType: user.businessType || "motorbike",
      profilePhoto: user.avatar || void 0,
      latitude: user.latitude,
      longitude: user.longitude,
      isOnline: false,
      isAvailable: false
    }).returning();
    return created;
  }
  app2.get("/api/rider/me/profile", requireAuth, requireRole("delivery_rider", "admin"), async (req, res) => {
    const user = req.user;
    const profile = await ensureRiderProfile(user);
    const completion = await computeProfileCompletion(user);
    return res.json({ ...profile, user: safeUser(user), completion });
  });
  app2.put("/api/rider/profile", requireAuth, requireRole("delivery_rider"), async (req, res) => {
    try {
      const user = req.user;
      await ensureRiderProfile(user);
      const data = riderProfileSchema.parse(req.body);
      const [profile] = await db.update(deliveryRiders).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, user.id)).returning();
      await db.update(users).set({
        role: "delivery_rider",
        ...data.displayName ? { businessName: data.displayName } : {},
        ...data.bio ? { bio: data.bio } : {},
        ...data.phone ? { phone: data.phone } : {},
        ...data.currentAddress ? { address: data.currentAddress } : {},
        ...data.city ? { city: data.city } : {},
        ...data.region ? { region: data.region } : {},
        ...data.area ? { area: data.area } : {},
        ...data.profilePhoto ? { avatar: data.profilePhoto } : {},
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(users.id, user.id)).catch(() => {
      });
      const completion = await computeProfileCompletion({ ...user, avatar: data.profilePhoto || user.avatar, phone: data.phone || user.phone, address: data.currentAddress || user.address });
      return res.json({ ...profile, completion });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "Rider profile update failed" });
    }
  });
  app2.put("/api/rider/me/documents", requireAuth, requireRole("delivery_rider"), async (req, res) => {
    try {
      const user = req.user;
      await ensureRiderProfile(user);
      const data = z.object({
        documents: z.array(riderDocumentSchema).optional(),
        profilePhoto: z.string().optional(),
        coverImage: z.string().optional()
      }).parse(req.body);
      const [profile] = await db.update(deliveryRiders).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, user.id)).returning();
      if (data.profilePhoto) await db.update(users).set({ avatar: data.profilePhoto, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id)).catch(() => {
      });
      const completion = await computeProfileCompletion(user);
      return res.json({ ...profile, completion });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "Rider documents update failed" });
    }
  });
  app2.post("/api/rider/apply", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const data = z.object({ vehicleType: z.string().default("motorbike"), vehiclePlate: z.string().optional(), licenseNumber: z.string().optional(), documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string() })).optional() }).parse(req.body);
      const [existing] = await db.select().from(deliveryRiders).where(eq2(deliveryRiders.userId, user.id)).limit(1);
      if (existing) return res.json(existing);
      const [profile] = await db.insert(deliveryRiders).values({ ...data, userId: user.id }).returning();
      await db.update(users).set({ role: "delivery_rider", verificationStatus: "pending" }).where(eq2(users.id, user.id));
      return res.status(201).json(profile);
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/rider/me", requireAuth, requireRole("delivery_rider", "admin"), async (req, res) => {
    const user = req.user;
    const profile = await ensureRiderProfile(user);
    const activeDeliveries = await db.select().from(deliveries).where(eq2(deliveries.riderId, user.id)).orderBy(desc(deliveries.createdAt)).limit(20);
    const offers = await db.select().from(deliveryRequests).where(and2(eq2(deliveryRequests.riderId, user.id), eq2(deliveryRequests.status, "offered"))).orderBy(desc(deliveryRequests.createdAt)).limit(20);
    const completion = await computeProfileCompletion(user);
    return res.json({ profile, activeDeliveries, offers, completion });
  });
  app2.put("/api/rider/status", requireAuth, requireRole("delivery_rider"), async (req, res) => {
    const user = req.user;
    const { isOnline, isAvailable, latitude, longitude } = z.object({ isOnline: z.boolean().optional(), isAvailable: z.boolean().optional(), latitude: z.number().optional(), longitude: z.number().optional() }).parse(req.body);
    const [profile] = await db.update(deliveryRiders).set({ ...isOnline != null ? { isOnline } : {}, ...isAvailable != null ? { isAvailable } : {}, ...latitude != null ? { latitude } : {}, ...longitude != null ? { longitude } : {}, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, user.id)).returning();
    return res.json(profile);
  });
  app2.post("/api/delivery/dispatch", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const { orderId, pickupAddress, pickupLatitude, pickupLongitude, dropoffAddress, dropoffLatitude, dropoffLongitude, deliveryFee } = z.object({
        orderId: z.string(),
        pickupAddress: z.string(),
        pickupLatitude: z.number().optional(),
        pickupLongitude: z.number().optional(),
        dropoffAddress: z.string(),
        dropoffLatitude: z.number().optional(),
        dropoffLongitude: z.number().optional(),
        deliveryFee: z.number().int().default(0)
      }).parse(req.body);
      const [delivery] = await db.insert(deliveries).values({ orderId, pickupAddress, pickupLatitude, pickupLongitude, dropoffAddress, dropoffLatitude, dropoffLongitude, deliveryFee, status: "searching" }).returning();
      const riders = await db.select().from(deliveryRiders).where(and2(eq2(deliveryRiders.isOnline, true), eq2(deliveryRiders.isAvailable, true), eq2(deliveryRiders.verificationStatus, "verified")));
      const nearest = riders.map((r) => ({ ...r, distance: distanceKm(r.latitude, r.longitude, pickupLatitude, pickupLongitude) })).sort((a, b) => a.distance - b.distance).slice(0, 5);
      for (const rider of nearest) {
        await db.insert(deliveryRequests).values({ deliveryId: delivery.id, riderId: rider.userId, distanceKm: rider.distance, status: "offered", expiresAt: new Date(Date.now() + 6e4) });
        await db.insert(notifications).values({ userId: rider.userId, type: "delivery", title: "New Delivery Request", body: `Pickup: ${pickupAddress}. Fee: D ${deliveryFee.toLocaleString()}`, icon: "bicycle-outline", color: "#E8813A", actionRoute: "/(rider)/" });
      }
      await db.update(orders).set({ status: "rider_searching", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, orderId));
      return res.status(201).json({ delivery, offeredRiders: nearest.length });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/delivery/requests/:id/accept", requireAuth, requireRole("delivery_rider"), async (req, res) => {
    const user = req.user;
    const [request] = await db.select().from(deliveryRequests).where(and2(eq2(deliveryRequests.id, param(req, "id")), eq2(deliveryRequests.riderId, user.id))).limit(1);
    if (!request || request.status !== "offered") return res.status(404).json({ message: "Delivery offer not available" });
    const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.id, request.deliveryId)).limit(1);
    if (!delivery || delivery.status !== "searching") return res.status(400).json({ message: "Delivery already assigned" });
    await db.update(deliveryRequests).set({ status: "cancelled" }).where(eq2(deliveryRequests.deliveryId, delivery.id));
    const [acceptedReq] = await db.update(deliveryRequests).set({ status: "accepted", respondedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRequests.id, request.id)).returning();
    const [updatedDelivery] = await db.update(deliveries).set({ riderId: user.id, status: "assigned", acceptedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveries.id, delivery.id)).returning();
    await db.update(deliveryRiders).set({ isAvailable: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, user.id));
    await db.update(orders).set({ status: "rider_assigned", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, delivery.orderId));
    return res.json({ request: acceptedReq, delivery: updatedDelivery });
  });
  app2.put("/api/delivery/:id/status", requireAuth, requireRole("delivery_rider", "admin"), async (req, res) => {
    const user = req.user;
    const { status } = z.object({ status: z.enum(["picked_up", "in_transit", "delivered", "failed", "cancelled"]) }).parse(req.body);
    const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.id, param(req, "id"))).limit(1);
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });
    if (user.role !== "admin" && delivery.riderId !== user.id) return res.status(403).json({ message: "Forbidden" });
    const extra = { status, updatedAt: /* @__PURE__ */ new Date() };
    if (status === "picked_up") extra.pickedUpAt = /* @__PURE__ */ new Date();
    if (status === "delivered") extra.deliveredAt = /* @__PURE__ */ new Date();
    const [updated] = await db.update(deliveries).set(extra).where(eq2(deliveries.id, delivery.id)).returning();
    if (status === "delivered") {
      await db.update(orders).set({ status: "delivered", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, delivery.orderId));
      if (delivery.riderId) await db.update(deliveryRiders).set({ isAvailable: true, completedDeliveries: sql2`${deliveryRiders.completedDeliveries} + 1`, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, delivery.riderId));
    }
    return res.json(updated);
  });
  app2.get("/api/admin/riders", requireAuth, requireRole("admin"), async (_req, res) => {
    const rows = await db.select({ rider: deliveryRiders, user: users }).from(deliveryRiders).innerJoin(users, eq2(deliveryRiders.userId, users.id)).orderBy(desc(deliveryRiders.createdAt));
    return res.json(rows.map((r) => ({ ...r.rider, user: safeUser(r.user) })));
  });
  app2.put("/api/admin/riders/:userId/verify", requireAuth, requireRole("admin"), async (req, res) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [rider] = await db.update(deliveryRiders).set({ verificationStatus: status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, param(req, "userId"))).returning();
    if (!rider) return res.status(404).json({ message: "Rider profile not found" });
    await db.update(users).set({ role: "delivery_rider", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq2(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "Rider Approved" : "Rider Application Update", body: status === "verified" ? "You can now receive delivery requests." : note || "Your rider application was not approved.", icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(rider);
  });
  app2.post("/api/support/tickets", requireAuth, async (req, res) => {
    const user = req.user;
    const { subject, message, priority } = z.object({ subject: z.string().min(3), message: z.string().min(5), priority: z.string().default("normal") }).parse(req.body);
    const [ticket] = await db.insert(supportTickets).values({ userId: user.id, subject, message, priority }).returning();
    return res.status(201).json(ticket);
  });
  app2.get("/api/conversations", requireAuth, async (req, res) => {
    const user = req.user;
    const rows = await db.select().from(messages).where(eq2(messages.senderId, user.id)).orderBy(desc(messages.createdAt)).limit(50);
    return res.json(rows);
  });
  app2.get("/api/orders/:id/tracking", requireAuth, async (req, res) => {
    const user = req.user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq2(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const parties = await getOrderParties(order);
    const allowed = user.role === "admin" || order.userId === user.id || order.riderId === user.id || parties.vendorIds.includes(user.id);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    const events = await db.select().from(orderTrackingEvents).where(eq2(orderTrackingEvents.orderId, orderId)).orderBy(desc(orderTrackingEvents.createdAt));
    const qrs = await db.select().from(orderQrCodes).where(eq2(orderQrCodes.orderId, orderId)).orderBy(desc(orderQrCodes.createdAt));
    const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.orderId, orderId)).limit(1);
    const latestRiderLocation = delivery?.riderId ? await db.select().from(riderLocations).where(eq2(riderLocations.riderId, delivery.riderId)).orderBy(desc(riderLocations.createdAt)).limit(1) : [];
    return res.json({ order, events, qrs, delivery: delivery || null, riderLocation: latestRiderLocation[0] || null });
  });
  app2.post("/api/orders/:id/confirm-payment", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const orderId = param(req, "id");
      const [order] = await db.select().from(orders).where(eq2(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (user.role !== "admin" && order.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const { method, reference } = z.object({ method: z.string().default("wallet"), reference: z.string().optional() }).parse(req.body || {});
      if (method === "wallet") {
        await addWalletTransaction2({ userId: order.userId, type: "escrow_payment", direction: "debit", amount: order.total, orderId: order.id, description: `Escrow payment for order #${order.id.slice(0, 8).toUpperCase()}` });
      }
      const vendorTotals = await calculateVendorTotalsFromDb(order);
      const productAmount = Object.values(vendorTotals).reduce((a, b) => a + b, 0);
      const commissionAmount = Math.round(productAmount * 0.05);
      await db.insert(escrowTransactions).values({
        orderId: order.id,
        payerId: order.userId,
        amount: order.total,
        productAmount,
        deliveryFee: order.shipping || 0,
        commissionAmount,
        vendorAmount: Math.max(0, productAmount - commissionAmount),
        riderAmount: order.shipping || 0,
        status: "held",
        method,
        reference
      }).catch(() => {
      });
      const qrs = await ensureOrderQrs(order.id);
      const [updated] = await db.update(orders).set({ status: "paid", paymentStatus: "paid", escrowStatus: "held", qrCode: qrs.delivery.code, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, order.id)).returning();
      await addTracking(order.id, "paid", "Payment received", "Funds are now held securely by MansaMart escrow.", user);
      await notifyOrderParties(updated, "Payment Received", "Payment is confirmed and held securely in escrow.", "payment");
      return res.json({ order: updated, qrs });
    } catch (err) {
      if (err.message === "Insufficient wallet balance") return res.status(400).json({ message: err.message });
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/orders/:id/confirm-vendor", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    const user = req.user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq2(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const parties = await getOrderParties(order);
    if (user.role !== "admin" && !parties.vendorIds.includes(user.id)) return res.status(403).json({ message: "Forbidden" });
    const [updated] = await db.update(orders).set({ status: "confirmed", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, order.id)).returning();
    await addTracking(order.id, "confirmed", "Order confirmed", "Vendor confirmed the order.", user);
    await notifyOrderParties(updated, "Order Confirmed", "Vendor has confirmed your order.", "order");
    return res.json(updated);
  });
  app2.post("/api/orders/:id/ready-for-pickup", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    const user = req.user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq2(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const parties = await getOrderParties(order);
    if (user.role !== "admin" && !parties.vendorIds.includes(user.id)) return res.status(403).json({ message: "Forbidden" });
    await ensureOrderQrs(order.id);
    const [updated] = await db.update(orders).set({ status: "ready_for_pickup", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, order.id)).returning();
    await addTracking(order.id, "ready_for_pickup", "Order ready", "Vendor marked the order as ready.", user);
    await notifyOrderParties(updated, "Order Ready", "Your order is ready for pickup/delivery.", "order");
    return res.json(updated);
  });
  app2.post("/api/orders/:id/dispatch-rider", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
    try {
      const user = req.user;
      const orderId = param(req, "id");
      const [order] = await db.select().from(orders).where(eq2(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const parties = await getOrderParties(order);
      if (user.role !== "admin" && !parties.vendorIds.includes(user.id)) return res.status(403).json({ message: "Forbidden" });
      const body = z.object({ pickupAddress: z.string().optional(), pickupLatitude: z.number().optional(), pickupLongitude: z.number().optional(), deliveryFee: z.number().int().optional() }).parse(req.body || {});
      const pickupAddress = body.pickupAddress || "Vendor location";
      const [delivery] = await db.insert(deliveries).values({
        orderId: order.id,
        pickupAddress,
        pickupLatitude: body.pickupLatitude,
        pickupLongitude: body.pickupLongitude,
        dropoffAddress: `${order.address}, ${order.city}`,
        dropoffLatitude: order.deliveryLatitude,
        dropoffLongitude: order.deliveryLongitude,
        deliveryFee: body.deliveryFee ?? order.shipping ?? 0,
        status: "searching"
      }).returning();
      const riders = await db.select().from(deliveryRiders).where(and2(eq2(deliveryRiders.isOnline, true), eq2(deliveryRiders.isAvailable, true), eq2(deliveryRiders.verificationStatus, "verified")));
      const nearest = riders.map((r) => ({ ...r, distance: distanceKm(r.latitude, r.longitude, body.pickupLatitude, body.pickupLongitude) })).sort((a, b) => a.distance - b.distance).slice(0, 5);
      for (const rider of nearest) {
        await db.insert(deliveryRequests).values({ deliveryId: delivery.id, riderId: rider.userId, distanceKm: rider.distance, status: "offered", expiresAt: new Date(Date.now() + 6e4) });
        await notifyUser(rider.userId, "delivery", "New Delivery Request", `Pickup: ${pickupAddress}. Fee: D ${delivery.deliveryFee.toLocaleString()}`, "/(rider)", { deliveryId: delivery.id, orderId: order.id });
      }
      const [updated] = await db.update(orders).set({ status: "searching_rider", fulfillmentType: "delivery", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, order.id)).returning();
      await addTracking(order.id, "searching_rider", "Searching for rider", `${nearest.length} riders were notified.`, user, { deliveryId: delivery.id, offeredRiders: nearest.length });
      return res.status(201).json({ order: updated, delivery, offeredRiders: nearest.length });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.post("/api/delivery-requests/:id/accept", requireAuth, requireRole("delivery_rider"), async (req, res) => {
    const user = req.user;
    const [request] = await db.select().from(deliveryRequests).where(and2(eq2(deliveryRequests.id, param(req, "id")), eq2(deliveryRequests.riderId, user.id))).limit(1);
    if (!request || request.status !== "offered") return res.status(404).json({ message: "Delivery offer not available" });
    const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.id, request.deliveryId)).limit(1);
    if (!delivery || delivery.status !== "searching") return res.status(400).json({ message: "Delivery already assigned" });
    await db.update(deliveryRequests).set({ status: "cancelled" }).where(eq2(deliveryRequests.deliveryId, delivery.id));
    const [acceptedReq] = await db.update(deliveryRequests).set({ status: "accepted", respondedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRequests.id, request.id)).returning();
    const [updatedDelivery] = await db.update(deliveries).set({ riderId: user.id, status: "assigned", acceptedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveries.id, delivery.id)).returning();
    const [updatedOrder] = await db.update(orders).set({ status: "rider_assigned", riderId: user.id, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, delivery.orderId)).returning();
    await db.update(deliveryRiders).set({ isAvailable: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, user.id));
    await addTracking(delivery.orderId, "rider_assigned", "Rider assigned", `${user.name} accepted the delivery.`, user, { deliveryId: delivery.id });
    await notifyOrderParties(updatedOrder, "Rider Assigned", `${user.name} has accepted the delivery.`, "delivery");
    return res.json({ request: acceptedReq, delivery: updatedDelivery, order: updatedOrder });
  });
  app2.post("/api/orders/:id/confirm-pickup-qr", requireAuth, requireRole("vendor", "delivery_rider", "admin"), async (req, res) => {
    const user = req.user;
    const orderId = param(req, "id");
    const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
    const [qr] = await db.select().from(orderQrCodes).where(and2(eq2(orderQrCodes.orderId, orderId), eq2(orderQrCodes.code, code), eq2(orderQrCodes.purpose, "pickup"), eq2(orderQrCodes.status, "active"))).limit(1);
    if (!qr) return res.status(400).json({ message: "Invalid or expired pickup QR code" });
    const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.orderId, orderId)).limit(1);
    const [order] = await db.update(orders).set({ status: "picked_up", pickupConfirmedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, orderId)).returning();
    if (delivery) await db.update(deliveries).set({ status: "picked_up", pickedUpAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveries.id, delivery.id));
    await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: /* @__PURE__ */ new Date(), status: "used" }).where(eq2(orderQrCodes.id, qr.id));
    await addTracking(orderId, "picked_up", "Order picked up", "QR verification confirmed rider/vendor handover.", user, { qrId: qr.id });
    await notifyOrderParties(order, "Order Picked Up", "Your order has been picked up by the rider.", "delivery");
    return res.json({ order, verified: true });
  });
  app2.post("/api/orders/:id/confirm-delivery-qr", requireAuth, async (req, res) => {
    const user = req.user;
    const orderId = param(req, "id");
    const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
    const [orderBefore] = await db.select().from(orders).where(eq2(orders.id, orderId)).limit(1);
    if (!orderBefore) return res.status(404).json({ message: "Order not found" });
    if (user.role !== "admin" && orderBefore.userId !== user.id && orderBefore.riderId !== user.id) return res.status(403).json({ message: "Forbidden" });
    const [qr] = await db.select().from(orderQrCodes).where(and2(eq2(orderQrCodes.orderId, orderId), eq2(orderQrCodes.code, code), eq2(orderQrCodes.purpose, "delivery"), eq2(orderQrCodes.status, "active"))).limit(1);
    if (!qr) return res.status(400).json({ message: "Invalid or expired delivery QR code" });
    const [order] = await db.update(orders).set({ status: "delivered", deliveryConfirmedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, orderId)).returning();
    const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.orderId, orderId)).limit(1);
    if (delivery) await db.update(deliveries).set({ status: "delivered", deliveredAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveries.id, delivery.id));
    await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: /* @__PURE__ */ new Date(), status: "used" }).where(eq2(orderQrCodes.id, qr.id));
    await addTracking(orderId, "delivered", "Order delivered", "Shopper/rider QR verification confirmed delivery.", user, { qrId: qr.id });
    await notifyOrderParties(order, "Order Delivered", "Delivery has been verified. Releasing payment now.", "delivery");
    const released = await releaseEscrowForOrder(order, user);
    return res.json({ order, delivered: true, settlement: released });
  });
  app2.post("/api/orders/verify-qr", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
      const [qr] = await db.select().from(orderQrCodes).where(and2(eq2(orderQrCodes.code, code.trim()), eq2(orderQrCodes.status, "active"))).limit(1);
      if (!qr) return res.status(400).json({ message: "Invalid, expired, or already used QR code" });
      const [orderBefore] = await db.select().from(orders).where(eq2(orders.id, qr.orderId)).limit(1);
      if (!orderBefore) return res.status(404).json({ message: "Order not found" });
      const parties = await getOrderParties(orderBefore);
      if (qr.purpose === "pickup") {
        const allowed = user.role === "admin" || user.role === "delivery_rider" || parties.vendorIds.includes(user.id);
        if (!allowed) return res.status(403).json({ message: "Only the vendor, assigned rider, or admin can confirm pickup" });
        const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.orderId, orderBefore.id)).limit(1);
        const [order] = await db.update(orders).set({ status: "picked_up", pickupConfirmedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, orderBefore.id)).returning();
        if (delivery) await db.update(deliveries).set({ status: "picked_up", pickedUpAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveries.id, delivery.id));
        await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: /* @__PURE__ */ new Date(), status: "used" }).where(eq2(orderQrCodes.id, qr.id));
        await addTracking(order.id, "picked_up", "Order picked up", "QR verification confirmed vendor-to-rider handover.", user, { qrId: qr.id });
        await notifyOrderParties(order, "Order Picked Up", "Your order has been collected by the rider.", "delivery");
        return res.json({ verified: true, purpose: "pickup", message: "Pickup confirmed", order });
      }
      if (qr.purpose === "delivery") {
        const allowed = user.role === "admin" || orderBefore.userId === user.id || orderBefore.riderId === user.id;
        if (!allowed) return res.status(403).json({ message: "Only the shopper, assigned rider, or admin can confirm delivery" });
        const [order] = await db.update(orders).set({ status: "delivered", deliveryConfirmedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(orders.id, orderBefore.id)).returning();
        const [delivery] = await db.select().from(deliveries).where(eq2(deliveries.orderId, orderBefore.id)).limit(1);
        if (delivery) await db.update(deliveries).set({ status: "delivered", deliveredAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveries.id, delivery.id));
        await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: /* @__PURE__ */ new Date(), status: "used" }).where(eq2(orderQrCodes.id, qr.id));
        await addTracking(order.id, "delivered", "Order delivered", "QR verification confirmed successful delivery.", user, { qrId: qr.id });
        await notifyOrderParties(order, "Order Delivered", "Delivery has been verified. Settlement can now be processed.", "delivery");
        const settlement = await releaseEscrowForOrder(order, user).catch(() => null);
        return res.json({ verified: true, purpose: "delivery", message: "Delivery confirmed", order, settlement });
      }
      return res.status(400).json({ message: "Unsupported QR code purpose" });
    } catch (err) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "QR verification failed" });
    }
  });
  app2.post("/api/orders/:id/complete-and-release-payment", requireAuth, async (req, res) => {
    const user = req.user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq2(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (user.role !== "admin" && order.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
    const result = await releaseEscrowForOrder(order, user);
    return res.json(result);
  });
  app2.get("/api/rider/dashboard", requireAuth, requireRole("delivery_rider", "admin"), async (req, res) => {
    const user = req.user;
    const profile = await ensureRiderProfile(user);
    const offers = await db.select().from(deliveryRequests).where(and2(eq2(deliveryRequests.riderId, user.id), eq2(deliveryRequests.status, "offered"))).orderBy(desc(deliveryRequests.createdAt)).limit(30);
    const activeDeliveries = await db.select().from(deliveries).where(and2(eq2(deliveries.riderId, user.id), ne(deliveries.status, "delivered"), ne(deliveries.status, "cancelled"))).orderBy(desc(deliveries.createdAt)).limit(30);
    const history = await db.select().from(deliveries).where(eq2(deliveries.riderId, user.id)).orderBy(desc(deliveries.createdAt)).limit(50);
    const earningRows = await db.select().from(riderEarnings).where(eq2(riderEarnings.riderId, user.id)).orderBy(desc(riderEarnings.createdAt)).limit(50);
    const totalEarnings = earningRows.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const completion = await computeProfileCompletion(user);
    return res.json({ profile, offers, activeDeliveries, history, earnings: earningRows, totalEarnings, completion, metrics: { completed: profile?.completedDeliveries || 0, rating: profile?.rating || 0 } });
  });
  app2.post("/api/rider/location", requireAuth, requireRole("delivery_rider"), async (req, res) => {
    const user = req.user;
    const { latitude, longitude, accuracy, heading, speed, deliveryId } = z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional(), heading: z.number().optional(), speed: z.number().optional(), deliveryId: z.string().optional() }).parse(req.body);
    const [loc] = await db.insert(riderLocations).values({ riderId: user.id, deliveryId, latitude, longitude, accuracy, heading, speed }).returning();
    await db.update(deliveryRiders).set({ latitude, longitude, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(deliveryRiders.userId, user.id));
    emitRealtime("rider:location", { riderId: user.id, deliveryId, latitude, longitude, accuracy, heading, speed, createdAt: loc.createdAt }, deliveryId ? [`delivery:${deliveryId}`, "role:admin"] : ["role:admin"]);
    return res.status(201).json(loc);
  });
  app2.get("/api/admin/orders/live", requireAuth, requireRole("admin"), async (_req, res) => {
    const liveOrders = await db.select().from(orders).orderBy(desc(orders.updatedAt)).limit(100);
    const liveDeliveries = await db.select().from(deliveries).orderBy(desc(deliveries.updatedAt)).limit(100);
    const recentEvents = await db.select().from(orderTrackingEvents).orderBy(desc(orderTrackingEvents.createdAt)).limit(100);
    return res.json({ orders: liveOrders, deliveries: liveDeliveries, events: recentEvents });
  });
  app2.get("/api/profile/completion", requireAuth, async (req, res) => {
    const user = req.user;
    const result = await computeProfileCompletion(user);
    return res.json(result);
  });
  const httpServer = createServer(app2);
  try {
    const { Server: SocketIOServer } = await import("socket.io");
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          const allowed = socketCorsOrigins();
          const normalizedOrigin = origin?.replace(/\/$/, "");
          const isLocalhost = normalizedOrigin?.startsWith("http://localhost:") || normalizedOrigin?.startsWith("http://127.0.0.1:");
          if (!origin || isLocalhost || allowed.includes(normalizedOrigin || "")) return callback(null, true);
          return callback(new Error("Socket.IO origin not allowed"));
        },
        credentials: true
      }
    });
    io.use(async (socket, next) => {
      try {
        const authToken = socket.handshake?.auth?.token;
        const headerToken = String(socket.handshake?.headers?.authorization || "").replace(/^Bearer\s+/i, "");
        const token = authToken || headerToken;
        const user = token ? await getSessionUser(token) : null;
        if (user) {
          socket.data.user = safeSocketUser(user);
          socket.join(`user:${user.id}`);
          socket.join(`role:${user.role}`);
        }
        next();
      } catch (error) {
        next(error);
      }
    });
    io.on("connection", (socket) => {
      socket.on("order:join", (orderId) => {
        if (orderId) socket.join(`order:${orderId}`);
      });
      socket.on("delivery:join", (deliveryId) => {
        if (deliveryId) socket.join(`delivery:${deliveryId}`);
      });
    });
    realtimeEmitter = (event, payload, rooms = []) => {
      if (!rooms.length) {
        io.emit(event, payload);
        return;
      }
      for (const room of rooms) io.to(room).emit(event, payload);
    };
    console.log("Socket.IO realtime server enabled.");
  } catch (error) {
    console.warn("Socket.IO realtime server not enabled:", error?.message || error);
  }
  return httpServer;
}

// server/startup-migrations.ts
async function execSafe(sql3, label) {
  try {
    await pool.query(sql3);
  } catch (error) {
    console.warn(`[startup-migration skipped] ${label}: ${error?.message || error}`);
  }
}
async function runStartupMigrations() {
  await execSafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`, "pgcrypto extension");
  await execSafe(`ALTER TYPE role ADD VALUE IF NOT EXISTS 'delivery_rider';`, "role delivery_rider enum");
  await execSafe(`ALTER TYPE role ADD VALUE IF NOT EXISTS 'admin';`, "role admin enum");
  for (const status of [
    "paid",
    "confirmed",
    "processing",
    "preparing",
    "ready_for_pickup",
    "searching_rider",
    "rider_searching",
    "rider_assigned",
    "rider_arrived_vendor",
    "picked_up",
    "on_the_way",
    "shipped",
    "delivered",
    "completed",
    "cancelled",
    "refunded"
  ]) {
    await execSafe(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS '${status}';`, `order_status ${status}`);
  }
  await execSafe(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS region text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS area text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS location_accuracy real;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS business_type text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pin text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_documents jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_submitted';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_edit_locked boolean NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_change_status text NOT NULL DEFAULT 'none';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_profile_changes jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_change_note text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_change_requested_at timestamp;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_change_reviewed_at timestamp;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent integer NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "users compatibility columns");
  await execSafe(`
    CREATE TABLE IF NOT EXISTS sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) ON DELETE CASCADE,
      token text UNIQUE,
      expires_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token text UNIQUE;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at timestamp;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
  `, "sessions auth compatibility table");
  await execSafe(`
    CREATE TABLE IF NOT EXISTS notifications (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) ON DELETE CASCADE,
      type text NOT NULL DEFAULT 'system',
      title text NOT NULL,
      body text NOT NULL,
      icon text,
      color text,
      action_route text,
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'system';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS icon text;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS color text;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_route text;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
  `, "notifications compatibility table");
  await execSafe(`
    CREATE TABLE IF NOT EXISTS vendor_profiles (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      store_name text NOT NULL,
      shop_category text NOT NULL DEFAULT 'general',
      allowed_categories jsonb DEFAULT '[]'::jsonb,
      subcategories jsonb DEFAULT '[]'::jsonb,
      description text,
      cover_image text,
      logo text,
      location text,
      operating_hours text,
      delivery_zones jsonb DEFAULT '[]'::jsonb,
      support_phone text,
      support_email text,
      min_order_amount integer NOT NULL DEFAULT 0,
      return_policy text DEFAULT '7-day return policy for all items.',
      shipping_policy text DEFAULT 'Delivery within 2-5 business days across The Gambia.',
      total_sales integer NOT NULL DEFAULT 0,
      total_revenue integer NOT NULL DEFAULT 0,
      rating real NOT NULL DEFAULT 4.5,
      review_count integer NOT NULL DEFAULT 0,
      verification_status text NOT NULL DEFAULT 'pending',
      verification_note text,
      documents jsonb DEFAULT '[]'::jsonb,
      profile_edit_locked boolean NOT NULL DEFAULT false,
      profile_change_status text NOT NULL DEFAULT 'none',
      pending_profile_changes jsonb DEFAULT '{}'::jsonb,
      profile_change_note text,
      profile_change_requested_at timestamp,
      profile_change_reviewed_at timestamp,
      whatsapp text,
      facebook text,
      instagram text,
      business_registration_no text,
      tax_number text,
      bank_name text,
      account_name text,
      account_number text,
      mobile_money_provider text,
      mobile_money_number text,
      internal_notes text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS store_name text NOT NULL DEFAULT 'Store';
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS shop_category text NOT NULL DEFAULT 'general';
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS allowed_categories jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS subcategories jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS description text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS cover_image text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS logo text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS location text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS delivery_zones jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS whatsapp text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS mobile_money_number text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS account_number text;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "vendor_profiles compatibility table");
  await execSafe(`
    CREATE TABLE IF NOT EXISTS provider_profiles (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name text NOT NULL,
      bio text,
      profile_image text,
      cover_image text,
      location text,
      service_areas jsonb DEFAULT '["Banjul", "Serrekunda"]'::jsonb,
      portfolio jsonb DEFAULT '[]'::jsonb,
      certifications jsonb DEFAULT '[]'::jsonb,
      total_jobs integer NOT NULL DEFAULT 0,
      total_earnings integer NOT NULL DEFAULT 0,
      rating real NOT NULL DEFAULT 4.5,
      review_count integer NOT NULL DEFAULT 0,
      verification_status text NOT NULL DEFAULT 'pending',
      verification_note text,
      documents jsonb DEFAULT '[]'::jsonb,
      response_time text DEFAULT '< 1 hour',
      whatsapp text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT 'Provider';
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS profile_image text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS cover_image text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS location text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS service_areas jsonb DEFAULT '["Banjul", "Serrekunda"]'::jsonb;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS whatsapp text;
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "provider_profiles compatibility table");
  await execSafe(`
    CREATE TABLE IF NOT EXISTS delivery_riders (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name text,
      bio text,
      profile_photo text,
      cover_image text,
      phone text,
      whatsapp text,
      current_address text,
      home_address text,
      city text,
      district text,
      region text,
      area text,
      service_zones jsonb DEFAULT '[]'::jsonb,
      vehicle_type text NOT NULL DEFAULT 'motorbike',
      vehicle_model text,
      vehicle_color text,
      vehicle_plate text,
      vehicle_registration_no text,
      license_number text,
      driving_license_expiry text,
      national_id_number text,
      emergency_contact_name text,
      emergency_contact_phone text,
      payout_method text,
      mobile_money_provider text,
      mobile_money_number text,
      bank_name text,
      account_name text,
      account_number text,
      internal_notes text,
      documents jsonb DEFAULT '[]'::jsonb,
      verification_status text NOT NULL DEFAULT 'pending',
      is_online boolean NOT NULL DEFAULT false,
      is_available boolean NOT NULL DEFAULT false,
      latitude real,
      longitude real,
      completed_deliveries integer NOT NULL DEFAULT 0,
      total_deliveries integer NOT NULL DEFAULT 0,
      total_earnings integer NOT NULL DEFAULT 0,
      rating real NOT NULL DEFAULT 5,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS display_name text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS profile_photo text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS cover_image text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS whatsapp text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS current_address text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS home_address text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS district text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS region text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS area text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS service_zones jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_type text NOT NULL DEFAULT 'motorbike';
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_model text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_color text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_plate text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS vehicle_registration_no text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS license_number text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS driving_license_expiry text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS national_id_number text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS emergency_contact_name text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS payout_method text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS mobile_money_provider text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS mobile_money_number text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS bank_name text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS account_name text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS account_number text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS internal_notes text;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT false;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS completed_deliveries integer NOT NULL DEFAULT 0;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS total_deliveries integer NOT NULL DEFAULT 0;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS total_earnings integer NOT NULL DEFAULT 0;
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "delivery_riders compatibility table");
  await execSafe(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS area text;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 10;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;
  `, "products compatibility columns");
  await execSafe(`
    ALTER TABLE services ADD COLUMN IF NOT EXISTS service_areas jsonb DEFAULT '["Banjul", "Serrekunda", "Kanifing"]'::jsonb;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS area text;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS latitude real;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS longitude real;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
  `, "services compatibility columns");
  await execSafe(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'delivery';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'not_started';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_code text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_secret text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_id varchar REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamp;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamp;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamp;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude real;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude real;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_area text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount integer NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `, "orders compatibility columns");
  await execSafe(`
    CREATE TABLE IF NOT EXISTS wallets (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      balance integer NOT NULL DEFAULT 0,
      pending_balance integer NOT NULL DEFAULT 0,
      locked_balance integer NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'GMD',
      status text NOT NULL DEFAULT 'active',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
  `, "wallets table");
  await execSafe(`
    CREATE TABLE IF NOT EXISTS shopper_profiles (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      preferred_categories jsonb DEFAULT '[]'::jsonb,
      preferred_location text,
      default_delivery_address text,
      default_phone text,
      loyalty_tier text NOT NULL DEFAULT 'Bronze',
      wishlist_count integer NOT NULL DEFAULT 0,
      total_orders integer NOT NULL DEFAULT 0,
      total_spent integer NOT NULL DEFAULT 0,
      notes text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `, "shopper_profiles table");
  await execSafe(`
    CREATE TABLE IF NOT EXISTS order_tracking_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
      actor_role text,
      status text NOT NULL,
      title text NOT NULL,
      message text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS order_qr_codes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      code text NOT NULL UNIQUE,
      purpose text NOT NULL DEFAULT 'order',
      status text NOT NULL DEFAULT 'active',
      used_by varchar REFERENCES users(id) ON DELETE SET NULL,
      used_at timestamp,
      expires_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS rider_locations (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      rider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delivery_id varchar,
      latitude real NOT NULL,
      longitude real NOT NULL,
      accuracy real,
      heading real,
      speed real,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS rider_earnings (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      rider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delivery_id varchar,
      order_id varchar REFERENCES orders(id) ON DELETE SET NULL,
      amount integer NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamp NOT NULL DEFAULT now(),
      paid_at timestamp
    );
    CREATE TABLE IF NOT EXISTS escrow_transactions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id varchar NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      payer_id varchar REFERENCES users(id) ON DELETE SET NULL,
      amount integer NOT NULL,
      product_amount integer NOT NULL DEFAULT 0,
      delivery_fee integer NOT NULL DEFAULT 0,
      commission_amount integer NOT NULL DEFAULT 0,
      vendor_amount integer NOT NULL DEFAULT 0,
      rider_amount integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'held',
      method text NOT NULL DEFAULT 'wallet',
      reference text,
      created_at timestamp NOT NULL DEFAULT now(),
      released_at timestamp
    );
    CREATE TABLE IF NOT EXISTS settlements (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id varchar REFERENCES orders(id) ON DELETE SET NULL,
      beneficiary_id varchar REFERENCES users(id) ON DELETE SET NULL,
      beneficiary_type text NOT NULL,
      amount integer NOT NULL,
      status text NOT NULL DEFAULT 'completed',
      note text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS profile_completion_checks (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL,
      score integer NOT NULL DEFAULT 0,
      missing_items jsonb DEFAULT '[]'::jsonb,
      restricted boolean NOT NULL DEFAULT false,
      last_reminder_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS push_notifications (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      body text NOT NULL,
      data jsonb DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'queued',
      sent_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id varchar,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `, "tracking/escrow tables");
  await execSafe(`
    UPDATE users SET role = 'delivery_rider', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM delivery_riders) AND role IN ('user', 'shopper', 'customer');
    UPDATE users SET role = 'vendor', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM vendor_profiles) AND role IN ('user', 'shopper', 'customer');
    UPDATE users SET role = 'service_provider', verification_status = CASE WHEN verification_status = 'not_submitted' THEN 'pending' ELSE verification_status END
    WHERE id IN (SELECT user_id FROM provider_profiles) AND role IN ('user', 'shopper', 'customer');
  `, "role repair for existing profile accounts");
  await execSafe(`
    CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_products_location ON products(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_products_category_stock ON products(category, in_stock, stock);
    CREATE INDEX IF NOT EXISTS idx_services_location ON services(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_delivery_riders_availability ON delivery_riders(is_online, is_available, verification_status);
    CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_orders_rider_status ON orders(rider_id, status);
    CREATE INDEX IF NOT EXISTS idx_order_tracking_events_order_created ON order_tracking_events(order_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_order_qr_codes_active_purpose ON order_qr_codes(order_id, purpose) WHERE status = 'active';
  `, "performance and integrity indexes");
  console.log("Database compatibility check completed.");
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const configuredOrigins = (process.env.CORS_ORIGIN || process.env.EXPO_PUBLIC_DOMAIN || "").split(",").map((origin2) => origin2.trim().replace(/\/$/, "")).filter(Boolean);
    const origin = req.header("origin");
    const normalizedOrigin = origin?.replace(/\/$/, "");
    const isLocalhost = normalizedOrigin?.startsWith("http://localhost:") || normalizedOrigin?.startsWith("http://127.0.0.1:");
    if (origin && (isLocalhost || configuredOrigins.includes(normalizedOrigin || ""))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      limit: "25mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false, limit: "25mb" }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs2.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use("/uploads", express.static(path2.resolve(process.cwd(), "uploads")));
  app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  app.get("/api/health", (_req, res) => res.json({ ok: true, app: "MansaMart", time: (/* @__PURE__ */ new Date()).toISOString() }));
  app.get("/api/debug/env", (_req, res) => res.json({ ok: true, port: process.env.PORT, host: process.env.HOST, api: process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_DOMAIN, nodeEnv: process.env.NODE_ENV }));
  configureExpoAndLanding(app);
  await runStartupMigrations();
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    log(`express server serving on http://${host}:${port}`);
  });
})();
