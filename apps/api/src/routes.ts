import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { calculateDeliveryFee, calculateOrderTotal } from "@mansamart/business-logic";
import { db } from "./db";
import {
  users, sessions, products, services, orders, bookings,
  reviews, cartItems, wishlistItems, notifications,
  userActivity, flashDeals, addresses, shopperProfiles, vendorProfiles, providerProfiles, coupons, banners,
  wallets, transactions, commissions, payouts, deliveryRiders, deliveries, deliveryRequests, staff, supportTickets, returnRequests, conversations, messages, productVariants, serviceSlots,
  orderTrackingEvents, orderQrCodes, riderLocations, riderEarnings, escrowTransactions, settlements, profileCompletionChecks, pushNotifications, auditLogs, orderVendorFulfillments,
} from "@mansamart/database/schema";
import { eq, and, desc, ilike, or, inArray, ne, gt, count, sql } from "drizzle-orm";
import {
  requireAuth, requireRole, optionalAuth,
  hashPassword, comparePassword, hashPin, comparePin,
  createSession, deleteSession, getTokenFromRequest, getSessionUser,
} from "./auth";
import { z } from "zod";
import { parseClientAudience, roleAllowedForAudience, type ClientAudience } from "./client-access";
import { registerPaymentRoutes } from "./payments/routes";
import { BOOKING_STATUSES, canUpdateBookingStatus, hasVerifiedReviewHistory, isOrderReturnEligible, normalizeCartSelection } from "./customer-rules";
import {
  VENDOR_FULFILLMENT_STATUSES,
  availablePayoutBalance,
  canVendorAdvanceFulfillment,
  deriveMarketplaceOrderStatus,
  isBusinessVerified,
} from "./business-rules";

type RealtimePayload = Record<string, any>;
type RealtimeEmitter = (event: string, payload: RealtimePayload, rooms?: string[]) => void;

let realtimeEmitter: RealtimeEmitter = () => {};
const apiDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function clientAudience(req: Request): ClientAudience | null {
  return parseClientAudience(req.header("x-mansamart-app"));
}

function roleAllowedForClient(req: Request, role: string): boolean {
  return roleAllowedForAudience(clientAudience(req), role);
}

const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>();

function adminLoginRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = adminLoginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    adminLoginAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return next();
  }
  if (current.count >= 5) {
    res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).json({ message: "Too many administrator login attempts. Try again later." });
  }
  current.count += 1;
  next();
}

function adminOriginAllowed(req: Request): boolean {
  const origin = req.header("origin")?.replace(/\/$/, "");
  if (!origin || process.env.NODE_ENV !== "production") return true;
  const allowed = (process.env.ADMIN_CORS_ORIGINS || "https://admin.mansamart.gm")
    .split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
  return allowed.includes(origin);
}

function emitRealtime(event: string, payload: RealtimePayload, rooms?: string[]) {
  try {
    realtimeEmitter(event, payload, rooms);
  } catch (error) {
    console.warn("[realtime skipped]", event, error);
  }
}

function socketCorsOrigins() {
  return (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function safeSocketUser(user: any) {
  if (!user) return null;
  const { password, pin, ...safe } = user;
  return safe;
}

function safeUser(u: typeof users.$inferSelect) {
  const { password, pin, ...safe } = u;
  return safe;
}

function param(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

function publicUrl(req: Request, relativePath: string) {
  const explicitBase = process.env.PUBLIC_API_URL || process.env.EXPO_PUBLIC_DOMAIN || process.env.PUBLIC_URL || "";
  if (explicitBase) return `${explicitBase.replace(/\/$/, "")}${relativePath}`;
  const proto = req.header("x-forwarded-proto") || req.protocol || "http";
  const host = req.header("x-forwarded-host") || req.get("host");
  return `${proto}://${host}${relativePath}`;
}

function getPublicProductFilters() {
  return [eq(products.inStock, true), gt(products.stock, 0)];
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function distanceKm(aLat?: number | null, aLng?: number | null, bLat?: number | null, bLng?: number | null) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return 999999;
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function withDistance<T extends { latitude?: number | null; longitude?: number | null }>(rows: T[], latitude?: number, longitude?: number, radiusKm?: number) {
  return rows
    .map(row => ({ ...row, distanceKm: distanceKm(row.latitude, row.longitude, latitude, longitude) }))
    .filter(row => radiusKm == null || row.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function isPersonalProfileLocked(user: any) {
  return user?.isVerified === true || user?.verificationStatus === "verified" || user?.profileEditLocked === true;
}

async function submitPersonalProfileChange(user: any, data: Record<string, any>) {
  const [updated] = await db.update(users).set({
    pendingProfileChanges: data,
    profileChangeStatus: "pending",
    profileChangeNote: null,
    profileChangeRequestedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, user.id)).returning();
  return updated;
}


function vendorProfileCompleteness(profile: any, productCount = 0) {
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
    productCount > 0,
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

function vendorHealthLabel(score: number, verificationStatus?: string) {
  if (verificationStatus === "rejected") return "Needs verification review";
  if (score >= 85) return "Strong profile";
  if (score >= 60) return "Good but incomplete";
  return "Needs setup";
}

function base64ToFile(dataUri: string, fileName = "upload.jpg") {
  const match = dataUri.match(/^data:(.+);base64,(.*)$/);
  const mimeType = match?.[1] || "image/jpeg";
  const base64 = match?.[2] || dataUri;
  const extFromMime = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/\.+/g, ".");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : extFromMime;
  const finalName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext || extFromMime}`;
  const uploadDir = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(apiDirectory, "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, finalName);
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  return { relativePath: `/uploads/${finalName}`, mimeType, filePath };
}

async function createDefaultProfiles(user: typeof users.$inferSelect) {
  try {
    await db.insert(wallets).values({ userId: user.id }).onConflictDoNothing();
  } catch {}
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
        supportPhone: user.phone || undefined,
        whatsapp: user.phone || undefined,
      }).onConflictDoNothing();
    } else if (user.role === "service_provider") {
      await db.insert(providerProfiles).values({
        userId: user.id,
        displayName: user.businessName || user.name,
        bio: user.bio,
        location: user.city || user.region || "The Gambia",
        whatsapp: user.phone || undefined,
      }).onConflictDoNothing();
    } else if (user.role === "delivery_rider") {
      await db.insert(deliveryRiders).values({
        userId: user.id,
        displayName: user.businessName || user.name,
        bio: user.bio || undefined,
        phone: user.phone || undefined,
        whatsapp: user.phone || undefined,
        currentAddress: user.address || undefined,
        city: user.city || undefined,
        region: user.region || undefined,
        area: user.area || undefined,
        serviceZones: [user.city || user.region || user.area || "The Gambia"].filter(Boolean),
        vehicleType: user.businessType || "motorbike",
        latitude: user.latitude,
        longitude: user.longitude,
        isOnline: false,
        isAvailable: false,
      }).onConflictDoNothing();
    } else {
      await db.insert(shopperProfiles).values({
        userId: user.id,
        preferredLocation: user.city || user.region,
        defaultDeliveryAddress: user.address,
        defaultPhone: user.phone,
      }).onConflictDoNothing();
    }
  } catch (err) {
    console.warn("Default profile creation skipped:", err);
  }
}

async function ensureVendorFulfillments(order: typeof orders.$inferSelect) {
  const totals = await calculateVendorTotalsFromDb(order);
  for (const [vendorId, subtotal] of Object.entries(totals)) {
    await db.insert(orderVendorFulfillments).values({
      orderId: order.id,
      vendorId,
      subtotal: Number(subtotal),
    }).onConflictDoNothing();
  }
}

async function getOrdersForVendor(vendorId: string) {
  const vendorProducts = await db.select().from(products).where(eq(products.vendorId, vendorId));
  const ids = new Set(vendorProducts.map(p => p.id));
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const relevant = allOrders.filter(o => Array.isArray(o.items) && o.items.some((item: any) => item.vendorId === vendorId || ids.has(item.productId)));
  const result = [];
  for (const order of relevant) {
    await ensureVendorFulfillments(order);
    const [fulfillment] = await db.select().from(orderVendorFulfillments)
      .where(and(eq(orderVendorFulfillments.orderId, order.id), eq(orderVendorFulfillments.vendorId, vendorId)))
      .limit(1);
    const vendorItems = (order.items || []).filter((item: any) => item.vendorId === vendorId || ids.has(item.productId));
    result.push({
      ...order,
      items: vendorItems,
      subtotal: fulfillment?.subtotal ?? vendorItems.reduce((sum: number, item: any) => sum + Number(item.price) * Number(item.quantity || 1), 0),
      shipping: 0,
      total: fulfillment?.subtotal ?? vendorItems.reduce((sum: number, item: any) => sum + Number(item.price) * Number(item.quantity || 1), 0),
      marketplaceOrderStatus: order.status,
      vendorStatus: fulfillment?.status || "pending",
    });
  }
  return result;
}


async function getOrCreateWalletGlobal(userId: string) {
  const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(wallets).values({ userId, balance: 0, pendingBalance: 0, lockedBalance: 0 }).returning();
  return created;
}

async function addWalletTransaction(args: {
  userId: string; type: string; direction: "credit" | "debit"; amount: number;
  status?: string; method?: string; reference?: string; description?: string; orderId?: string; bookingId?: string;
}) {
  const wallet = await getOrCreateWalletGlobal(args.userId);
  const before = wallet.balance;
  const after = args.direction === "credit" ? before + args.amount : before - args.amount;
  if (after < 0) throw new Error("Insufficient wallet balance");
  const [updatedWallet] = await db.update(wallets)
    .set({ balance: after, updatedAt: new Date() })
    .where(eq(wallets.id, wallet.id))
    .returning();
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
    description: args.description,
  }).returning();
  return { wallet: updatedWallet, transaction: tx };
}


function generateOrderQrCode(orderId: string, purpose = "order") {
  const secret = crypto.randomBytes(16).toString("hex");
  const code = `MM-${purpose.toUpperCase()}-${orderId.slice(0, 8).toUpperCase()}-${secret.slice(0, 10).toUpperCase()}`;
  return { code, secret };
}

async function notifyUser(userId: string | null | undefined, type: string, title: string, body: string, actionRoute?: string, data: Record<string, any> = {}) {
  if (!userId) return;
  const [notification] = await db.insert(notifications).values({
    userId,
    type,
    title,
    body,
    icon: type === "delivery" ? "bicycle-outline" : type === "payment" ? "wallet-outline" : "notifications-outline",
    color: type === "delivery" ? "#E8813A" : type === "payment" ? "#0EA47A" : "#2563EB",
    actionRoute,
  }).returning().catch(() => [] as any[]);
  await db.insert(pushNotifications).values({ userId, title, body, data: { ...data, actionRoute, type } }).catch(() => {});
  emitRealtime("notification:new", { notification, data: { ...data, actionRoute, type } }, [`user:${userId}`]);
}

async function audit(actorId: string | null | undefined, action: string, entityType: string, entityId?: string, metadata: Record<string, any> = {}) {
  await db.insert(auditLogs).values({ actorId: actorId || null, action, entityType, entityId, metadata }).catch(() => {});
}

async function addTracking(orderId: string, status: string, title: string, message: string, actor?: any, metadata: Record<string, any> = {}) {
  const [event] = await db.insert(orderTrackingEvents).values({
    orderId,
    actorId: actor?.id || null,
    actorRole: actor?.role || null,
    status,
    title,
    message,
    metadata,
  }).returning();
  await audit(actor?.id, `order.${status}`, "order", orderId, metadata);
  emitRealtime("order:tracking", { orderId, status, event }, [`order:${orderId}`, "role:admin"]);
  return event;
}

async function ensureOrderQr(orderId: string, purpose: "pickup" | "delivery" = "delivery") {
  const [existing] = await db.select().from(orderQrCodes)
    .where(and(eq(orderQrCodes.orderId, orderId), eq(orderQrCodes.purpose, purpose), eq(orderQrCodes.status, "active")))
    .limit(1);
  if (existing) return existing;
  const { code, secret } = generateOrderQrCode(orderId, purpose);
  const [qr] = await db.insert(orderQrCodes).values({
    orderId,
    code,
    purpose,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  }).returning();
  if (purpose === "delivery") {
    await db.update(orders).set({ qrCode: code, qrSecret: secret, updatedAt: new Date() }).where(eq(orders.id, orderId));
  }
  return qr;
}

async function ensureOrderQrs(orderId: string) {
  const pickup = await ensureOrderQr(orderId, "pickup");
  const delivery = await ensureOrderQr(orderId, "delivery");
  return { pickup, delivery };
}

async function getOrderParties(order: any) {
  const vendorIds = new Set<string>();
  for (const item of order.items || []) {
    if (item.vendorId) vendorIds.add(item.vendorId);
    else if (item.productId) {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (product?.vendorId) vendorIds.add(product.vendorId);
    }
  }
  return { shopperId: order.userId, vendorIds: [...vendorIds], riderId: order.riderId };
}

async function notifyOrderParties(order: any, title: string, body: string, type = "order") {
  const parties = await getOrderParties(order);
  const userIds = new Set<string>();
  if (parties.shopperId) userIds.add(parties.shopperId);
  if (parties.riderId) userIds.add(parties.riderId);
  parties.vendorIds.forEach(id => userIds.add(id));
  for (const userId of userIds) await notifyUser(userId, type, title, body, `/order/${order.id}`, { orderId: order.id, status: order.status });
}

function getVendorTotals(order: any) {
  const totals: Record<string, number> = {};
  for (const item of order.items || []) {
    if (item.vendorId) totals[item.vendorId] = (totals[item.vendorId] || 0) + (Number(item.price) * Number(item.quantity));
  }
  return totals;
}

async function calculateVendorTotalsFromDb(order: any) {
  const totals = getVendorTotals(order);
  for (const item of order.items || []) {
    if (!item.vendorId && item.productId) {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (product?.vendorId) totals[product.vendorId] = (totals[product.vendorId] || 0) + (Number(item.price) * Number(item.quantity));
    }
  }
  return totals;
}

async function releaseEscrowForOrder(order: any, actor?: any) {
  const [escrow] = await db.select().from(escrowTransactions).where(and(eq(escrowTransactions.orderId, order.id), eq(escrowTransactions.status, "held"))).limit(1);
  if (!escrow) return { released: false, message: "No held escrow found" };
  const vendorTotals = await calculateVendorTotalsFromDb(order);
  const commissionPercent = 5;
  for (const [vendorId, gross] of Object.entries(vendorTotals)) {
    const commission = Math.round(Number(gross) * commissionPercent / 100);
    const vendorAmount = Number(gross) - commission;
    await db.insert(commissions).values({ orderId: order.id, sellerId: vendorId, sellerType: "vendor", grossAmount: Number(gross), percentage: commissionPercent, commissionAmount: commission, sellerAmount: vendorAmount, status: "earned" }).catch(() => {});
    await addWalletTransaction({ userId: vendorId, type: "vendor_credit", direction: "credit", amount: vendorAmount, orderId: order.id, description: `Escrow released for order #${order.id.slice(0, 8).toUpperCase()}` });
    await db.insert(settlements).values({ orderId: order.id, beneficiaryId: vendorId, beneficiaryType: "vendor", amount: vendorAmount, note: "Vendor settlement after confirmed delivery" }).catch(() => {});
    await notifyUser(vendorId, "payment", "Payment Released", `D ${vendorAmount.toLocaleString()} has been released to your wallet.`, `/order/${order.id}`, { orderId: order.id });
  }
  const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, order.id)).limit(1);
  if (delivery?.riderId && delivery.deliveryFee > 0) {
    await addWalletTransaction({ userId: delivery.riderId, type: "rider_credit", direction: "credit", amount: delivery.deliveryFee, orderId: order.id, description: `Delivery earning for order #${order.id.slice(0, 8).toUpperCase()}` });
    await db.insert(riderEarnings).values({ riderId: delivery.riderId, deliveryId: delivery.id, orderId: order.id, amount: delivery.deliveryFee, status: "completed", paidAt: new Date() }).catch(() => {});
    await db.insert(settlements).values({ orderId: order.id, beneficiaryId: delivery.riderId, beneficiaryType: "rider", amount: delivery.deliveryFee, note: "Rider delivery fee released" }).catch(() => {});
    await notifyUser(delivery.riderId, "payment", "Delivery Fee Released", `D ${delivery.deliveryFee.toLocaleString()} has been released to your wallet.`, `/(rider)/deliveries`, { orderId: order.id });
  }
  await db.update(escrowTransactions).set({ status: "released", releasedAt: new Date() }).where(eq(escrowTransactions.id, escrow.id));
  await db.update(orders).set({ status: "completed" as any, escrowStatus: "released", paymentStatus: "settled", completedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, order.id));
  await addTracking(order.id, "completed", "Order completed", "Escrow has been released after successful verification.", actor);
  await notifyOrderParties({ ...order, status: "completed" }, "Order Completed", "The order is complete and payments have been released.", "order");
  return { released: true };
}

async function computeProfileCompletion(user: any) {
  const missing: string[] = [];
  if (!user.avatar) missing.push("Profile photo");
  if (!user.phone) missing.push("Phone number");
  if (!user.address && !user.city && !user.region) missing.push("Address/location");
  if (user.role === "vendor") {
    const [vp] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
    if (!vp?.storeName) missing.push("Store name");
    if (!vp?.logo) missing.push("Store logo");
    if (!vp?.mobileMoneyNumber && !vp?.accountNumber) missing.push("Bank/mobile money details");
    if (!Array.isArray(vp?.documents) || vp.documents.length === 0) missing.push("Business documents");
    if (vp?.verificationStatus !== "verified") missing.push("Admin verification");
  }
  if (user.role === "service_provider") {
    const [pp] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
    if (!pp?.profileImage) missing.push("Profile image");
    if (!pp?.whatsapp) missing.push("WhatsApp/contact");
    if (!Array.isArray(pp?.documents) || pp.documents.length === 0) missing.push("ID/certification documents");
    if (pp?.verificationStatus !== "verified") missing.push("Admin verification");
  }
  if (user.role === "delivery_rider") {
    const [rp] = await db.select().from(deliveryRiders).where(eq(deliveryRiders.userId, user.id)).limit(1);
    if (!rp?.vehicleType) missing.push("Vehicle type");
    if (!rp?.vehiclePlate) missing.push("Vehicle plate");
    if (!Array.isArray(rp?.documents) || rp.documents.length === 0) missing.push("ID/license documents");
    if (rp?.verificationStatus !== "verified") missing.push("Admin verification");
  }
  const total = missing.length + 1;
  const score = Math.max(0, Math.round(((total - missing.length) / total) * 100));
  const restricted = ["vendor", "service_provider", "delivery_rider"].includes(user.role) && missing.length > 0;
  const [check] = await db.insert(profileCompletionChecks).values({ userId: user.id, role: user.role, score, missingItems: missing, restricted }).returning().catch(async () => {
    const [updated] = await db.update(profileCompletionChecks).set({ score, missingItems: missing, restricted, updatedAt: new Date() }).where(eq(profileCompletionChecks.userId, user.id)).returning();
    return [updated];
  }) as any;
  return check || { score, missingItems: missing, restricted };
}

export async function registerRoutes(app: Express): Promise<Server> {

  async function createVerifiedCustomerReview(
    user: any,
    targetType: "product" | "service",
    targetId: string,
    rating: number,
    text: string,
  ) {
    if (user.role !== "user") {
      return { error: "Only customer accounts can submit marketplace reviews", status: 403, review: null };
    }

    const [orderHistory, bookingHistory, duplicate] = await Promise.all([
      db.select({ status: orders.status, items: orders.items }).from(orders).where(eq(orders.userId, user.id)),
      db.select({ status: bookings.status, serviceId: bookings.serviceId }).from(bookings).where(eq(bookings.userId, user.id)),
      db.select().from(reviews).where(and(
        eq(reviews.userId, user.id),
        eq(reviews.targetType, targetType),
        eq(reviews.targetId, targetId),
      )).limit(1),
    ]);

    if (duplicate.length > 0) return { error: "You already reviewed this item", status: 409, review: null };
    if (!hasVerifiedReviewHistory(targetType, targetId, orderHistory, bookingHistory)) {
      return { error: "Complete this purchase or booking before leaving a review", status: 403, review: null };
    }

    const target = targetType === "product"
      ? await db.select({ id: products.id }).from(products).where(eq(products.id, targetId)).limit(1)
      : await db.select({ id: services.id }).from(services).where(eq(services.id, targetId)).limit(1);
    if (target.length === 0) return { error: "Review target not found", status: 404, review: null };

    let review: typeof reviews.$inferSelect;
    try {
      [review] = await db.insert(reviews).values({
        userId: user.id,
        targetId,
        targetType,
        name: user.name,
        rating,
        text,
        verified: true,
      }).returning();
    } catch (error: any) {
      if (error?.code === "23505") return { error: "You already reviewed this item", status: 409, review: null };
      throw error;
    }

    const targetReviews = await db.select({ rating: reviews.rating }).from(reviews).where(and(
      eq(reviews.targetType, targetType),
      eq(reviews.targetId, targetId),
    ));
    const average = targetReviews.reduce((sum, item) => sum + item.rating, 0) / targetReviews.length;
    if (targetType === "product") {
      await db.update(products).set({ rating: average, reviewCount: targetReviews.length }).where(eq(products.id, targetId));
    } else {
      await db.update(services).set({ rating: average, reviewCount: targetReviews.length }).where(eq(services.id, targetId));
    }

    return { review, error: null, status: 201 };
  }

  registerPaymentRoutes(app);

  // ────────────────────────────────────────────────────────────────
  // FILE UPLOADS - Expo/mobile friendly base64 image upload
  // ────────────────────────────────────────────────────────────────
  app.post("/api/uploads/base64", requireAuth, async (req: Request, res: Response) => {
    try {
      const { image, fileName, kind } = z.object({
        image: z.string().min(100),
        fileName: z.string().optional(),
        kind: z.string().optional(),
      }).parse(req.body);
      const saved = base64ToFile(image, fileName || `${kind || "upload"}.jpg`);
      return res.status(201).json({
        url: publicUrl(req, saved.relativePath),
        path: saved.relativePath,
        mimeType: saved.mimeType,
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid image" });
      console.error(err);
      return res.status(500).json({ message: "Image upload failed" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // AUTH
  // ────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req: Request, res: Response) => {
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
        bio: z.string().optional(),
      });

      const parsed = schema.parse(req.body);
      if (!clientAudience(req)) return res.status(400).json({ message: "Unknown MansaMart application" });
      if (!roleAllowedForClient(req, parsed.role)) {
        return res.status(403).json({ message: "This account type must be created in its dedicated MansaMart application." });
      }
      const data = { ...parsed, email: parsed.email.trim().toLowerCase() };
      const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
      if (existing.length > 0) return res.status(409).json({ message: "Email already registered" });

      const hashedPassword = await hashPassword(data.password);
      const [user] = await db.insert(users).values({
        ...data,
        password: hashedPassword,
      }).returning();

      await createDefaultProfiles(user);

      const token = await createSession(user.id);

      // Send welcome notification
      await db.insert(notifications).values({
        userId: user.id,
        type: "system",
        title: "Welcome to MansaMart!",
        body: "Discover thousands of products and book home services from Gambian businesses.",
        icon: "information-circle-outline",
        color: "#0EA47A",
      });

      return res.status(201).json({ token, user: safeUser(user) });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid data" });
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/auth/login", adminLoginRateLimit, async (req: Request, res: Response) => {
    try {
      if (String(req.header("x-mansamart-app") || "").toLowerCase() !== "admin" || !adminOriginAllowed(req)) {
        return res.status(403).json({ message: "Administrator login is only available through the secure administrator portal." });
      }
      const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
      const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
      if (!user || !(await comparePassword(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (user.role !== "admin") return res.status(403).json({ message: "Administrator access required" });
      const token = await createSession(user.id, 8 * 60 * 60 * 1000);
      await db.insert(auditLogs).values({ actorId: user.id, action: "admin_login", entityType: "session", metadata: { ip: req.ip } }).catch(() => {});
      return res.json({ token, user: safeUser(user), expiresIn: 8 * 60 * 60 });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid login data" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string(),
      }).parse(req.body);

      const loginEmail = email.trim().toLowerCase();
      const [user] = await db.select().from(users).where(eq(users.email, loginEmail)).limit(1);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });

      const valid = await comparePassword(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });

      if (user.role === "admin") {
        return res.status(403).json({ message: "Administrator accounts must sign in at admin.mansamart.gm" });
      }
      if (!clientAudience(req)) return res.status(400).json({ message: "Unknown MansaMart application" });
      if (!roleAllowedForClient(req, user.role)) {
        return res.status(403).json({ message: "Use the MansaMart application for your account type." });
      }

      const token = await createSession(user.id);
      return res.json({ token, user: safeUser(user), hasPin: !!user.pin });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid data" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/verify-pin", requireAuth, async (req: Request, res: Response) => {
    try {
      const { pin } = z.object({ pin: z.string().length(6) }).parse(req.body);
      const user = (req as any).user as typeof users.$inferSelect;
      if (!user.pin) return res.status(400).json({ message: "No PIN set" });
      const valid = await comparePin(pin, user.pin);
      if (!valid) return res.status(401).json({ message: "Incorrect PIN" });
      return res.json({ verified: true });
    } catch {
      return res.status(400).json({ message: "Invalid PIN" });
    }
  });

  app.post("/api/auth/set-pin", requireAuth, async (req: Request, res: Response) => {
    try {
      const { pin } = z.object({ pin: z.string().length(6).regex(/^\d{6}$/) }).parse(req.body);
      const user = (req as any).user as typeof users.$inferSelect;
      const hashed = await hashPin(pin);
      await db.update(users).set({ pin: hashed }).where(eq(users.id, user.id));
      return res.json({ success: true });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "PIN must be 6 digits" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    return res.json({ user: safeUser(user), hasPin: !!user.pin });
  });

  app.put("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as typeof users.$inferSelect;
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
        avatar: z.string().optional(),
      });
      const data = schema.parse(req.body);
      if (isPersonalProfileLocked(user)) {
        const updated = await submitPersonalProfileChange(user, data);
        return res.json({ user: safeUser(updated), changeRequestSubmitted: true, message: "Your verified personal profile is locked. Changes were submitted for admin approval." });
      }
      const [updated] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
      return res.json({ user: safeUser(updated) });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: Request, res: Response) => {
    const token = getTokenFromRequest(req);
    if (token) await deleteSession(token);
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // LOCATION INTELLIGENCE
  // ────────────────────────────────────────────────────────────────

  app.put("/api/location/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const data = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        locationAccuracy: z.number().optional(),
        region: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        area: z.string().optional(),
      }).parse(req.body);
      const [updated] = await db.update(users).set({
        latitude: data.latitude,
        longitude: data.longitude,
        locationAccuracy: data.locationAccuracy,
        region: data.region,
        city: data.city,
        area: data.area || data.district,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id)).returning();
      if (user.role === "delivery_rider") {
        await db.update(deliveryRiders).set({ latitude: data.latitude, longitude: data.longitude, updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id));
      }
      return res.json({ user: safeUser(updated) });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Location update failed" });
    }
  });

  app.get("/api/nearby", async (req: Request, res: Response) => {
    try {
      const latitude = toNumber(req.query.latitude);
      const longitude = toNumber(req.query.longitude);
      const radiusKm = toNumber(req.query.radiusKm) ?? 10;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 30) || 30, 1), 100);
      if (latitude == null || longitude == null) return res.status(400).json({ message: "latitude and longitude are required" });
      const productRows = await db.select().from(products).where(and(...getPublicProductFilters())).orderBy(desc(products.createdAt)).limit(500);
      const serviceRows = await db.select().from(services).where(eq(services.isAvailable, true)).orderBy(desc(services.createdAt)).limit(500);
      const vendorUsers = await db.select().from(users).where(eq(users.role, "vendor")).limit(500);
      const riderRows = await db.select().from(deliveryRiders).where(and(eq(deliveryRiders.isOnline, true), eq(deliveryRiders.isAvailable, true), eq(deliveryRiders.verificationStatus, "verified"))).limit(200);
      return res.json({
        radiusKm,
        products: withDistance(productRows, latitude, longitude, radiusKm).slice(0, limit),
        services: withDistance(serviceRows, latitude, longitude, radiusKm).slice(0, limit),
        vendors: withDistance(vendorUsers, latitude, longitude, radiusKm).slice(0, limit),
        riders: withDistance(riderRows, latitude, longitude, radiusKm).slice(0, limit),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Nearby lookup failed" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // PRODUCTS
  // ────────────────────────────────────────────────────────────────

  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const { category, search, sale, newOnly, limit: limitStr, offset: offsetStr, latitude: latStr, longitude: lngStr, radiusKm: radiusStr } = req.query as Record<string, string>;
      const filters = [];
      if (category && category !== "all") filters.push(eq(products.category, category));
      if (search) filters.push(or(ilike(products.name, `%${search}%`), ilike(products.brand, `%${search}%`)));
      if (sale === "true") filters.push(eq(products.isSale, true));
      if (newOnly === "true") filters.push(eq(products.isNew, true));
      filters.push(...getPublicProductFilters());
      const limit = Math.min(Math.max(parseInt(limitStr ?? "100", 10) || 100, 1), 200);
      const offset = Math.max(parseInt(offsetStr ?? "0", 10) || 0, 0);
      const latitude = toNumber(latStr);
      const longitude = toNumber(lngStr);
      const radiusKm = toNumber(radiusStr);
      const rawRows = await db.select().from(products)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(products.createdAt))
        .limit(latitude != null && longitude != null ? 500 : limit)
        .offset(latitude != null && longitude != null ? 0 : offset);
      const rows = latitude != null && longitude != null
        ? withDistance(rawRows, latitude, longitude, radiusKm).slice(offset, offset + limit)
        : rawRows;
      return res.json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products/:id", optionalAuth, async (req: Request, res: Response) => {
    const [p] = await db.select().from(products).where(eq(products.id, param(req, "id"))).limit(1);
    if (!p) return res.status(404).json({ message: "Product not found" });
    const viewer = (req as any).user;
    const canSeeHidden = viewer?.role === "admin" || viewer?.id === p.vendorId;
    if (!canSeeHidden && (!p.inStock || Number(p.stock || 0) <= 0)) return res.status(404).json({ message: "Product not available" });
    return res.json(p);
  });

  app.post("/api/products", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
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
        placeholderIcon: z.string().optional(),
      });
      const data = schema.parse(req.body);
      let vendorProfileForProduct: any = null;
      if (user.role !== "admin") {
        const [vp] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
        vendorProfileForProduct = vp;
        if (!isBusinessVerified(vp)) {
          return res.status(403).json({ message: "Your vendor profile must be verified before you can publish products." });
        }
        const primaryCategory = vp?.shopCategory || user.businessType || "general";
        const allowedCategories = new Set([primaryCategory, ...(Array.isArray(vp?.allowedCategories) ? vp.allowedCategories : [])]);
        if (primaryCategory !== "general" && !allowedCategories.has(data.category)) {
          return res.status(403).json({ message: `Your shop profile is set as ${primaryCategory}. Update your vendor profile before posting ${data.category} products.` });
        }
      }
      const stockValue = Number(data.stock ?? 100);
      const cleanImages = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 8) : [];
      const productData: any = { ...data };
      if (user.role !== "admin") {
        productData.brand = vendorProfileForProduct?.storeName || user.businessName || user.name || data.brand;
        productData.location = vendorProfileForProduct?.location || data.location || user.area || user.city || user.region || "The Gambia";
        productData.area = data.area || user.area || user.city || vendorProfileForProduct?.location || productData.location;
        productData.latitude = data.latitude ?? user.latitude ?? null;
        productData.longitude = data.longitude ?? user.longitude ?? null;
      }
      const [p] = await db.insert(products).values({ ...productData, images: cleanImages, stock: stockValue, inStock: stockValue > 0, vendorId: user.id, rating: 4.5, reviewCount: 0 }).returning();
      return res.status(201).json(p);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/products/:id", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [p] = await db.select().from(products).where(eq(products.id, param(req, "id"))).limit(1);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (user.role !== "admin" && p.vendorId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (user.role !== "admin") {
        const [profile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
        if (!isBusinessVerified(profile)) {
          return res.status(403).json({ message: "Your vendor profile must be verified before you can update products." });
        }
      }

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
        placeholderIcon: z.string().optional().nullable(),
      });
      const data = schema.parse(req.body);
      if (user.role !== "admin" && data.category) {
        const [vp] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
        const primaryCategory = vp?.shopCategory || user.businessType || "general";
        const allowedCategories = new Set([primaryCategory, ...(Array.isArray(vp?.allowedCategories) ? vp.allowedCategories : [])]);
        if (primaryCategory !== "general" && !allowedCategories.has(data.category)) {
          return res.status(403).json({ message: `Your shop profile is set as ${primaryCategory}. Update your vendor profile before posting ${data.category} products.` });
        }
      }
      const updateData: any = { ...data };
      if (user.role !== "admin") {
        const [vp] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
        updateData.brand = vp?.storeName || user.businessName || user.name || p.brand;
        updateData.location = vp?.location || data.location || user.area || user.city || user.region || p.location || "The Gambia";
        updateData.area = data.area || user.area || user.city || vp?.location || p.area || updateData.location;
        updateData.latitude = data.latitude ?? user.latitude ?? p.latitude ?? null;
        updateData.longitude = data.longitude ?? user.longitude ?? p.longitude ?? null;
      }
      if (Array.isArray(updateData.images)) updateData.images = updateData.images.filter(Boolean).slice(0, 8);
      if (typeof updateData.stock === "number") updateData.inStock = updateData.stock > 0;
      const [updated] = await db.update(products).set(updateData).where(eq(products.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [p] = await db.select().from(products).where(eq(products.id, param(req, "id"))).limit(1);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (user.role !== "admin" && p.vendorId !== user.id) return res.status(403).json({ message: "Forbidden" });
      await db.delete(products).where(eq(products.id, param(req, "id")));
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products/vendor/mine", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(products).where(eq(products.vendorId, user.id)).orderBy(desc(products.createdAt));
    return res.json(rows);
  });

  // ────────────────────────────────────────────────────────────────
  // SERVICES
  // ────────────────────────────────────────────────────────────────

  app.get("/api/services", async (req: Request, res: Response) => {
    const { latitude: latStr, longitude: lngStr, radiusKm: radiusStr, category, limit: limitStr } = req.query as Record<string, string>;
    const filters = [eq(services.isAvailable, true)];
    if (category && category !== "all") filters.push(eq(services.category, category));
    const latitude = toNumber(latStr);
    const longitude = toNumber(lngStr);
    const radiusKm = toNumber(radiusStr);
    const limit = Math.min(Math.max(parseInt(limitStr ?? "100", 10) || 100, 1), 200);
    const rawRows = await db.select().from(services).where(and(...filters)).orderBy(desc(services.createdAt)).limit(latitude != null && longitude != null ? 500 : limit);
    const rows = latitude != null && longitude != null ? withDistance(rawRows, latitude, longitude, radiusKm).slice(0, limit) : rawRows;
    return res.json(rows);
  });

  app.get("/api/services/:id", async (req: Request, res: Response) => {
    const [s] = await db.select().from(services).where(eq(services.id, param(req, "id"))).limit(1);
    if (!s) return res.status(404).json({ message: "Service not found" });
    return res.json(s);
  });

  app.post("/api/services", requireAuth, requireRole("service_provider", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
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
        isFeatured: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      if (user.role !== "admin") {
        const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
        if (!isBusinessVerified(profile)) {
          return res.status(403).json({ message: "Your provider profile must be verified before you can publish services." });
        }
      }
      const [s] = await db.insert(services).values({
        ...data,
        area: data.area || user.area || user.city || user.region || "The Gambia",
        latitude: data.latitude ?? user.latitude ?? null,
        longitude: data.longitude ?? user.longitude ?? null,
        providerId: user.id,
        providerName: user.businessName ?? user.name,
        rating: 4.5,
        reviewCount: 0,
      }).returning();
      return res.status(201).json(s);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/services/:id", requireAuth, requireRole("service_provider", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [s] = await db.select().from(services).where(eq(services.id, param(req, "id"))).limit(1);
      if (!s) return res.status(404).json({ message: "Not found" });
      if (user.role !== "admin" && s.providerId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (user.role !== "admin") {
        const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
        if (!isBusinessVerified(profile)) {
          return res.status(403).json({ message: "Your provider profile must be verified before you can update services." });
        }
      }
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
        isFeatured: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const updateData: any = { ...data };
      if (user.role !== "admin") {
        updateData.area = data.area || user.area || user.city || user.region || s.area || "The Gambia";
        updateData.latitude = data.latitude ?? user.latitude ?? s.latitude ?? null;
        updateData.longitude = data.longitude ?? user.longitude ?? s.longitude ?? null;
        updateData.providerName = user.businessName ?? user.name;
      }
      const [updated] = await db.update(services).set(updateData).where(eq(services.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/services/provider/mine", requireAuth, requireRole("service_provider", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(services).where(eq(services.providerId, user.id)).orderBy(desc(services.createdAt));
    return res.json(rows);
  });

  app.delete("/api/services/:id", requireAuth, requireRole("service_provider", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [service] = await db.select().from(services).where(eq(services.id, param(req, "id"))).limit(1);
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (user.role !== "admin" && service.providerId !== user.id) return res.status(403).json({ message: "Forbidden" });
    const [activeBooking] = await db.select().from(bookings).where(and(
      eq(bookings.serviceId, service.id),
      inArray(bookings.status, ["pending", "confirmed", "in_progress"]),
    )).limit(1);
    if (activeBooking) return res.status(409).json({ message: "Pause this service instead; it still has an active booking." });
    await db.delete(services).where(eq(services.id, service.id));
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // ORDERS
  // ────────────────────────────────────────────────────────────────

  app.get("/api/orders", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (user.role === "admin") {
      const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
      return res.json(rows);
    }
    if (user.role === "vendor") {
      const rows = await getOrdersForVendor(user.id);
      return res.json(rows);
    }
    const rows = await db.select().from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt));
    return res.json(rows);
  });

  app.get("/api/orders/:id", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [o] = await db.select().from(orders).where(eq(orders.id, param(req, "id"))).limit(1);
    if (!o) return res.status(404).json({ message: "Not found" });
    if (user.role === "vendor") {
      const vendorOrder = (await getOrdersForVendor(user.id)).find((order) => order.id === o.id);
      if (!vendorOrder) return res.status(403).json({ message: "Forbidden" });
      return res.json(vendorOrder);
    }
    if (user.role !== "admin" && o.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
    return res.json(o);
  });

  app.post("/api/orders", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const schema = z.object({
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().int().min(1).max(99),
          selectedColor: z.string().optional().nullable(),
          selectedSize: z.string().optional().nullable(),
          selectedVariant: z.string().optional().nullable(),
          selectedOptions: z.record(z.any()).optional(),
        })).min(1).max(100),
        address: z.string(),
        city: z.string(),
        phone: z.string(),
        paymentMethod: z.literal("wave"),
        fulfillmentType: z.enum(["delivery", "pickup"]).default("delivery"),
        deliveryLatitude: z.number().optional(),
        deliveryLongitude: z.number().optional(),
        deliveryArea: z.string().optional(),
        notes: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const productIds = [...new Set(data.items.map((item) => item.productId))];
      const currentProducts = await db.select().from(products).where(inArray(products.id, productIds));
      const productById = new Map(currentProducts.map((product) => [product.id, product]));
      const requestedQuantityByProduct = data.items.reduce((quantities, item) => {
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
        return quantities;
      }, new Map<string, number>());
      for (const [productId, quantity] of requestedQuantityByProduct) {
        const product = productById.get(productId);
        if (!product) throw new Error("Product is no longer available");
        if (!product.inStock || product.stock < quantity) throw new Error(`Product is out of stock: ${product.name}`);
      }
      const authoritativeItems = data.items.map((item) => {
        const product = productById.get(item.productId);
        if (!product) throw new Error("Product is no longer available");
        return {
          productId: product.id,
          vendorId: product.vendorId,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          image: product.images?.[0],
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          selectedVariant: item.selectedVariant,
          selectedOptions: item.selectedOptions,
          category: product.category,
          subcategory: product.subcategory,
          sku: product.sku,
          productType: product.productType,
          vendorName: product.brand,
        };
      });
      const subtotal = authoritativeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const everyItemHasFreeShipping = currentProducts.length > 0 && currentProducts.every((product) => product.freeShipping);
      const shipping = calculateDeliveryFee(subtotal, data.fulfillmentType, everyItemHasFreeShipping);
      const total = calculateOrderTotal(subtotal, shipping);
      const [o] = await db.insert(orders).values({
        ...data,
        items: authoritativeItems,
        subtotal,
        shipping,
        total,
        userId: user.id,
        paymentMethod: "wave",
        paymentStatus: "pending",
        fulfillmentType: data.fulfillmentType,
      }).returning();
      await ensureVendorFulfillments(o);
      const qrs = await ensureOrderQrs(o.id);

      // Clear cart after order
      await db.delete(cartItems).where(eq(cartItems.userId, user.id));

      await addTracking(o.id, "pending", "Order placed", `Order #${o.id.slice(0, 8).toUpperCase()} was created.`, user, { fulfillmentType: data.fulfillmentType });
      await notifyOrderParties({ ...o, qrCode: qrs.delivery.code }, "New Order Placed", `Order #${o.id.slice(0, 8).toUpperCase()} has been placed.`, "order");

      return res.status(201).json({ ...o, qrCode: qrs.delivery.code, qrs, pricing: { subtotal, shipping, total, currency: "GMD" } });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      if (err.message === "Product is no longer available" || err.message?.startsWith("Product is out of stock:")) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/orders/:id/status", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const orderId = param(req, "id");
      const [currentOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!currentOrder) return res.status(404).json({ message: "Order not found" });

      if (user.role === "admin") {
        const { status } = z.object({ status: z.enum([
          "pending", "paid", "confirmed", "processing", "preparing", "ready_for_pickup",
          "searching_rider", "rider_searching", "rider_assigned", "rider_arrived_vendor",
          "picked_up", "on_the_way", "shipped", "delivered", "completed", "cancelled", "refunded",
        ]) }).parse(req.body);
        const [updated] = await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
        await addTracking(orderId, status, "Order status updated", `Administrator changed the order status to ${status}.`, user);
        await notifyOrderParties(updated, "Order Updated", `Order status changed to ${status.replace(/_/g, " ")}.`, "order");
        return res.json(updated);
      }

      const { status } = z.object({ status: z.enum(VENDOR_FULFILLMENT_STATUSES) }).parse(req.body);
      await ensureVendorFulfillments(currentOrder);
      const [fulfillment] = await db.select().from(orderVendorFulfillments).where(and(
        eq(orderVendorFulfillments.orderId, orderId),
        eq(orderVendorFulfillments.vendorId, user.id),
      )).limit(1);
      if (!fulfillment) return res.status(403).json({ message: "This order does not contain items from your business." });
      if (!canVendorAdvanceFulfillment(fulfillment.status, status, currentOrder.paymentStatus)) {
        return res.status(409).json({ message: "That fulfillment change is not allowed. Payment must be confirmed and steps must be completed in order." });
      }

      await db.update(orderVendorFulfillments).set({ status, updatedAt: new Date() }).where(eq(orderVendorFulfillments.id, fulfillment.id));
      const fulfillmentRows = await db.select().from(orderVendorFulfillments).where(eq(orderVendorFulfillments.orderId, orderId));
      const marketplaceStatus = deriveMarketplaceOrderStatus(currentOrder.status, fulfillmentRows.map((row) => row.status));
      const [updatedOrder] = marketplaceStatus === currentOrder.status
        ? [currentOrder]
        : await db.update(orders).set({ status: marketplaceStatus as any, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
      await addTracking(orderId, status, "Seller fulfillment updated", `A seller marked their portion as ${status.replace(/_/g, " ")}.`, user, { vendorId: user.id });
      await notifyUser(currentOrder.userId, "order", "Order Updated", `A seller marked part of your order as ${status.replace(/_/g, " ")}.`, `/order/${orderId}`, { orderId, status });
      const vendorOrder = (await getOrdersForVendor(user.id)).find((order) => order.id === orderId);
      return res.json(vendorOrder || { ...updatedOrder, vendorStatus: status });
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Invalid order status" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // BOOKINGS
  // ────────────────────────────────────────────────────────────────

  app.get("/api/bookings", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    let rows: Array<{ booking: typeof bookings.$inferSelect; providerName: string | null }>;
    if (user.role === "admin") {
      rows = await db.select({ booking: bookings, providerName: services.providerName })
        .from(bookings).leftJoin(services, eq(bookings.serviceId, services.id))
        .orderBy(desc(bookings.createdAt));
    } else if (user.role === "service_provider") {
      rows = await db.select({ booking: bookings, providerName: services.providerName })
        .from(bookings).leftJoin(services, eq(bookings.serviceId, services.id))
        .where(eq(bookings.providerId, user.id)).orderBy(desc(bookings.createdAt));
    } else {
      rows = await db.select({ booking: bookings, providerName: services.providerName })
        .from(bookings).leftJoin(services, eq(bookings.serviceId, services.id))
        .where(eq(bookings.userId, user.id)).orderBy(desc(bookings.createdAt));
    }
    return res.json(rows.map(({ booking, providerName }) => ({ ...booking, providerName })));
  });

  app.post("/api/bookings", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const schema = z.object({
        serviceId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().min(2).max(30),
        address: z.string().trim().min(5).max(500),
        notes: z.string().trim().max(1000).optional(),
      });
      const data = schema.parse(req.body);
      const appointment = new Date(`${data.date}T23:59:59`);
      const latestAllowed = new Date();
      latestAllowed.setDate(latestAllowed.getDate() + 90);
      if (Number.isNaN(appointment.getTime()) || appointment < new Date() || appointment > latestAllowed) {
        return res.status(400).json({ message: "Choose a service date within the next 90 days" });
      }

      const [service] = await db.select().from(services).where(eq(services.id, data.serviceId)).limit(1);
      if (!service || !service.isAvailable) return res.status(404).json({ message: "Service is unavailable" });

      const [duplicate] = await db.select().from(bookings).where(and(
        eq(bookings.userId, user.id),
        eq(bookings.serviceId, service.id),
        eq(bookings.date, data.date),
        eq(bookings.time, data.time),
        ne(bookings.status, "cancelled"),
      )).limit(1);
      if (duplicate) return res.status(409).json({ message: "You already booked this service for that time" });

      const [b] = await db.insert(bookings).values({
        serviceId: service.id,
        serviceName: service.name,
        providerId: service.providerId,
        date: data.date,
        time: data.time,
        address: data.address,
        notes: data.notes,
        price: service.price,
        userId: user.id,
        userName: user.name,
      }).returning();

      await db.insert(notifications).values({
        userId: user.id,
        type: "booking",
        title: "Booking Submitted!",
        body: `Your booking for ${service.name} on ${data.date} at ${data.time} is pending confirmation.`,
        icon: "calendar-outline",
        color: "#7B4FA3",
        actionRoute: "/bookings",
      });

      if (service.providerId) {
        await db.insert(notifications).values({
          userId: service.providerId,
          type: "booking",
          title: "New Service Booking",
          body: `${user.name} requested ${service.name} on ${data.date} at ${data.time}.`,
          icon: "calendar-outline",
          color: "#7B4FA3",
          actionRoute: "/bookings",
        });
      }

      return res.status(201).json({ ...b, providerName: service.providerName });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/bookings/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { status } = z.object({ status: z.enum(BOOKING_STATUSES) }).parse(req.body);
      const [current] = await db.select().from(bookings).where(eq(bookings.id, param(req, "id"))).limit(1);
      if (!current) return res.status(404).json({ message: "Booking not found" });
      if (!canUpdateBookingStatus(user, current, status)) {
        return res.status(403).json({ message: "You cannot make that booking status change" });
      }
      const [b] = await db.update(bookings)
        .set({ status: status as any })
        .where(eq(bookings.id, param(req, "id")))
        .returning();
      if (b.userId && b.userId !== user.id) {
        await db.insert(notifications).values({
          userId: b.userId,
          type: "booking",
          title: "Booking Updated",
          body: `${b.serviceName} is now ${status.replace(/_/g, " ")}.`,
          icon: "calendar-outline",
          color: "#7B4FA3",
          actionRoute: "/bookings",
        });
      }
      return res.json(b);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid booking status" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // CART
  // ────────────────────────────────────────────────────────────────

  app.get("/api/cart", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const items = await db
      .select({ cartItem: cartItems, product: products })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(and(eq(cartItems.userId, user.id), eq(products.inStock, true), gt(products.stock, 0)));
    return res.json(items);
  });

  app.post("/api/cart", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { productId, quantity = 1, ...selectionInput } = z.object({
        productId: z.string(),
        quantity: z.number().int().min(1).max(99).optional(),
        selectedColor: z.string().trim().min(1).max(100).optional(),
        selectedSize: z.string().trim().min(1).max(100).optional(),
        selectedVariant: z.string().trim().min(1).max(100).optional(),
        selectedOptions: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
          .refine((value) => Object.keys(value).length <= 20, "Too many product options")
          .optional(),
      }).parse(req.body);
      const selection = normalizeCartSelection(selectionInput);

      const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!product || !product.inStock || Number(product.stock || 0) <= 0) return res.status(400).json({ message: "Product is out of stock" });
      const [existing] = await db.select().from(cartItems)
        .where(and(
          eq(cartItems.userId, user.id),
          eq(cartItems.productId, productId),
          eq(cartItems.optionKey, selection.optionKey),
        )).limit(1);

      if (existing) {
        const nextQuantity = existing.quantity + quantity;
        if (nextQuantity > Math.min(product.stock, 99)) return res.status(409).json({ message: `Only ${Math.min(product.stock, 99)} item(s) available` });
        const [updated] = await db.update(cartItems)
          .set({ quantity: nextQuantity, ...selection })
          .where(eq(cartItems.id, existing.id))
          .returning();
        return res.json(updated);
      }

      if (quantity > product.stock) return res.status(409).json({ message: `Only ${product.stock} item(s) available` });
      const [item] = await db.insert(cartItems).values({ userId: user.id, productId, quantity, ...selection }).returning();
      return res.status(201).json(item);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid data" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/cart/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { quantity } = z.object({ quantity: z.number().int().min(1).max(99) }).parse(req.body);
      const [item] = await db.select().from(cartItems).where(eq(cartItems.id, param(req, "id"))).limit(1);
      if (!item || item.userId !== user.id) return res.status(404).json({ message: "Not found" });
      const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (!product || !product.inStock || quantity > product.stock) {
        return res.status(409).json({ message: product ? `Only ${product.stock} item(s) available` : "Product is unavailable" });
      }
      const [updated] = await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Quantity must be between 1 and 99" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/cart/:id", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.delete(cartItems).where(and(eq(cartItems.id, param(req, "id")), eq(cartItems.userId, user.id)));
    return res.json({ success: true });
  });

  app.delete("/api/cart", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.delete(cartItems).where(eq(cartItems.userId, user.id));
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // WISHLIST
  // ────────────────────────────────────────────────────────────────

  app.get("/api/wishlist", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const items = await db
      .select({ wishlistItem: wishlistItems, product: products })
      .from(wishlistItems)
      .innerJoin(products, eq(wishlistItems.productId, products.id))
      .where(and(eq(wishlistItems.userId, user.id), eq(products.inStock, true), gt(products.stock, 0)));
    return res.json(items);
  });

  app.post("/api/wishlist", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { productId } = z.object({ productId: z.string() }).parse(req.body);
      const [existing] = await db.select().from(wishlistItems)
        .where(and(eq(wishlistItems.userId, user.id), eq(wishlistItems.productId, productId))).limit(1);
      if (existing) return res.json(existing);
      const [item] = await db.insert(wishlistItems).values({ userId: user.id, productId }).returning();
      return res.status(201).json(item);
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/wishlist/:productId", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.delete(wishlistItems).where(
      and(eq(wishlistItems.userId, user.id), eq(wishlistItems.productId, param(req, "productId")))
    );
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // REVIEWS
  // ────────────────────────────────────────────────────────────────

  app.get("/api/customer/reviews", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(reviews)
      .where(eq(reviews.userId, user.id))
      .orderBy(desc(reviews.createdAt));
    return res.json(rows);
  });

  app.get("/api/customer/review-eligibility", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [completedOrders, completedBookings, existingReviews] = await Promise.all([
      db.select({ status: orders.status, items: orders.items }).from(orders).where(and(
        eq(orders.userId, user.id),
        inArray(orders.status, ["delivered", "completed"]),
      )),
      db.select().from(bookings).where(and(eq(bookings.userId, user.id), eq(bookings.status, "completed"))),
      db.select({ targetId: reviews.targetId, targetType: reviews.targetType }).from(reviews).where(eq(reviews.userId, user.id)),
    ]);

    const reviewed = new Set(existingReviews.map((review) => `${review.targetType}:${review.targetId}`));
    const productsToReview = new Map<string, { targetType: "product"; targetId: string; name: string; subtitle?: string; image?: string }>();
    for (const order of completedOrders) {
      if (!Array.isArray(order.items)) continue;
      for (const item of order.items) {
        if (!item?.productId || reviewed.has(`product:${item.productId}`)) continue;
        productsToReview.set(item.productId, {
          targetType: "product",
          targetId: item.productId,
          name: item.name,
          subtitle: item.vendorName || undefined,
          image: item.image || undefined,
        });
      }
    }

    const servicesToReview = new Map<string, { targetType: "service"; targetId: string; name: string; subtitle: string }>();
    for (const booking of completedBookings) {
      if (!booking.serviceId || reviewed.has(`service:${booking.serviceId}`)) continue;
      servicesToReview.set(booking.serviceId, {
        targetType: "service" as const,
        targetId: booking.serviceId,
        name: booking.serviceName,
        subtitle: `Completed ${booking.date}`,
      });
    }

    return res.json([...productsToReview.values(), ...servicesToReview.values()]);
  });

  app.get("/api/reviews/:targetId", async (req: Request, res: Response) => {
    const rows = await db.select().from(reviews)
      .where(eq(reviews.targetId, param(req, "targetId")))
      .orderBy(desc(reviews.createdAt));
    return res.json(rows);
  });

  app.post("/api/reviews", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const schema = z.object({
        targetId: z.string(),
        targetType: z.enum(["product", "service"]),
        rating: z.number().min(1).max(5),
        text: z.string().min(5),
      });
      const data = schema.parse(req.body);
      const result = await createVerifiedCustomerReview(user, data.targetType, data.targetId, data.rating, data.text);
      if (result.error) return res.status(result.status).json({ message: result.error });
      return res.status(201).json(result.review);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ────────────────────────────────────────────────────────────────

  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return res.json(rows);
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.id, param(req, "id")), eq(notifications.userId, user.id)));
    return res.json({ success: true });
  });

  app.put("/api/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, user.id));
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // ADMIN
  // ────────────────────────────────────────────────────────────────

  app.get("/api/admin/stats", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const [allUsers, allProducts, allServices, allOrders, allBookings] = await Promise.all([
      db.select().from(users),
      db.select().from(products),
      db.select().from(services),
      db.select().from(orders),
      db.select().from(bookings),
    ]);
    const revenue = allOrders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
    return res.json({
      users: allUsers.length,
      vendors: allUsers.filter(u => u.role === "vendor").length,
      providers: allUsers.filter(u => u.role === "service_provider").length,
      products: allProducts.length,
      services: allServices.length,
      orders: allOrders.length,
      bookings: allBookings.length,
      revenue,
    });
  });

  app.get("/api/admin/users", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const { search, role } = req.query as Record<string, string>;
    let rows = await db.select().from(users).orderBy(desc(users.createdAt));
    if (role && role !== "all") rows = rows.filter(u => u.role === role);
    if (search) rows = rows.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
    return res.json(rows.map(safeUser));
  });

  app.put("/api/admin/users/:id/role", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { role } = z.object({ role: z.enum(["user", "vendor", "service_provider", "delivery_rider", "admin"]) }).parse(req.body);
      const [u] = await db.update(users).set({ role }).where(eq(users.id, param(req, "id"))).returning();
      return res.json(safeUser(u));
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    await db.delete(users).where(eq(users.id, param(req, "id")));
    return res.json({ success: true });
  });

  app.get("/api/admin/orders", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    return res.json(rows);
  });

  app.get("/api/admin/bookings", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(bookings).orderBy(desc(bookings.createdAt));
    return res.json(rows);
  });

  // ────────────────────────────────────────────────────────────────
  // BANNERS
  // ────────────────────────────────────────────────────────────────
  app.get("/api/banners", async (_req, res) => {
    const rows = await db.select().from(banners).where(eq(banners.isActive, true)).orderBy(banners.sortOrder);
    return res.json(rows);
  });

  // ────────────────────────────────────────────────────────────────
  // FLASH DEALS
  // ────────────────────────────────────────────────────────────────
  app.get("/api/flash-deals", async (_req, res) => {
    const now = new Date();
    const deals = await db.select().from(flashDeals)
      .where(and(eq(flashDeals.isActive, true), gt(flashDeals.endTime, now)))
      .orderBy(desc(flashDeals.discountPercent));
    if (deals.length === 0) return res.json([]);
    const productIds = deals.map(d => d.productId);
    const prods = await db.select().from(products).where(and(inArray(products.id, productIds), eq(products.inStock, true), gt(products.stock, 0)));
    return res.json(deals.map((d: any) => ({ ...d, product: prods.find((p: any) => p.id === d.productId) })).filter((d: any) => d.product));
  });

  // ────────────────────────────────────────────────────────────────
  // ACTIVITY & RECOMMENDATIONS
  // ────────────────────────────────────────────────────────────────
  app.post("/api/activity", optionalAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { type, targetId, category, searchQuery } = req.body;
    if (user) {
      await db.insert(userActivity).values({ userId: user.id, type, targetId: targetId ?? null, category: category ?? null, searchQuery: searchQuery ?? null }).catch(() => {});
    }
    return res.json({ success: true });
  });

  app.get("/api/recommendations", optionalAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 24);
    if (user) {
      const activity = await db.select().from(userActivity).where(eq(userActivity.userId, user.id)).orderBy(desc(userActivity.createdAt)).limit(100);
      const catCounts: Record<string, number> = {};
      for (const a of activity) { if (a.category) catCounts[a.category] = (catCounts[a.category] || 0) + 1; }
      const preferredCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 3);
      const viewedIds = activity.filter(a => a.type === "view" && a.targetId).map(a => a.targetId!);
      if (preferredCats.length > 0) {
        const catProds = await db.select().from(products)
          .where(and(eq(products.inStock, true), gt(products.stock, 0), inArray(products.category, preferredCats)))
          .orderBy(desc(products.soldCount)).limit(limit);
        const filtered = catProds.filter(p => !viewedIds.includes(p.id));
        if (filtered.length >= 4) return res.json(filtered.slice(0, limit));
      }
    }
    const recs = await db.select().from(products).where(and(eq(products.inStock, true), gt(products.stock, 0), eq(products.isFeatured, true))).orderBy(desc(products.soldCount)).limit(limit);
    return res.json(recs);
  });

  // ────────────────────────────────────────────────────────────────
  // ENHANCED SEARCH
  // ────────────────────────────────────────────────────────────────
  app.get("/api/search", async (req: Request, res: Response) => {
    const { q, category, minPrice, maxPrice, minRating, sort, freeShipping, isNew, isSale } = req.query as Record<string, string>;
    let rows = await db.select().from(products).where(and(eq(products.inStock, true), gt(products.stock, 0)));
    if (q) {
      const ql = q.toLowerCase();
      rows = rows.filter(p => p.name.toLowerCase().includes(ql) || p.brand.toLowerCase().includes(ql) || (p.description || "").toLowerCase().includes(ql) || p.category.toLowerCase().includes(ql));
    }
    if (category && category !== "all") rows = rows.filter(p => p.category === category);
    if (minPrice) rows = rows.filter(p => p.price >= parseInt(minPrice));
    if (maxPrice) rows = rows.filter(p => p.price <= parseInt(maxPrice));
    if (minRating) rows = rows.filter(p => p.rating >= parseFloat(minRating));
    if (freeShipping === "true") rows = rows.filter(p => p.freeShipping);
    if (isNew === "true") rows = rows.filter(p => p.isNew);
    if (isSale === "true") rows = rows.filter(p => p.isSale);
    if (sort === "price_asc") rows.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") rows.sort((a, b) => b.price - a.price);
    else if (sort === "rating") rows.sort((a, b) => b.rating - a.rating);
    else if (sort === "newest") rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else rows.sort((a, b) => b.soldCount - a.soldCount);
    return res.json(rows);
  });

  // ────────────────────────────────────────────────────────────────
  // ADDRESSES
  // ────────────────────────────────────────────────────────────────
  app.get("/api/addresses", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(addresses).where(eq(addresses.userId, user.id)).orderBy(desc(addresses.isDefault));
    return res.json(rows);
  });

  app.post("/api/addresses", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const schema = z.object({ label: z.string().default("Home"), fullName: z.string().min(1), phone: z.string().min(1), address: z.string().min(1), city: z.string().min(1), region: z.string().min(1), isDefault: z.boolean().default(false) });
    const data = schema.parse(req.body);
    if (data.isDefault) await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    const [addr] = await db.insert(addresses).values({ ...data, userId: user.id }).returning();
    return res.json(addr);
  });

  app.put("/api/addresses/:id", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const schema = z.object({ label: z.string().optional(), fullName: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), city: z.string().optional(), region: z.string().optional(), isDefault: z.boolean().optional() });
    const data = schema.parse(req.body);
    if (data.isDefault) await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    const [addr] = await db.update(addresses).set(data).where(and(eq(addresses.id, param(req, "id")), eq(addresses.userId, user.id))).returning();
    return res.json(addr);
  });

  app.delete("/api/addresses/:id", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.delete(addresses).where(and(eq(addresses.id, param(req, "id")), eq(addresses.userId, user.id)));
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // VENDOR PROFILES
  // ────────────────────────────────────────────────────────────────
  app.get("/api/vendors/me/profile", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [vp] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
    return res.json(vp || null);
  });

  app.get("/api/admin/vendors", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select({ profile: vendorProfiles, user: users }).from(vendorProfiles).leftJoin(users, eq(vendorProfiles.userId, users.id)).orderBy(desc(vendorProfiles.updatedAt));
    const allProducts = await db.select().from(products);
    return res.json(rows.map(r => {
      const vendorProducts = allProducts.filter(p => p.vendorId === r.profile.userId);
      const lowStockProducts = vendorProducts.filter(p => Number(p.stock || 0) <= 5);
      const completenessScore = vendorProfileCompleteness(r.profile, vendorProducts.length);
      const totalStock = vendorProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
      const lastProductAt = vendorProducts
        .map(p => p.createdAt)
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
      return {
        ...r.profile,
        user: r.user ? safeUser(r.user) : null,
        productCount: vendorProducts.length,
        activeProductCount: vendorProducts.filter(p => p.inStock).length,
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
          completenessScore,
        }
      };
    }));
  });

  app.get("/api/vendors/:id", async (req: Request, res: Response) => {
    const [vp] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, param(req, "id"))).limit(1);
    if (!vp) return res.status(404).json({ message: "Vendor not found" });
    const [vendorUser] = await db.select().from(users).where(eq(users.id, param(req, "id"))).limit(1);
    const vendorProducts = await db.select().from(products).where(and(eq(products.vendorId, param(req, "id")), eq(products.inStock, true), gt(products.stock, 0))).orderBy(desc(products.soldCount));
    const vendorReviews = await db.select().from(reviews).where(and(eq(reviews.targetId, param(req, "id")), eq(reviews.targetType, "vendor"))).orderBy(desc(reviews.createdAt)).limit(10);
    return res.json({ ...vp, vendorName: vendorUser?.name, products: vendorProducts, reviews: vendorReviews, productCount: vendorProducts.length });
  });

  app.put("/api/vendors/profile", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const user = (req as any).user;
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
      payoutMethod: z.enum(["bank_transfer", "mobile_money"]).optional().or(z.literal("")),
      bankName: z.string().optional(),
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      mobileMoneyProvider: z.string().optional(),
      mobileMoneyNumber: z.string().optional(),
      internalNotes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
    if (existing.length === 0) {
      const [vp] = await db.insert(vendorProfiles).values({ userId: user.id, storeName: data.storeName || user.businessName || user.name, ...data }).returning();
      return res.json(vp);
    }

    const current = existing[0] as any;
    const isLockedVerified = current.verificationStatus === "verified" || current.profileEditLocked === true;
    if (isLockedVerified) {
      const [vp] = await db.update(vendorProfiles).set({
        pendingProfileChanges: data,
        profileChangeStatus: "pending",
        profileChangeNote: null,
        profileChangeRequestedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(vendorProfiles.userId, user.id)).returning();
      await db.insert(notifications).values({
        userId: user.id,
        type: "profile_change_request",
        title: "Profile update request submitted",
        body: "Your store is verified, so profile changes must be approved by admin before they go live.",
        icon: "shield-checkmark",
        color: "#0EA47A",
      });
      return res.json({ ...vp, changeRequestSubmitted: true, message: "Profile change request submitted for admin approval." });
    }

    const [vp] = await db.update(vendorProfiles).set({ ...data, updatedAt: new Date() }).where(eq(vendorProfiles.userId, user.id)).returning();
    return res.json(vp);
  });

  // ────────────────────────────────────────────────────────────────
  // PROVIDER PROFILES
  // ────────────────────────────────────────────────────────────────
  app.get("/api/providers/me/profile", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [pp] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
    return res.json(pp || null);
  });

  app.get("/api/providers/:id", async (req: Request, res: Response) => {
    const [pp] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, param(req, "id"))).limit(1);
    if (!pp) return res.status(404).json({ message: "Provider not found" });
    const providerServices = await db.select().from(services).where(eq(services.providerId, param(req, "id")));
    const providerReviews = await db.select().from(reviews).where(and(eq(reviews.targetId, param(req, "id")), eq(reviews.targetType, "provider"))).orderBy(desc(reviews.createdAt)).limit(10);
    return res.json({ ...pp, services: providerServices, reviews: providerReviews, serviceCount: providerServices.length });
  });

  app.put("/api/providers/profile", requireAuth, requireRole("service_provider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const schema = z.object({
      displayName: z.string().optional(), bio: z.string().optional(), location: z.string().optional(),
      serviceAreas: z.array(z.string()).optional(), certifications: z.array(z.string()).optional(),
      whatsapp: z.string().optional(), responseTime: z.string().optional(),
      payoutMethod: z.enum(["bank_transfer", "mobile_money"]).optional().or(z.literal("")),
      bankName: z.string().optional(), accountName: z.string().optional(), accountNumber: z.string().optional(),
      mobileMoneyProvider: z.string().optional(), mobileMoneyNumber: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
    if (existing.length === 0) {
      const [pp] = await db.insert(providerProfiles).values({ userId: user.id, displayName: data.displayName || user.businessName || user.name, ...data }).returning();
      return res.json(pp);
    }
    const [pp] = await db.update(providerProfiles).set({ ...data, updatedAt: new Date() }).where(eq(providerProfiles.userId, user.id)).returning();
    return res.json(pp);
  });

  // ────────────────────────────────────────────────────────────────
  // COUPONS
  // ────────────────────────────────────────────────────────────────
  app.post("/api/coupons/validate", requireAuth, async (req: Request, res: Response) => {
    const { code, orderTotal } = req.body;
    if (!code) return res.status(400).json({ message: "Coupon code required" });
    const [coupon] = await db.select().from(coupons).where(and(eq(coupons.code, code.toUpperCase()), eq(coupons.isActive, true))).limit(1);
    if (!coupon) return res.status(404).json({ message: "Invalid coupon code" });
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return res.status(400).json({ message: "Coupon usage limit reached" });
    if (coupon.expiresAt && new Date() > coupon.expiresAt) return res.status(400).json({ message: "Coupon has expired" });
    if (coupon.minOrder && orderTotal < coupon.minOrder) return res.status(400).json({ message: `Min order D${coupon.minOrder} required` });
    const discount = coupon.type === "percent" ? Math.round(orderTotal * (coupon.value / 100)) : coupon.value;
    return res.json({ valid: true, coupon, discount: Math.min(discount, orderTotal), description: coupon.description });
  });

  // ────────────────────────────────────────────────────────────────
  // REVIEWS
  // ────────────────────────────────────────────────────────────────
  app.get("/api/reviews/:targetType/:targetId", async (req: Request, res: Response) => {
    const rows = await db.select().from(reviews).where(and(eq(reviews.targetId, param(req, "targetId")), eq(reviews.targetType, param(req, "targetType")))).orderBy(desc(reviews.createdAt)).limit(50);
    return res.json(rows);
  });

  app.post("/api/reviews/:targetType/:targetId", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const targetType = z.enum(["product", "service"]).parse(param(req, "targetType"));
      const targetId = param(req, "targetId");
      const { rating, text } = z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().min(5).max(2000) }).parse(req.body);
      const result = await createVerifiedCustomerReview(user, targetType, targetId, rating, text);
      if (result.error) return res.status(result.status).json({ message: result.error });
      return res.status(201).json(result.review);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid review" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/reviews/:id/helpful", requireAuth, async (req: Request, res: Response) => {
    const [rev] = await db.select().from(reviews).where(eq(reviews.id, param(req, "id"))).limit(1);
    if (!rev) return res.status(404).json({ message: "Review not found" });
    const [updated] = await db.update(reviews).set({ helpful: rev.helpful + 1 }).where(eq(reviews.id, param(req, "id"))).returning();
    return res.json(updated);
  });

  // ────────────────────────────────────────────────────────────────
  // PROFILE
  // ────────────────────────────────────────────────────────────────
  app.get("/api/profile/me", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    const [[oc], [wc], [bc]] = await Promise.all([
      db.select({ value: count() }).from(orders).where(eq(orders.userId, u.id)),
      db.select({ value: count() }).from(wishlistItems).where(eq(wishlistItems.userId, u.id)),
      db.select({ value: count() }).from(bookings).where(eq(bookings.userId, u.id)),
    ]);
    return res.json({ ...safeUser(u), stats: { orders: Number(oc.value), wishlist: Number(wc.value), bookings: Number(bc.value) } });
  });

  app.put("/api/profile", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const schema = z.object({ name: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), city: z.string().optional(), region: z.string().optional(), gender: z.string().optional(), dateOfBirth: z.string().optional(), bio: z.string().optional(), businessName: z.string().optional(), businessType: z.string().optional(), avatar: z.string().optional() });
    const data = schema.parse(req.body);
    if (isPersonalProfileLocked(user)) {
      const u = await submitPersonalProfileChange(user, data);
      return res.json({ ...safeUser(u), changeRequestSubmitted: true, message: "Your verified personal details are locked. Changes were sent to admin for approval." });
    }
    const [u] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
    return res.json(safeUser(u));
  });

  app.put("/api/profile/documents", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { documents, avatar } = z.object({
        documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string(), uploadedAt: z.string().optional(), status: z.string().optional() })).optional(),
        avatar: z.string().optional(),
      }).parse(req.body);
      const updateData: any = { updatedAt: new Date() };
      if (documents) {
        updateData.personalDocuments = documents.map(d => ({ ...d, status: d.status || "submitted", uploadedAt: d.uploadedAt || new Date().toISOString() }));
        if (user.verificationStatus === "not_submitted") updateData.verificationStatus = "pending";
      }
      if (avatar) {
        if (isPersonalProfileLocked(user)) {
          updateData.pendingProfileChanges = { ...(user.pendingProfileChanges || {}), avatar };
          updateData.profileChangeStatus = "pending";
          updateData.profileChangeRequestedAt = new Date();
        } else {
          updateData.avatar = avatar;
        }
      }
      const [u] = await db.update(users).set(updateData).where(eq(users.id, user.id)).returning();
      return res.json(safeUser(u));
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/profile/change-password", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string(), newPassword: z.string().min(6) }).parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    const valid = await comparePassword(currentPassword, u.password);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
    const hashed = await hashPassword(newPassword);
    await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, user.id));
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // ADMIN VERIFICATION
  // ────────────────────────────────────────────────────────────────
  app.get("/api/admin/verifications", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const pendingPersonal = await db.select().from(users).where(eq(users.verificationStatus, "pending"));
    const pendingVendors = await db.select().from(vendorProfiles).where(eq(vendorProfiles.verificationStatus, "pending"));
    const pendingProviders = await db.select().from(providerProfiles).where(eq(providerProfiles.verificationStatus, "pending"));
    const pendingRiders = await db.select().from(deliveryRiders).where(eq(deliveryRiders.verificationStatus, "pending"));
    const allIds = [
      ...pendingVendors.map((v: any) => v.userId),
      ...pendingProviders.map((p: any) => p.userId),
      ...pendingRiders.map((r: any) => r.userId),
    ];
    const allUsers = allIds.length > 0 ? await db.select().from(users).where(inArray(users.id, allIds)) : [];
    return res.json([
      ...pendingPersonal.map((u: any) => ({ ...safeUser(u), type: "personal", userId: u.id, user: safeUser(u) })),
      ...pendingVendors.map((v: any) => ({ ...v, type: "vendor", user: allUsers.find((u: any) => u.id === v.userId) })),
      ...pendingProviders.map((p: any) => ({ ...p, type: "provider", user: allUsers.find((u: any) => u.id === p.userId) })),
      ...pendingRiders.map((r: any) => ({ ...r, type: "rider", user: allUsers.find((u: any) => u.id === r.userId) })),
    ]);
  });

  app.put("/api/admin/verify/personal/:userId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [u] = await db.update(users).set({ verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified", profileChangeNote: note, updatedAt: new Date() }).where(eq(users.id, param(req, "userId"))).returning();
    if (!u) return res.status(404).json({ message: "User not found" });
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "🎉 Profile Verified!" : "Verification Update", body: status === "verified" ? "Your personal profile has been verified. Future personal changes require admin approval." : `Verification update: ${note || "Please resubmit your documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(safeUser(u as any));
  });

  app.put("/api/admin/verify/vendor/:userId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [vp] = await db.update(vendorProfiles).set({ verificationStatus: status, verificationNote: note, profileEditLocked: status === "verified", updatedAt: new Date() }).where(eq(vendorProfiles.userId, param(req, "userId"))).returning();
    if (!vp) return res.status(404).json({ message: "Vendor profile not found" });
    await db.update(users).set({ role: "vendor", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "🎉 Store Verified!" : "Verification Update", body: status === "verified" ? "Your store has been verified! You can now sell on MansaMart." : `Verification update: ${note || "Please resubmit your documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(vp);
  });

  app.put("/api/admin/verify/provider/:userId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [pp] = await db.update(providerProfiles).set({ verificationStatus: status, verificationNote: note, updatedAt: new Date() }).where(eq(providerProfiles.userId, param(req, "userId"))).returning();
    if (!pp) return res.status(404).json({ message: "Provider profile not found" });
    await db.update(users).set({ role: "service_provider", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "🎉 Profile Verified!" : "Verification Update", body: status === "verified" ? "Your provider profile has been verified!" : `Update: ${note || "Please resubmit documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(pp);
  });

  app.put("/api/admin/verify/rider/:userId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [rider] = await db.update(deliveryRiders).set({ verificationStatus: status, updatedAt: new Date() }).where(eq(deliveryRiders.userId, param(req, "userId"))).returning();
    if (!rider) return res.status(404).json({ message: "Rider profile not found" });
    await db.update(users).set({ role: "delivery_rider", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "Rider Approved" : "Rider Application Update", body: status === "verified" ? "You can now receive delivery requests on MansaMart." : (note || "Your rider application was not approved."), icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(rider);
  });

  app.get("/api/admin/personal-profile-change-requests", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(users).where(eq(users.profileChangeStatus, "pending")).orderBy(desc(users.profileChangeRequestedAt));
    return res.json(rows.map(u => ({ ...safeUser(u as any), type: "personal_change" })));
  });

  app.put("/api/admin/personal-profile-change/:userId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { action, note } = z.object({ action: z.enum(["approve", "reject"]), note: z.string().optional() }).parse(req.body);
      const [u] = await db.select().from(users).where(eq(users.id, param(req, "userId"))).limit(1);
      if (!u) return res.status(404).json({ message: "User not found" });
      const pending = (u as any).pendingProfileChanges || {};
      const updateData: any = { profileChangeReviewedAt: new Date(), updatedAt: new Date() };
      if (action === "approve") {
        Object.assign(updateData, pending, { pendingProfileChanges: {}, profileChangeStatus: "approved", profileChangeNote: note || "Approved" });
      } else {
        Object.assign(updateData, { profileChangeStatus: "rejected", profileChangeNote: note || "Rejected" });
      }
      const [updated] = await db.update(users).set(updateData).where(eq(users.id, param(req, "userId"))).returning();
      return res.json(safeUser(updated));
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/vendor-profile-change-requests", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select({ profile: vendorProfiles, user: users }).from(vendorProfiles)
      .leftJoin(users, eq(vendorProfiles.userId, users.id))
      .where(eq(vendorProfiles.profileChangeStatus, "pending"))
      .orderBy(desc(vendorProfiles.profileChangeRequestedAt));
    return res.json(rows.map(r => ({ ...r.profile, user: r.user ? safeUser(r.user) : null })));
  });

  app.put("/api/admin/vendor-profile-change/:userId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const { action, note } = z.object({ action: z.enum(["approve", "reject"]), note: z.string().optional() }).parse(req.body);
    const userId = param(req, "userId");
    const [profile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, userId)).limit(1);
    if (!profile) return res.status(404).json({ message: "Vendor profile not found" });
    const pending = (profile as any).pendingProfileChanges || {};
    const updateData: any = {
      profileChangeStatus: action === "approve" ? "approved" : "rejected",
      profileChangeNote: note || null,
      profileChangeReviewedAt: new Date(),
      updatedAt: new Date(),
    };
    if (action === "approve") {
      Object.assign(updateData, pending);
      updateData.pendingProfileChanges = {};
    }
    const [updated] = await db.update(vendorProfiles).set(updateData).where(eq(vendorProfiles.userId, userId)).returning();
    await db.insert(notifications).values({
      userId,
      type: "profile_change_review",
      title: action === "approve" ? "Profile changes approved" : "Profile changes rejected",
      body: action === "approve" ? "Your requested store profile changes are now live." : (note || "Your requested profile changes were not approved."),
      icon: action === "approve" ? "checkmark-circle" : "close-circle",
      color: action === "approve" ? "#0EA47A" : "#E63946",
    });
    return res.json(updated);
  });

  // ────────────────────────────────────────────────────────────────
  // ADMIN - Enhanced Stats
  // ────────────────────────────────────────────────────────────────
  app.get("/api/admin/verifications/count", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const [uc] = await db.select({ value: count() }).from(users).where(eq(users.verificationStatus, "pending"));
    const [vc] = await db.select({ value: count() }).from(vendorProfiles).where(eq(vendorProfiles.verificationStatus, "pending"));
    const [pc] = await db.select({ value: count() }).from(providerProfiles).where(eq(providerProfiles.verificationStatus, "pending"));
    const [cc] = await db.select({ value: count() }).from(vendorProfiles).where(eq(vendorProfiles.profileChangeStatus, "pending"));
    const [ucc] = await db.select({ value: count() }).from(users).where(eq(users.profileChangeStatus, "pending"));
    return res.json({ total: Number(uc.value) + Number(vc.value) + Number(pc.value) + Number(cc.value) + Number(ucc.value), personal: Number(uc.value), vendors: Number(vc.value), providers: Number(pc.value), profileChanges: Number(cc.value) + Number(ucc.value) });
  });


  // ────────────────────────────────────────────────────────────────
  // VENDOR ADVANCED DASHBOARD
  // ────────────────────────────────────────────────────────────────
  app.get("/api/vendor/dashboard", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [profile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
      const vendorProducts = await db.select().from(products).where(eq(products.vendorId, user.id)).orderBy(desc(products.createdAt));
      const vendorOrders = await getOrdersForVendor(user.id);
      const revenue = vendorOrders
        .filter(o => ["paid", "settled"].includes(o.paymentStatus) && !["cancelled", "refunded"].includes(o.status))
        .reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
      const lowStock = vendorProducts.filter(p => p.stock <= 5).slice(0, 10);
      const categoryStats = Object.values(vendorProducts.reduce((acc: Record<string, any>, p) => {
        const key = p.category || "Other";
        acc[key] = acc[key] || { category: key, products: 0, revenue: 0, sold: 0 };
        acc[key].products += 1;
        acc[key].sold += p.soldCount || 0;
        return acc;
      }, {}));
      const completenessScore = vendorProfileCompleteness(profile, vendorProducts.length);
      const stats = {
        products: vendorProducts.length,
        activeProducts: vendorProducts.filter(p => p.inStock).length,
        lowStock: lowStock.length,
        orders: vendorOrders.length,
        pendingOrders: vendorOrders.filter(o => o.vendorStatus === "pending").length,
        preparingOrders: vendorOrders.filter(o => o.vendorStatus === "confirmed" || o.vendorStatus === "preparing").length,
        revenue,
        avgRating: vendorProducts.length ? Number((vendorProducts.reduce((s, p) => s + p.rating, 0) / vendorProducts.length).toFixed(1)) : 0,
        completenessScore,
        profileHealth: vendorHealthLabel(completenessScore, profile?.verificationStatus),
      };
      return res.json({ profile, stats, lowStock, categoryStats, recentOrders: vendorOrders.slice(0, 8), recentProducts: vendorProducts.slice(0, 8) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to load vendor dashboard" });
    }
  });

  app.get("/api/provider/dashboard", requireAuth, requireRole("service_provider", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
      const providerServices = await db.select().from(services).where(eq(services.providerId, user.id)).orderBy(desc(services.createdAt));
      const providerBookings = await db.select().from(bookings).where(eq(bookings.providerId, user.id)).orderBy(desc(bookings.createdAt));
      const completedBookings = providerBookings.filter((booking) => booking.status === "completed");
      const revenue = completedBookings.reduce((sum, booking) => sum + Number(booking.price || 0), 0);
      return res.json({
        profile,
        stats: {
          services: providerServices.length,
          activeServices: providerServices.filter((service) => service.isAvailable).length,
          bookings: providerBookings.length,
          pendingBookings: providerBookings.filter((booking) => booking.status === "pending").length,
          confirmedBookings: providerBookings.filter((booking) => booking.status === "confirmed" || booking.status === "in_progress").length,
          completedBookings: completedBookings.length,
          revenue,
          rating: profile?.rating || 0,
        },
        recentBookings: providerBookings.slice(0, 8),
        recentServices: providerServices.slice(0, 8),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to load provider dashboard" });
    }
  });

  app.get("/api/vendor/low-stock", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(products).where(eq(products.vendorId, user.id)).orderBy(products.stock);
    return res.json(rows.filter(p => p.stock <= 10));
  });

  app.put("/api/vendor/products/:id/stock", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { stock } = z.object({ stock: z.number().int().min(0) }).parse(req.body);
      const [product] = await db.select().from(products).where(and(eq(products.id, param(req, "id")), eq(products.vendorId, user.id))).limit(1);
      if (!product && user.role !== "admin") return res.status(404).json({ message: "Product not found" });
      const [updated] = await db.update(products).set({ stock, inStock: stock > 0 }).where(eq(products.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // SHOPPER PROFILE & DASHBOARD
  // ────────────────────────────────────────────────────────────────
  app.get("/api/shopper/me", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [profile] = await db.select().from(shopperProfiles).where(eq(shopperProfiles.userId, user.id)).limit(1);
    const [[orderCount], [wishCount], [bookingCount]] = await Promise.all([
      db.select({ value: count() }).from(orders).where(eq(orders.userId, user.id)),
      db.select({ value: count() }).from(wishlistItems).where(eq(wishlistItems.userId, user.id)),
      db.select({ value: count() }).from(bookings).where(eq(bookings.userId, user.id)),
    ]);
    const userOrders = await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(5);
    return res.json({
      profile,
      stats: { orders: Number(orderCount.value), wishlist: Number(wishCount.value), bookings: Number(bookingCount.value), loyaltyPoints: user.loyaltyPoints || 0 },
      recentOrders: userOrders,
    });
  });

  app.put("/api/shopper/me", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const data = z.object({
      preferredCategories: z.array(z.string()).optional(),
      preferredLocation: z.string().optional(),
      defaultDeliveryAddress: z.string().optional(),
      defaultPhone: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    const [existing] = await db.select().from(shopperProfiles).where(eq(shopperProfiles.userId, user.id)).limit(1);
    if (!existing) {
      const [created] = await db.insert(shopperProfiles).values({ userId: user.id, ...data }).returning();
      return res.json(created);
    }
    const [updated] = await db.update(shopperProfiles).set({ ...data, updatedAt: new Date() }).where(eq(shopperProfiles.userId, user.id)).returning();
    return res.json(updated);
  });

  // ────────────────────────────────────────────────────────────────
  // VENDOR TOOLS - FLASH DEALS
  // ────────────────────────────────────────────────────────────────
  app.get("/api/vendor/flash-deals", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const vendorProds = await db.select().from(products).where(eq(products.vendorId, user.id));
      const productIds = vendorProds.map(p => p.id);
      if (productIds.length === 0) return res.json([]);
      const deals = await db.select().from(flashDeals).where(
        and(inArray(flashDeals.productId, productIds), eq(flashDeals.isActive, true))
      ).orderBy(desc(flashDeals.createdAt));
      const dealsWithProducts = deals.map(d => ({ ...d, product: vendorProds.find(p => p.id === d.productId) }));
      return res.json(dealsWithProducts);
    } catch { return res.json([]); }
  });

  app.post("/api/vendor/flash-deals", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { productId, dealPrice, discountPercent, durationHours } = z.object({
        productId: z.string(),
        dealPrice: z.number().positive(),
        discountPercent: z.number().min(1).max(99),
        durationHours: z.number().min(1).max(168),
      }).parse(req.body);
      const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.vendorId, user.id))).limit(1);
      if (!product) return res.status(404).json({ message: "Product not found or not yours" });
      const [profile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
      if (!isBusinessVerified(profile)) return res.status(403).json({ message: "Your vendor profile must be verified before creating promotions." });
      if (dealPrice >= product.price) return res.status(400).json({ message: "Deal price must be lower than the current product price." });
      const verifiedDiscount = Math.max(1, Math.min(99, Math.round((1 - dealPrice / product.price) * 100)));
      const startTime = new Date();
      const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
      const [deal] = await db.insert(flashDeals).values({
        productId, dealPrice, discountPercent: verifiedDiscount, originalPrice: product.price, startTime, endTime, isActive: true,
      }).returning();
      return res.status(201).json({ ...deal, product });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/vendor/flash-deals/:id", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [deal] = await db.select().from(flashDeals).where(eq(flashDeals.id, param(req, "id"))).limit(1);
      if (!deal) return res.status(404).json({ message: "Not found" });
      if (user.role !== "admin") {
        const [product] = await db.select().from(products).where(eq(products.id, deal.productId)).limit(1);
        if (!product || product.vendorId !== user.id) return res.status(403).json({ message: "Forbidden" });
      }
      await db.update(flashDeals).set({ isActive: false }).where(eq(flashDeals.id, param(req, "id")));
      return res.json({ success: true });
    } catch { return res.status(500).json({ message: "Server error" }); }
  });

  // ────────────────────────────────────────────────────────────────
  // VENDOR TOOLS - PROMOTE / FEATURE
  // ────────────────────────────────────────────────────────────────
  app.post("/api/vendor/promote/:id", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [product] = await db.select().from(products).where(and(eq(products.id, param(req, "id")), eq(products.vendorId, user.id))).limit(1);
      if (!product) return res.status(404).json({ message: "Product not found or not yours" });
      const [profile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
      if (!isBusinessVerified(profile)) return res.status(403).json({ message: "Your vendor profile must be verified before featuring products." });
      const [updated] = await db.update(products).set({ isFeatured: true }).where(eq(products.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch { return res.status(500).json({ message: "Server error" }); }
  });

  // ────────────────────────────────────────────────────────────────
  // VENDOR PROFILE - DOCUMENTS UPDATE
  // ────────────────────────────────────────────────────────────────
  app.put("/api/vendors/me/documents", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { documents, logo, coverImage } = z.object({
        documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string(), uploadedAt: z.string().optional(), status: z.string().optional() })).optional(),
        logo: z.string().optional(),
        coverImage: z.string().optional(),
      }).parse(req.body);
      const existing = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
      if (!existing.length) return res.status(404).json({ message: "Vendor profile not found" });
      const current = existing[0] as any;
      const updateData: any = { updatedAt: new Date() };
      if (documents) {
        updateData.documents = documents.map(d => ({ ...d, status: d.status || "submitted", uploadedAt: d.uploadedAt || new Date().toISOString() }));
        if (current.verificationStatus === "not_submitted") updateData.verificationStatus = "pending";
      }
      if (logo || coverImage) {
        if (current.verificationStatus === "verified" || current.profileEditLocked === true) {
          updateData.pendingProfileChanges = { ...(current.pendingProfileChanges || {}), ...(logo ? { logo } : {}), ...(coverImage ? { coverImage } : {}) };
          updateData.profileChangeStatus = "pending";
          updateData.profileChangeRequestedAt = new Date();
        } else {
          if (logo) updateData.logo = logo;
          if (coverImage) updateData.coverImage = coverImage;
        }
      }
      const [vp] = await db.update(vendorProfiles)
        .set(updateData)
        .where(eq(vendorProfiles.userId, user.id)).returning();
      if (!vp) return res.status(404).json({ message: "Vendor profile not found" });
      return res.json(vp);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/providers/me/documents", requireAuth, requireRole("service_provider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { certifications, documents, profileImage, coverImage } = z.object({
        certifications: z.array(z.string()).optional(),
        documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string() })).optional(),
        profileImage: z.string().optional(),
        coverImage: z.string().optional(),
      }).parse(req.body);
      const [pp] = await db.update(providerProfiles)
        .set({ ...(certifications ? { certifications } : {}), ...(documents ? { documents, verificationStatus: "pending" } : {}), ...(profileImage ? { profileImage } : {}), ...(coverImage ? { coverImage } : {}), updatedAt: new Date() })
        .where(eq(providerProfiles.userId, user.id)).returning();
      if (!pp) return res.status(404).json({ message: "Provider profile not found" });
      return res.json(pp);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });



  // ────────────────────────────────────────────────────────────────
  // WALLET, COMMISSION & PAYOUTS
  // ────────────────────────────────────────────────────────────────
  async function getOrCreateWallet(userId: string) {
    const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    if (existing) return existing;
    const [created] = await db.insert(wallets).values({ userId, balance: 0, pendingBalance: 0, lockedBalance: 0 }).returning();
    return created;
  }

  async function addWalletTransaction(args: {
    userId: string; type: string; direction: "credit" | "debit"; amount: number;
    status?: string; method?: string; reference?: string; description?: string; orderId?: string; bookingId?: string;
  }) {
    const wallet = await getOrCreateWallet(args.userId);
    const before = wallet.balance;
    const after = args.direction === "credit" ? before + args.amount : before - args.amount;
    if (after < 0) throw new Error("Insufficient wallet balance");
    const [updatedWallet] = await db.update(wallets)
      .set({ balance: after, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))
      .returning();
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
      description: args.description,
    }).returning();
    return { wallet: updatedWallet, transaction: tx };
  }

  app.get("/api/wallet", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const wallet = await getOrCreateWallet(user.id);
    const recent = await db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(30);
    return res.json({ wallet, transactions: recent });
  });

  app.get("/api/business/finance", requireAuth, requireRole("vendor", "service_provider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const wallet = await getOrCreateWallet(user.id);
    const [recentTransactions, recentSettlements, recentPayouts] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(50),
      db.select().from(settlements).where(eq(settlements.beneficiaryId, user.id)).orderBy(desc(settlements.createdAt)).limit(50),
      db.select().from(payouts).where(eq(payouts.userId, user.id)).orderBy(desc(payouts.createdAt)).limit(50),
    ]);
    const pendingAmounts = recentPayouts.filter((payout) => payout.status === "pending").map((payout) => payout.amount);
    const [profile] = user.role === "vendor"
      ? await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1)
      : await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
    return res.json({
      wallet,
      transactions: recentTransactions,
      settlements: recentSettlements,
      payouts: recentPayouts,
      summary: {
        availableForPayout: availablePayoutBalance(wallet.balance, pendingAmounts),
        pendingPayout: pendingAmounts.reduce((sum, amount) => sum + amount, 0),
        totalSettled: recentSettlements.filter((settlement) => settlement.status === "completed").reduce((sum, settlement) => sum + settlement.amount, 0),
        totalPaidOut: recentPayouts.filter((payout) => payout.status === "completed").reduce((sum, payout) => sum + payout.amount, 0),
      },
      payoutProfile: {
        verificationStatus: profile?.verificationStatus || "pending",
        method: profile?.payoutMethod || (profile?.mobileMoneyNumber ? "mobile_money" : profile?.accountNumber ? "bank_transfer" : ""),
        accountName: profile?.accountName || user.name,
        accountNumber: profile?.mobileMoneyNumber || profile?.accountNumber || "",
        provider: profile?.mobileMoneyProvider || profile?.bankName || "",
      },
    });
  });

  app.post("/api/wallet/deposit/manual", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { amount, method, reference } = z.object({
        amount: z.number().int().positive(),
        method: z.string().default("manual_mobile_money"),
        reference: z.string().optional(),
      }).parse(req.body);
      const wallet = await getOrCreateWallet(user.id);
      const [tx] = await db.insert(transactions).values({
        walletId: wallet.id, userId: user.id, type: "deposit", direction: "credit", amount,
        balanceBefore: wallet.balance, balanceAfter: wallet.balance, status: "pending",
        method, reference, description: "Manual wallet top-up awaiting admin confirmation",
      }).returning();
      await db.insert(notifications).values({ userId: user.id, type: "wallet", title: "Deposit Submitted", body: `Your wallet top-up of D ${amount.toLocaleString()} is pending confirmation.`, icon: "wallet-outline", color: "#0EA47A" });
      return res.status(201).json(tx);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/wallet/pay-order/:orderId", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [order] = await db.select().from(orders).where(and(eq(orders.id, param(req, "orderId")), eq(orders.userId, user.id))).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.paymentStatus === "paid" || order.status === "paid") return res.status(409).json({ message: "Order is already paid" });
      await addWalletTransaction({ userId: user.id, type: "escrow_payment", direction: "debit", amount: order.total, orderId: order.id, description: `Escrow payment for order #${order.id.slice(0, 8).toUpperCase()}` });
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
        method: "wallet",
      }).catch(() => {});
      const qrs = await ensureOrderQrs(order.id);
      const [updated] = await db.update(orders).set({ paymentMethod: "wallet", paymentStatus: "paid", escrowStatus: "held", status: "paid" as any, qrCode: qrs.delivery.code, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
      await addTracking(order.id, "paid", "Payment received", "Funds are held in MansaMart escrow until delivery is verified.", user);
      await notifyOrderParties(updated, "Payment Received", "Payment is confirmed and held in escrow.", "payment");
      return res.json({ order: updated, paid: true, escrow: "held", qrs });
    } catch (err: any) {
      if (err.message === "Insufficient wallet balance") return res.status(400).json({ message: err.message });
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/payouts", requireAuth, requireRole("vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { amount, method, accountName, accountNumber } = z.object({
        amount: z.number().int().min(50),
        method: z.enum(["bank_transfer", "mobile_money"]),
        accountName: z.string().trim().min(2).max(160),
        accountNumber: z.string().trim().min(5).max(100),
      }).parse(req.body);
      if (user.role === "vendor") {
        const [profile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
        if (!isBusinessVerified(profile)) return res.status(403).json({ message: "Your vendor profile must be verified before requesting a payout." });
      } else if (user.role === "service_provider") {
        const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
        if (!isBusinessVerified(profile)) return res.status(403).json({ message: "Your provider profile must be verified before requesting a payout." });
      }
      const payout = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM wallets WHERE user_id = ${user.id} FOR UPDATE`);
        const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, user.id)).limit(1);
        if (!wallet) throw new Error("Wallet not found");
        const pending = await tx.select().from(payouts).where(and(eq(payouts.userId, user.id), eq(payouts.status, "pending")));
        const available = availablePayoutBalance(wallet.balance, pending.map((item) => item.amount));
        if (available < amount) throw new Error("Insufficient available settlement balance");
        const [created] = await tx.insert(payouts).values({ userId: user.id, amount, method, accountName, accountNumber, status: "pending" }).returning();
        return created;
      });
      return res.status(201).json(payout);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      if (["Wallet not found", "Insufficient available settlement balance"].includes(err.message)) return res.status(400).json({ message: err.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/wallet/deposits", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(transactions).where(and(eq(transactions.type, "deposit"), eq(transactions.status, "pending"))).orderBy(desc(transactions.createdAt));
    return res.json(rows);
  });

  app.put("/api/admin/wallet/deposits/:id/confirm", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, param(req, "id"))).limit(1);
    if (!tx || tx.status !== "pending" || !tx.userId) return res.status(404).json({ message: "Pending deposit not found" });
    const wallet = await getOrCreateWallet(tx.userId);
    const after = wallet.balance + tx.amount;
    await db.update(wallets).set({ balance: after, updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
    const [updated] = await db.update(transactions).set({ status: "completed", balanceBefore: wallet.balance, balanceAfter: after }).where(eq(transactions.id, tx.id)).returning();
    await db.insert(notifications).values({ userId: tx.userId, type: "wallet", title: "Deposit Confirmed", body: `D ${tx.amount.toLocaleString()} has been added to your wallet.`, icon: "wallet", color: "#0EA47A" });
    return res.json(updated);
  });

  app.get("/api/admin/commissions", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(commissions).orderBy(desc(commissions.createdAt)).limit(100);
    return res.json(rows);
  });

  app.get("/api/admin/settlements", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(settlements).orderBy(desc(settlements.createdAt)).limit(100);
    return res.json(rows);
  });

  app.get("/api/admin/payouts", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(payouts).orderBy(desc(payouts.createdAt)).limit(100);
    return res.json(rows);
  });

  app.put("/api/admin/payouts/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      const { status, note } = z.object({ status: z.enum(["approved", "rejected", "completed"]), note: z.string().trim().max(1000).optional() }).parse(req.body);
      const [current] = await db.select().from(payouts).where(eq(payouts.id, param(req, "id"))).limit(1);
      if (!current) return res.status(404).json({ message: "Payout request not found" });
      const allowed = (current.status === "pending" && ["approved", "rejected"].includes(status)) || (current.status === "approved" && ["completed", "rejected"].includes(status));
      if (!allowed) return res.status(409).json({ message: "That payout status change is not allowed" });

      const updated = await db.transaction(async (tx) => {
        if (status === "completed") {
          await tx.execute(sql`SELECT id FROM wallets WHERE user_id = ${current.userId} FOR UPDATE`);
          const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, current.userId)).limit(1);
          if (!wallet || wallet.balance < current.amount) throw new Error("Insufficient settlement balance");
          const balanceAfter = wallet.balance - current.amount;
          await tx.update(wallets).set({ balance: balanceAfter, updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
          await tx.insert(transactions).values({
            walletId: wallet.id, userId: current.userId, type: "payout", direction: "debit", amount: current.amount,
            balanceBefore: wallet.balance, balanceAfter, status: "completed", method: current.method,
            reference: current.id, description: "Business payout completed",
          });
        }
        const [row] = await tx.update(payouts).set({ status, note, updatedAt: new Date() }).where(eq(payouts.id, current.id)).returning();
        return row;
      });
      await audit(admin.id, `payout.${status}`, "payout", current.id, { amount: current.amount, userId: current.userId, note });
      await notifyUser(current.userId, "payment", "Payout Updated", `Your payout request for D ${current.amount.toLocaleString()} is now ${status}.`, "/wallet", { payoutId: current.id, status });
      return res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Invalid payout update" });
      if (error.message === "Insufficient settlement balance") return res.status(409).json({ message: error.message });
      return res.status(500).json({ message: "Payout update failed" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // DELIVERY RIDER & DISPATCH SYSTEM
  // ────────────────────────────────────────────────────────────────
  const riderDocumentSchema = z.object({
    type: z.string(),
    url: z.string(),
    name: z.string(),
    uploadedAt: z.string().optional(),
    status: z.string().optional(),
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
    documents: z.array(riderDocumentSchema).optional(),
  });

  async function ensureRiderProfile(user: typeof users.$inferSelect) {
    const [existing] = await db.select().from(deliveryRiders).where(eq(deliveryRiders.userId, user.id)).limit(1);
    if (existing) return existing;
    const [created] = await db.insert(deliveryRiders).values({
      userId: user.id,
      displayName: user.businessName || user.name,
      bio: user.bio || undefined,
      phone: user.phone || undefined,
      whatsapp: user.phone || undefined,
      currentAddress: user.address || undefined,
      city: user.city || undefined,
      region: user.region || undefined,
      area: user.area || undefined,
      serviceZones: [user.city || user.region || user.area || "The Gambia"].filter(Boolean),
      vehicleType: user.businessType || "motorbike",
      profilePhoto: user.avatar || undefined,
      latitude: user.latitude,
      longitude: user.longitude,
      isOnline: false,
      isAvailable: false,
    }).returning();
    return created;
  }

  app.get("/api/rider/me/profile", requireAuth, requireRole("delivery_rider", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    const profile = await ensureRiderProfile(user);
    const completion = await computeProfileCompletion(user);
    return res.json({ ...profile, user: safeUser(user), completion });
  });

  app.put("/api/rider/profile", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as typeof users.$inferSelect;
      await ensureRiderProfile(user);
      const data = riderProfileSchema.parse(req.body);
      const [profile] = await db.update(deliveryRiders).set({ ...data, updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id)).returning();
      await db.update(users).set({
        role: "delivery_rider",
        ...(data.displayName ? { businessName: data.displayName } : {}),
        ...(data.bio ? { bio: data.bio } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.currentAddress ? { address: data.currentAddress } : {}),
        ...(data.city ? { city: data.city } : {}),
        ...(data.region ? { region: data.region } : {}),
        ...(data.area ? { area: data.area } : {}),
        ...(data.profilePhoto ? { avatar: data.profilePhoto } : {}),
        updatedAt: new Date(),
      }).where(eq(users.id, user.id)).catch(() => {});
      const completion = await computeProfileCompletion({ ...user, avatar: data.profilePhoto || user.avatar, phone: data.phone || user.phone, address: data.currentAddress || user.address });
      return res.json({ ...profile, completion });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "Rider profile update failed" });
    }
  });

  app.put("/api/rider/me/documents", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as typeof users.$inferSelect;
      await ensureRiderProfile(user);
      const data = z.object({
        documents: z.array(riderDocumentSchema).optional(),
        profilePhoto: z.string().optional(),
        coverImage: z.string().optional(),
      }).parse(req.body);
      const [profile] = await db.update(deliveryRiders).set({ ...data, updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id)).returning();
      if (data.profilePhoto) await db.update(users).set({ avatar: data.profilePhoto, updatedAt: new Date() }).where(eq(users.id, user.id)).catch(() => {});
      const completion = await computeProfileCompletion(user);
      return res.json({ ...profile, completion });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "Rider documents update failed" });
    }
  });

  app.post("/api/rider/apply", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const data = z.object({ vehicleType: z.string().default("motorbike"), vehiclePlate: z.string().optional(), licenseNumber: z.string().optional(), documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string() })).optional() }).parse(req.body);
      const [existing] = await db.select().from(deliveryRiders).where(eq(deliveryRiders.userId, user.id)).limit(1);
      if (existing) return res.json(existing);
      const [profile] = await db.insert(deliveryRiders).values({ ...data, userId: user.id }).returning();
      await db.update(users).set({ role: "delivery_rider", verificationStatus: "pending" }).where(eq(users.id, user.id));
      return res.status(201).json(profile);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/rider/me", requireAuth, requireRole("delivery_rider", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const profile = await ensureRiderProfile(user);
    const activeDeliveries = await db.select().from(deliveries).where(eq(deliveries.riderId, user.id)).orderBy(desc(deliveries.createdAt)).limit(20);
    const offers = await db.select().from(deliveryRequests).where(and(eq(deliveryRequests.riderId, user.id), eq(deliveryRequests.status, "offered"))).orderBy(desc(deliveryRequests.createdAt)).limit(20);
    const completion = await computeProfileCompletion(user);
    return res.json({ profile, activeDeliveries, offers, completion });
  });

  app.put("/api/rider/status", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { isOnline, isAvailable, latitude, longitude } = z.object({ isOnline: z.boolean().optional(), isAvailable: z.boolean().optional(), latitude: z.number().optional(), longitude: z.number().optional() }).parse(req.body);
    const [profile] = await db.update(deliveryRiders).set({ ...(isOnline != null ? { isOnline } : {}), ...(isAvailable != null ? { isAvailable } : {}), ...(latitude != null ? { latitude } : {}), ...(longitude != null ? { longitude } : {}), updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id)).returning();
    return res.json(profile);
  });

  app.post("/api/delivery/dispatch", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { orderId, pickupAddress, pickupLatitude, pickupLongitude, dropoffAddress, dropoffLatitude, dropoffLongitude, deliveryFee } = z.object({
        orderId: z.string(), pickupAddress: z.string(), pickupLatitude: z.number().optional(), pickupLongitude: z.number().optional(), dropoffAddress: z.string(), dropoffLatitude: z.number().optional(), dropoffLongitude: z.number().optional(), deliveryFee: z.number().int().default(0),
      }).parse(req.body);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      await ensureVendorFulfillments(order);
      const parties = await getOrderParties(order);
      const fulfillments = await db.select().from(orderVendorFulfillments).where(eq(orderVendorFulfillments.orderId, orderId));
      if (user.role !== "admin" && !parties.vendorIds.includes(user.id)) return res.status(403).json({ message: "Forbidden" });
      if (user.role !== "admin" && (fulfillments.length === 0 || fulfillments.some((row) => row.status !== "ready_for_pickup"))) return res.status(409).json({ message: "Every seller must mark their items ready before dispatch." });
      const safeDropoffAddress = user.role === "admin" ? dropoffAddress : `${order.address}, ${order.city}`;
      const safeDropoffLatitude = user.role === "admin" ? dropoffLatitude : order.deliveryLatitude;
      const safeDropoffLongitude = user.role === "admin" ? dropoffLongitude : order.deliveryLongitude;
      const safeDeliveryFee = user.role === "admin" ? deliveryFee : order.shipping;
      const [delivery] = await db.insert(deliveries).values({ orderId, pickupAddress, pickupLatitude, pickupLongitude, dropoffAddress: safeDropoffAddress, dropoffLatitude: safeDropoffLatitude, dropoffLongitude: safeDropoffLongitude, deliveryFee: safeDeliveryFee, status: "searching" }).returning();
      const riders = await db.select().from(deliveryRiders).where(and(eq(deliveryRiders.isOnline, true), eq(deliveryRiders.isAvailable, true), eq(deliveryRiders.verificationStatus, "verified")));
      const nearest = riders.map(r => ({ ...r, distance: distanceKm(r.latitude, r.longitude, pickupLatitude, pickupLongitude) })).sort((a, b) => a.distance - b.distance).slice(0, 5);
      for (const rider of nearest) {
        await db.insert(deliveryRequests).values({ deliveryId: delivery.id, riderId: rider.userId, distanceKm: rider.distance, status: "offered", expiresAt: new Date(Date.now() + 60_000) });
        await db.insert(notifications).values({ userId: rider.userId, type: "delivery", title: "New Delivery Request", body: `Pickup: ${pickupAddress}. Fee: D ${deliveryFee.toLocaleString()}`, icon: "bicycle-outline", color: "#E8813A", actionRoute: "/(rider)/" });
      }
      await db.update(orders).set({ status: "rider_searching" as any, updatedAt: new Date() }).where(eq(orders.id, orderId));
      return res.status(201).json({ delivery, offeredRiders: nearest.length });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/delivery/requests/:id/accept", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [request] = await db.select().from(deliveryRequests).where(and(eq(deliveryRequests.id, param(req, "id")), eq(deliveryRequests.riderId, user.id))).limit(1);
    if (!request || request.status !== "offered") return res.status(404).json({ message: "Delivery offer not available" });
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, request.deliveryId)).limit(1);
    if (!delivery || delivery.status !== "searching") return res.status(400).json({ message: "Delivery already assigned" });
    await db.update(deliveryRequests).set({ status: "cancelled" }).where(eq(deliveryRequests.deliveryId, delivery.id));
    const [acceptedReq] = await db.update(deliveryRequests).set({ status: "accepted", respondedAt: new Date() }).where(eq(deliveryRequests.id, request.id)).returning();
    const [updatedDelivery] = await db.update(deliveries).set({ riderId: user.id, status: "assigned", acceptedAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id)).returning();
    await db.update(deliveryRiders).set({ isAvailable: false, updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id));
    await db.update(orders).set({ status: "rider_assigned" as any, updatedAt: new Date() }).where(eq(orders.id, delivery.orderId));
    return res.json({ request: acceptedReq, delivery: updatedDelivery });
  });

  app.put("/api/delivery/:id/status", requireAuth, requireRole("delivery_rider", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { status } = z.object({ status: z.enum(["picked_up", "in_transit", "delivered", "failed", "cancelled"]) }).parse(req.body);
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, param(req, "id"))).limit(1);
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });
    if (user.role !== "admin" && delivery.riderId !== user.id) return res.status(403).json({ message: "Forbidden" });
    const extra: any = { status, updatedAt: new Date() };
    if (status === "picked_up") extra.pickedUpAt = new Date();
    if (status === "delivered") extra.deliveredAt = new Date();
    const [updated] = await db.update(deliveries).set(extra).where(eq(deliveries.id, delivery.id)).returning();
    if (status === "delivered") {
      await db.update(orders).set({ status: "delivered" as any, updatedAt: new Date() }).where(eq(orders.id, delivery.orderId));
      if (delivery.riderId) await db.update(deliveryRiders).set({ isAvailable: true, completedDeliveries: sql`${deliveryRiders.completedDeliveries} + 1`, updatedAt: new Date() }).where(eq(deliveryRiders.userId, delivery.riderId));
    }
    return res.json(updated);
  });

  app.get("/api/admin/riders", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select({ rider: deliveryRiders, user: users }).from(deliveryRiders).innerJoin(users, eq(deliveryRiders.userId, users.id)).orderBy(desc(deliveryRiders.createdAt));
    return res.json(rows.map(r => ({ ...r.rider, user: safeUser(r.user) })));
  });

  app.put("/api/admin/riders/:userId/verify", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [rider] = await db.update(deliveryRiders).set({ verificationStatus: status, updatedAt: new Date() }).where(eq(deliveryRiders.userId, param(req, "userId"))).returning();
    if (!rider) return res.status(404).json({ message: "Rider profile not found" });
    await db.update(users).set({ role: "delivery_rider", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "Rider Approved" : "Rider Application Update", body: status === "verified" ? "You can now receive delivery requests." : (note || "Your rider application was not approved."), icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(rider);
  });

  // ────────────────────────────────────────────────────────────────
  // SUPPORT TICKETS & CHAT-READY MESSAGING
  // ────────────────────────────────────────────────────────────────
  app.get("/api/support/tickets", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = user.role === "admin"
      ? await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(200)
      : await db.select().from(supportTickets).where(eq(supportTickets.userId, user.id)).orderBy(desc(supportTickets.createdAt)).limit(100);
    return res.json(rows);
  });

  app.post("/api/support/tickets", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { subject, message, priority } = z.object({
        subject: z.string().trim().min(3).max(160),
        message: z.string().trim().min(10).max(4000),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
      }).parse(req.body);
      const [ticket] = await db.insert(supportTickets).values({ userId: user.id, subject, message, priority }).returning();
      return res.status(201).json(ticket);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Invalid support request" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/customer/returns", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select({ request: returnRequests, orderTotal: orders.total, orderStatus: orders.status })
      .from(returnRequests)
      .innerJoin(orders, eq(returnRequests.orderId, orders.id))
      .where(eq(returnRequests.userId, user.id))
      .orderBy(desc(returnRequests.createdAt));
    return res.json(rows.map(({ request, orderTotal, orderStatus }) => ({ ...request, orderTotal, orderStatus })));
  });

  app.get("/api/business/returns", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const vendorOrders = await getOrdersForVendor(user.id);
    if (vendorOrders.length === 0) return res.json([]);
    const orderById = new Map(vendorOrders.map((order) => [order.id, order]));
    const rows = await db.select().from(returnRequests)
      .where(inArray(returnRequests.orderId, vendorOrders.map((order) => order.id)))
      .orderBy(desc(returnRequests.createdAt));
    return res.json(rows.map((request) => {
      const order = orderById.get(request.orderId);
      return {
        ...request,
        orderStatus: order?.marketplaceOrderStatus || order?.status,
        vendorStatus: order?.vendorStatus,
        vendorSubtotal: order?.subtotal || 0,
        items: order?.items || [],
      };
    }));
  });

  app.get("/api/customer/return-eligibility", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [rows, activeRequests] = await Promise.all([
      db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.updatedAt)),
      db.select({ orderId: returnRequests.orderId }).from(returnRequests).where(and(
        eq(returnRequests.userId, user.id),
        inArray(returnRequests.status, ["submitted", "reviewing", "approved"]),
      )),
    ]);
    const activeOrderIds = new Set(activeRequests.map((request) => request.orderId));
    return res.json(rows
      .filter((order) => !activeOrderIds.has(order.id) && isOrderReturnEligible(order))
      .map((order) => ({
        id: order.id,
        total: order.total,
        status: order.status,
        items: order.items,
        deliveredAt: order.updatedAt,
        returnBy: new Date(order.updatedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      })));
  });

  app.post("/api/customer/returns", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const data = z.object({
        orderId: z.string(),
        requestType: z.enum(["return", "refund"]),
        reason: z.string().trim().min(3).max(160),
        details: z.string().trim().min(10).max(2000),
      }).parse(req.body);
      const [order] = await db.select().from(orders).where(and(eq(orders.id, data.orderId), eq(orders.userId, user.id))).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (!isOrderReturnEligible(order)) {
        return res.status(409).json({ message: "This order is outside the 7-day return window or has not been delivered" });
      }
      const [existing] = await db.select().from(returnRequests).where(and(
        eq(returnRequests.userId, user.id),
        eq(returnRequests.orderId, order.id),
        inArray(returnRequests.status, ["submitted", "reviewing", "approved"]),
      )).limit(1);
      if (existing) return res.status(409).json({ message: "An active request already exists for this order" });

      const [request] = await db.insert(returnRequests).values({
        userId: user.id,
        orderId: order.id,
        requestType: data.requestType,
        reason: data.reason,
        details: data.details,
      }).returning();
      await db.insert(notifications).values({
        userId: user.id,
        type: "return",
        title: "Request Submitted",
        body: `Your ${data.requestType} request for order #${order.id.slice(0, 8).toUpperCase()} is under review.`,
        icon: "return-down-back-outline",
        color: "#D97706",
        actionRoute: "/returns",
      });
      return res.status(201).json(request);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Invalid return request" });
      if (err?.code === "23505") return res.status(409).json({ message: "An active request already exists for this order" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/conversations", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(messages).where(eq(messages.senderId, user.id)).orderBy(desc(messages.createdAt)).limit(50);
    return res.json(rows);
  });


  // ────────────────────────────────────────────────────────────────
  // END-TO-END ORDER TRACKING, QR VERIFICATION, DISPATCH & ESCROW
  // ────────────────────────────────────────────────────────────────

  app.get("/api/orders/:id/tracking", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const parties = await getOrderParties(order);
    const allowed = user.role === "admin" || order.userId === user.id || order.riderId === user.id || parties.vendorIds.includes(user.id);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    const events = await db.select().from(orderTrackingEvents).where(eq(orderTrackingEvents.orderId, orderId)).orderBy(desc(orderTrackingEvents.createdAt));
    const qrs = await db.select().from(orderQrCodes).where(eq(orderQrCodes.orderId, orderId)).orderBy(desc(orderQrCodes.createdAt));
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId)).limit(1);
    const latestRiderLocation = delivery?.riderId ? await db.select().from(riderLocations).where(eq(riderLocations.riderId, delivery.riderId)).orderBy(desc(riderLocations.createdAt)).limit(1) : [];
    return res.json({ order, events, qrs, delivery: delivery || null, riderLocation: latestRiderLocation[0] || null });
  });

  app.post("/api/orders/:id/confirm-payment", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const orderId = param(req, "id");
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (user.role !== "admin" && order.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (order.paymentMethod === "wave") return res.status(409).json({ message: "Wave payments are confirmed only by a signed Wave webhook" });
      if (order.paymentStatus === "paid" || order.status === "paid") return res.status(409).json({ message: "Order is already paid" });
      const { method, reference } = z.object({ method: z.literal("wallet").default("wallet"), reference: z.string().optional() }).parse(req.body || {});
      await addWalletTransaction({ userId: order.userId!, type: "escrow_payment", direction: "debit", amount: order.total, orderId: order.id, description: `Escrow payment for order #${order.id.slice(0, 8).toUpperCase()}` });
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
        reference,
      }).catch(() => {});
      const qrs = await ensureOrderQrs(order.id);
      const [updated] = await db.update(orders).set({ status: "paid" as any, paymentStatus: "paid", escrowStatus: "held", qrCode: qrs.delivery.code, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
      await addTracking(order.id, "paid", "Payment received", "Funds are now held securely by MansaMart escrow.", user);
      await notifyOrderParties(updated, "Payment Received", "Payment is confirmed and held securely in escrow.", "payment");
      return res.json({ order: updated, qrs });
    } catch (err: any) {
      if (err.message === "Insufficient wallet balance") return res.status(400).json({ message: err.message });
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/orders/:id/confirm-vendor", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (user.role === "admin") {
      const [updated] = await db.update(orders).set({ status: "confirmed" as any, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
      return res.json(updated);
    }
    await ensureVendorFulfillments(order);
    const [fulfillment] = await db.select().from(orderVendorFulfillments).where(and(eq(orderVendorFulfillments.orderId, order.id), eq(orderVendorFulfillments.vendorId, user.id))).limit(1);
    if (!fulfillment) return res.status(403).json({ message: "Forbidden" });
    if (!canVendorAdvanceFulfillment(fulfillment.status, "confirmed", order.paymentStatus)) return res.status(409).json({ message: "Payment must be confirmed before accepting this order." });
    await db.update(orderVendorFulfillments).set({ status: "confirmed", updatedAt: new Date() }).where(eq(orderVendorFulfillments.id, fulfillment.id));
    const all = await db.select().from(orderVendorFulfillments).where(eq(orderVendorFulfillments.orderId, order.id));
    const nextOrderStatus = deriveMarketplaceOrderStatus(order.status, all.map((row) => row.status));
    const [updated] = nextOrderStatus === order.status ? [order] : await db.update(orders).set({ status: nextOrderStatus as any, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
    await addTracking(order.id, "confirmed", "Seller confirmed items", "A seller confirmed their portion of the order.", user, { vendorId: user.id });
    await notifyUser(order.userId, "order", "Seller Confirmed Items", "A seller confirmed their portion of your order.", `/order/${order.id}`);
    return res.json({ ...updated, vendorStatus: "confirmed" });
  });

  app.post("/api/orders/:id/ready-for-pickup", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (user.role === "admin") {
      await ensureOrderQrs(order.id);
      const [updated] = await db.update(orders).set({ status: "ready_for_pickup" as any, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
      return res.json(updated);
    }
    await ensureVendorFulfillments(order);
    const [fulfillment] = await db.select().from(orderVendorFulfillments).where(and(eq(orderVendorFulfillments.orderId, order.id), eq(orderVendorFulfillments.vendorId, user.id))).limit(1);
    if (!fulfillment) return res.status(403).json({ message: "Forbidden" });
    if (!canVendorAdvanceFulfillment(fulfillment.status, "ready_for_pickup", order.paymentStatus)) return res.status(409).json({ message: "Mark these items as preparing before marking them ready." });
    await db.update(orderVendorFulfillments).set({ status: "ready_for_pickup", updatedAt: new Date() }).where(eq(orderVendorFulfillments.id, fulfillment.id));
    const all = await db.select().from(orderVendorFulfillments).where(eq(orderVendorFulfillments.orderId, order.id));
    const nextOrderStatus = deriveMarketplaceOrderStatus(order.status, all.map((row) => row.status));
    if (nextOrderStatus === "ready_for_pickup") await ensureOrderQrs(order.id);
    const [updated] = nextOrderStatus === order.status ? [order] : await db.update(orders).set({ status: nextOrderStatus as any, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
    await addTracking(order.id, "ready_for_pickup", "Seller items ready", "A seller marked their items ready for pickup.", user, { vendorId: user.id });
    await notifyUser(order.userId, "order", "Seller Items Ready", "A seller marked their portion of your order ready.", `/order/${order.id}`);
    return res.json({ ...updated, vendorStatus: "ready_for_pickup" });
  });

  app.post("/api/orders/:id/dispatch-rider", requireAuth, requireRole("vendor", "admin"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const orderId = param(req, "id");
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const parties = await getOrderParties(order);
      if (user.role !== "admin" && !parties.vendorIds.includes(user.id)) return res.status(403).json({ message: "Forbidden" });
      await ensureVendorFulfillments(order);
      const fulfillments = await db.select().from(orderVendorFulfillments).where(eq(orderVendorFulfillments.orderId, order.id));
      if (user.role !== "admin" && (fulfillments.length === 0 || fulfillments.some((row) => row.status !== "ready_for_pickup"))) {
        return res.status(409).json({ message: "Every seller must mark their items ready before dispatching a rider." });
      }
      const body = z.object({ pickupAddress: z.string().optional(), pickupLatitude: z.number().optional(), pickupLongitude: z.number().optional(), deliveryFee: z.number().int().optional() }).parse(req.body || {});
      const pickupAddress = body.pickupAddress || "Vendor location";
      const [delivery] = await db.insert(deliveries).values({
        orderId: order.id,
        pickupAddress,
        pickupLatitude: body.pickupLatitude,
        pickupLongitude: body.pickupLongitude,
        dropoffAddress: `${order.address}, ${order.city}`,
        dropoffLatitude: (order as any).deliveryLatitude,
        dropoffLongitude: (order as any).deliveryLongitude,
        deliveryFee: body.deliveryFee ?? order.shipping ?? 0,
        status: "searching",
      }).returning();
      const riders = await db.select().from(deliveryRiders).where(and(eq(deliveryRiders.isOnline, true), eq(deliveryRiders.isAvailable, true), eq(deliveryRiders.verificationStatus, "verified")));
      const nearest = riders.map(r => ({ ...r, distance: distanceKm(r.latitude, r.longitude, body.pickupLatitude, body.pickupLongitude) })).sort((a, b) => a.distance - b.distance).slice(0, 5);
      for (const rider of nearest) {
        await db.insert(deliveryRequests).values({ deliveryId: delivery.id, riderId: rider.userId, distanceKm: rider.distance, status: "offered", expiresAt: new Date(Date.now() + 60_000) });
        await notifyUser(rider.userId, "delivery", "New Delivery Request", `Pickup: ${pickupAddress}. Fee: D ${delivery.deliveryFee.toLocaleString()}`, "/(rider)", { deliveryId: delivery.id, orderId: order.id });
      }
      const [updated] = await db.update(orders).set({ status: "searching_rider" as any, fulfillmentType: "delivery", updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
      await addTracking(order.id, "searching_rider", "Searching for rider", `${nearest.length} riders were notified.`, user, { deliveryId: delivery.id, offeredRiders: nearest.length });
      return res.status(201).json({ order: updated, delivery, offeredRiders: nearest.length });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/delivery-requests/:id/accept", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [request] = await db.select().from(deliveryRequests).where(and(eq(deliveryRequests.id, param(req, "id")), eq(deliveryRequests.riderId, user.id))).limit(1);
    if (!request || request.status !== "offered") return res.status(404).json({ message: "Delivery offer not available" });
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, request.deliveryId)).limit(1);
    if (!delivery || delivery.status !== "searching") return res.status(400).json({ message: "Delivery already assigned" });
    await db.update(deliveryRequests).set({ status: "cancelled" }).where(eq(deliveryRequests.deliveryId, delivery.id));
    const [acceptedReq] = await db.update(deliveryRequests).set({ status: "accepted", respondedAt: new Date() }).where(eq(deliveryRequests.id, request.id)).returning();
    const [updatedDelivery] = await db.update(deliveries).set({ riderId: user.id, status: "assigned", acceptedAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id)).returning();
    const [updatedOrder] = await db.update(orders).set({ status: "rider_assigned" as any, riderId: user.id, updatedAt: new Date() }).where(eq(orders.id, delivery.orderId)).returning();
    await db.update(deliveryRiders).set({ isAvailable: false, updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id));
    await addTracking(delivery.orderId, "rider_assigned", "Rider assigned", `${user.name} accepted the delivery.`, user, { deliveryId: delivery.id });
    await notifyOrderParties(updatedOrder, "Rider Assigned", `${user.name} has accepted the delivery.`, "delivery");
    return res.json({ request: acceptedReq, delivery: updatedDelivery, order: updatedOrder });
  });

  app.post("/api/orders/:id/confirm-pickup-qr", requireAuth, requireRole("vendor", "delivery_rider", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
    const [qr] = await db.select().from(orderQrCodes).where(and(eq(orderQrCodes.orderId, orderId), eq(orderQrCodes.code, code), eq(orderQrCodes.purpose, "pickup"), eq(orderQrCodes.status, "active"))).limit(1);
    if (!qr) return res.status(400).json({ message: "Invalid or expired pickup QR code" });
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId)).limit(1);
    const [order] = await db.update(orders).set({ status: "picked_up" as any, pickupConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    if (delivery) await db.update(deliveries).set({ status: "picked_up", pickedUpAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
    await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: new Date(), status: "used" }).where(eq(orderQrCodes.id, qr.id));
    await addTracking(orderId, "picked_up", "Order picked up", "QR verification confirmed rider/vendor handover.", user, { qrId: qr.id });
    await notifyOrderParties(order, "Order Picked Up", "Your order has been picked up by the rider.", "delivery");
    return res.json({ order, verified: true });
  });

  app.post("/api/orders/:id/confirm-delivery-qr", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
    const [orderBefore] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!orderBefore) return res.status(404).json({ message: "Order not found" });
    if (user.role !== "admin" && orderBefore.userId !== user.id && orderBefore.riderId !== user.id) return res.status(403).json({ message: "Forbidden" });
    const [qr] = await db.select().from(orderQrCodes).where(and(eq(orderQrCodes.orderId, orderId), eq(orderQrCodes.code, code), eq(orderQrCodes.purpose, "delivery"), eq(orderQrCodes.status, "active"))).limit(1);
    if (!qr) return res.status(400).json({ message: "Invalid or expired delivery QR code" });
    const [order] = await db.update(orders).set({ status: "delivered" as any, deliveryConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId)).limit(1);
    if (delivery) await db.update(deliveries).set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
    await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: new Date(), status: "used" }).where(eq(orderQrCodes.id, qr.id));
    await addTracking(orderId, "delivered", "Order delivered", "Shopper/rider QR verification confirmed delivery.", user, { qrId: qr.id });
    await notifyOrderParties(order, "Order Delivered", "Delivery has been verified. Releasing payment now.", "delivery");
    const released = await releaseEscrowForOrder(order, user);
    return res.json({ order, delivered: true, settlement: released });
  });



  app.post("/api/orders/verify-qr", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
      const [qr] = await db.select().from(orderQrCodes).where(and(eq(orderQrCodes.code, code.trim()), eq(orderQrCodes.status, "active"))).limit(1);
      if (!qr) return res.status(400).json({ message: "Invalid, expired, or already used QR code" });
      const [orderBefore] = await db.select().from(orders).where(eq(orders.id, qr.orderId)).limit(1);
      if (!orderBefore) return res.status(404).json({ message: "Order not found" });
      const parties = await getOrderParties(orderBefore);

      if (qr.purpose === "pickup") {
        const allowed = user.role === "admin" || user.role === "delivery_rider" || parties.vendorIds.includes(user.id);
        if (!allowed) return res.status(403).json({ message: "Only the vendor, assigned rider, or admin can confirm pickup" });
        const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderBefore.id)).limit(1);
        const [order] = await db.update(orders).set({ status: "picked_up" as any, pickupConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderBefore.id)).returning();
        if (delivery) await db.update(deliveries).set({ status: "picked_up", pickedUpAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
        await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: new Date(), status: "used" }).where(eq(orderQrCodes.id, qr.id));
        await addTracking(order.id, "picked_up", "Order picked up", "QR verification confirmed vendor-to-rider handover.", user, { qrId: qr.id });
        await notifyOrderParties(order, "Order Picked Up", "Your order has been collected by the rider.", "delivery");
        return res.json({ verified: true, purpose: "pickup", message: "Pickup confirmed", order });
      }

      if (qr.purpose === "delivery") {
        const allowed = user.role === "admin" || orderBefore.userId === user.id || orderBefore.riderId === user.id;
        if (!allowed) return res.status(403).json({ message: "Only the shopper, assigned rider, or admin can confirm delivery" });
        const [order] = await db.update(orders).set({ status: "delivered" as any, deliveryConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderBefore.id)).returning();
        const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderBefore.id)).limit(1);
        if (delivery) await db.update(deliveries).set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
        await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: new Date(), status: "used" }).where(eq(orderQrCodes.id, qr.id));
        await addTracking(order.id, "delivered", "Order delivered", "QR verification confirmed successful delivery.", user, { qrId: qr.id });
        await notifyOrderParties(order, "Order Delivered", "Delivery has been verified. Settlement can now be processed.", "delivery");
        const settlement = await releaseEscrowForOrder(order, user).catch(() => null);
        return res.json({ verified: true, purpose: "delivery", message: "Delivery confirmed", order, settlement });
      }

      return res.status(400).json({ message: "Unsupported QR code purpose" });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "QR verification failed" });
    }
  });

  app.post("/api/orders/:id/complete-and-release-payment", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (user.role !== "admin" && order.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
    const result = await releaseEscrowForOrder(order, user);
    return res.json(result);
  });

  app.get("/api/rider/dashboard", requireAuth, requireRole("delivery_rider", "admin"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const profile = await ensureRiderProfile(user);
    const offers = await db.select().from(deliveryRequests).where(and(eq(deliveryRequests.riderId, user.id), eq(deliveryRequests.status, "offered"))).orderBy(desc(deliveryRequests.createdAt)).limit(30);
    const activeDeliveries = await db.select().from(deliveries).where(and(eq(deliveries.riderId, user.id), ne(deliveries.status, "delivered"), ne(deliveries.status, "cancelled"))).orderBy(desc(deliveries.createdAt)).limit(30);
    const history = await db.select().from(deliveries).where(eq(deliveries.riderId, user.id)).orderBy(desc(deliveries.createdAt)).limit(50);
    const earningRows = await db.select().from(riderEarnings).where(eq(riderEarnings.riderId, user.id)).orderBy(desc(riderEarnings.createdAt)).limit(50);
    const totalEarnings = earningRows.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const completion = await computeProfileCompletion(user);
    return res.json({ profile, offers, activeDeliveries, history, earnings: earningRows, totalEarnings, completion, metrics: { completed: profile?.completedDeliveries || 0, rating: profile?.rating || 0 } });
  });

  app.post("/api/rider/location", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { latitude, longitude, accuracy, heading, speed, deliveryId } = z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional(), heading: z.number().optional(), speed: z.number().optional(), deliveryId: z.string().optional() }).parse(req.body);
    const [loc] = await db.insert(riderLocations).values({ riderId: user.id, deliveryId, latitude, longitude, accuracy, heading, speed }).returning();
    await db.update(deliveryRiders).set({ latitude, longitude, updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id));
    emitRealtime("rider:location", { riderId: user.id, deliveryId, latitude, longitude, accuracy, heading, speed, createdAt: loc.createdAt }, deliveryId ? [`delivery:${deliveryId}`, "role:admin"] : ["role:admin"]);
    return res.status(201).json(loc);
  });

  app.get("/api/admin/orders/live", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const liveOrders = await db.select().from(orders).orderBy(desc(orders.updatedAt)).limit(100);
    const liveDeliveries = await db.select().from(deliveries).orderBy(desc(deliveries.updatedAt)).limit(100);
    const recentEvents = await db.select().from(orderTrackingEvents).orderBy(desc(orderTrackingEvents.createdAt)).limit(100);
    return res.json({ orders: liveOrders, deliveries: liveDeliveries, events: recentEvents });
  });

  app.get("/api/profile/completion", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await computeProfileCompletion(user);
    return res.json(result);
  });


  const httpServer = createServer(app);

  try {
    const { Server: SocketIOServer } = await import("socket.io");
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          const allowed = socketCorsOrigins();
          const normalizedOrigin = origin?.replace(/\/$/, "");
          const isLocalhost = normalizedOrigin?.startsWith("http://localhost:") || normalizedOrigin?.startsWith("http://127.0.0.1:");
          if (!origin || isLocalhost || allowed.includes(normalizedOrigin || "")) return callback(null, true);
          return callback(new Error("Socket.IO origin not allowed"));
        },
        credentials: true,
      },
    });

    io.use(async (socket: any, next: (err?: Error) => void) => {
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
      } catch (error: any) {
        next(error);
      }
    });

    io.on("connection", (socket: any) => {
      socket.on("order:join", (orderId: string) => {
        if (orderId) socket.join(`order:${orderId}`);
      });
      socket.on("delivery:join", (deliveryId: string) => {
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
  } catch (error: any) {
    console.warn("Socket.IO realtime server not enabled:", error?.message || error);
  }

  return httpServer;
}
