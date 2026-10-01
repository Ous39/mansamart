import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { calculateDeliveryFee, calculateOrderTotal } from "@mansamart/business-logic";
import { db } from "./db";
import {
  users, sessions, products, services, orders, bookings,
  reviews, reviewHelpfulVotes, cartItems, wishlistItems, notifications,
  userActivity, flashDeals, addresses, shopperProfiles, vendorProfiles, providerProfiles, coupons, banners,
  wallets, transactions, commissions, payouts, deliveryRiders, deliveries, deliveryRequests, staff, supportTickets, returnRequests, conversations, messages, productVariants, serviceSlots,
  orderTrackingEvents, orderQrCodes, riderLocations, riderEarnings, escrowTransactions, settlements, profileCompletionChecks, auditLogs, orderVendorFulfillments, passwordResetTokens, adminMfaChallenges,
  authIdentities, phoneOtpChallenges, externalAuthTokens, pushDevices, notificationPreferences, notificationDeliveries,
  adminAccessProfiles, platformSettings, operationalIncidents,
} from "@mansamart/database/schema";
import { eq, and, desc, ilike, or, inArray, ne, gt, count, sql, isNull } from "drizzle-orm";
import {
  requireAuth, requireRole, optionalAuth,
  hashPassword, comparePassword, hashPin, comparePin,
  createSession, deleteSession, getTokenFromRequest, getSession, sessionMetadataFromRequest,
} from "./auth";
import { z } from "zod";
import { parseClientAudience, roleAllowedForAudience, type ClientAudience } from "./client-access";
import { registerPaymentRoutes } from "./payments/routes";
import { registerWhatsappRoutes } from "./whatsapp/routes";
import { saveBase64Image } from "./upload-security";
import { sendAdminLoginCode, sendPasswordResetEmail } from "./email";
import { hashAdminMfaChallenge, isAdminMfaCodeValid, isAdminMfaRequired } from "./admin-mfa";
import { generatePhoneOtp, hashPhoneOtp, normalizeGambianPhone, phoneOtpCanExposeDevelopmentCode, verifyPhoneOtp } from "./phone-auth";
import { isPhoneOtpConfigured, sendPhoneOtp } from "./sms";
import { identityTokenHash, verifyIdentityToken } from "./identity-providers";
import { ADMIN_PERMISSIONS, ADMIN_STAFF_ROLES, hasAdminPermission, isSafePlatformSettingValue, permissionsForRole, type AdminPermission, type AdminStaffRole } from "./admin-control";
import { createOrchestratedNotification } from "./notification-service";
import { isExpoPushToken } from "./push-rules";
import { BOOKING_STATUSES, canUpdateBookingStatus, hasVerifiedReviewHistory, isOrderReturnEligible, normalizeCartSelection } from "./customer-rules";
import {
  VENDOR_FULFILLMENT_STATUSES,
  availablePayoutBalance,
  canVendorAdvanceFulfillment,
  deriveMarketplaceOrderStatus,
  isBusinessVerified,
} from "./business-rules";
import {
  canChangeDeliveryStatus,
  canReleaseDeliveryPayment,
  canRiderAccessDelivery,
  canVerifyOrderQr,
  isActiveDeliveryStatus,
  isDeliveryOfferAcceptable,
  estimateDeliveryEtaMinutes,
  normalizeRecordedLocationTime,
  resolveRiderPresence,
} from "./rider-rules";

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

function requireAdminPermission(permission: AdminPermission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as typeof users.$inferSelect | undefined;
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Administrator access required" });
    const [profile] = await db.select().from(adminAccessProfiles).where(eq(adminAccessProfiles.userId, user.id)).limit(1);
    const role = (profile?.staffRole || "super_admin") as AdminStaffRole;
    if (profile?.status === "suspended" || !hasAdminPermission(role, profile?.permissions || [], permission)) {
      await audit(user.id, "admin.permission_denied", "admin_permission", permission, { staffRole: role }).catch(() => {});
      return res.status(403).json({ message: `This administrator role does not have ${permission} permission` });
    }
    (req as any).adminAccess = { role, permissions: permissionsForRole(role, profile?.permissions || []) };
    next();
  };
}

function defaultRoleForAudience(audience: ClientAudience): "user" | "vendor" | "delivery_rider" {
  if (audience === "rider") return "delivery_rider";
  if (audience === "business") return "vendor";
  return "user";
}

function internalIdentityEmail(provider: string, subject: string): string {
  const key = crypto.createHash("sha256").update(`${provider}:${subject}`).digest("hex").slice(0, 32);
  return `${provider}-${key}@identity.mansamart.invalid`;
}

const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>();
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = `${req.path}:${req.ip || req.socket.remoteAddress || "unknown"}`;
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return next();
  }
  if (current.count >= 10) {
    res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).json({ message: "Too many authentication attempts. Try again later." });
  }
  current.count += 1;
  if (authAttempts.size > 10_000) {
    for (const [attemptKey, attempt] of authAttempts) if (attempt.resetAt <= now) authAttempts.delete(attemptKey);
  }
  next();
}

function adminLoginRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = `${req.path}:${req.ip || req.socket.remoteAddress || "unknown"}`;
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
  const safe = { ...user };
  delete safe.password;
  delete safe.pin;
  return safe;
}

function safeUser(u: typeof users.$inferSelect) {
  const { password, pin, ...safe } = u;
  return { ...safe, email: safe.email.endsWith("@identity.mansamart.invalid") ? "" : safe.email };
}

function safeRiderProfile(profile: typeof deliveryRiders.$inferSelect) {
  const safe = { ...profile } as Record<string, unknown>;
  delete safe.internalNotes;
  return safe;
}

function publicVendorProfile(profile: typeof vendorProfiles.$inferSelect) {
  const safe = { ...profile } as Partial<typeof profile>;
  delete safe.documents;
  delete safe.businessRegistrationNo;
  delete safe.taxNumber;
  delete safe.payoutMethod;
  delete safe.bankName;
  delete safe.accountName;
  delete safe.accountNumber;
  delete safe.mobileMoneyProvider;
  delete safe.mobileMoneyNumber;
  delete safe.internalNotes;
  delete safe.pendingProfileChanges;
  delete safe.profileChangeNote;
  return safe;
}

function publicProviderProfile(profile: typeof providerProfiles.$inferSelect) {
  const safe = { ...profile } as Partial<typeof profile>;
  delete safe.documents;
  delete safe.payoutMethod;
  delete safe.bankName;
  delete safe.accountName;
  delete safe.accountNumber;
  delete safe.mobileMoneyProvider;
  delete safe.mobileMoneyNumber;
  return safe;
}

function safeOrder<T extends typeof orders.$inferSelect>(order: T) {
  const { qrSecret, qrCode, ...safe } = order;
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
  const entityType = data.orderId ? "order" : data.bookingId ? "booking" : data.ticketId ? "support_ticket" : data.deliveryId ? "delivery" : undefined;
  const entityId = data.orderId || data.bookingId || data.ticketId || data.deliveryId;
  const notification = await createOrchestratedNotification({ userId, type, title, body, actionRoute, data, entityType, entityId }).catch(() => null);
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
  const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, order.id)).orderBy(desc(deliveries.createdAt)).limit(1);
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
  const [check] = await db.insert(profileCompletionChecks)
    .values({ userId: user.id, role: user.role, score, missingItems: missing, restricted })
    .onConflictDoUpdate({
      target: profileCompletionChecks.userId,
      set: { role: user.role, score, missingItems: missing, restricted, updatedAt: new Date() },
    })
    .returning();
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

  registerPaymentRoutes(app, requireAdminPermission("payments.refund"));
  registerWhatsappRoutes(app);

  // ────────────────────────────────────────────────────────────────
  // FILE UPLOADS - Expo/mobile friendly base64 image upload
  // ────────────────────────────────────────────────────────────────
  app.post("/api/uploads/base64", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    try {
      const { image } = z.object({
        image: z.string().min(100).max(7_500_000),
      }).parse(req.body);
      const uploadDir = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(apiDirectory, "uploads");
      const saved = saveBase64Image(image, uploadDir);
      return res.status(201).json({
        url: publicUrl(req, saved.relativePath),
        path: saved.relativePath,
        mimeType: saved.mimeType,
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid image" });
      if (err instanceof Error && /image|5 MB/i.test(err.message)) return res.status(400).json({ message: err.message });
      console.error(err);
      return res.status(500).json({ message: "Image upload failed" });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // AUTH
  // ────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", authRateLimit, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
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
      const data = { ...parsed, email: parsed.email.trim().toLowerCase(), phone: parsed.phone ? normalizeGambianPhone(parsed.phone) : undefined };
      const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
      if (existing.length > 0) return res.status(409).json({ message: "Email already registered" });

      const hashedPassword = await hashPassword(data.password);
      const [user] = await db.insert(users).values({
        ...data,
        password: hashedPassword,
      }).returning();

      await createDefaultProfiles(user);

      const token = await createSession(user.id, clientAudience(req)!, undefined, sessionMetadataFromRequest(req));

      // Send welcome notification
      await db.insert(notifications).values({
        userId: user.id,
        type: "system",
        title: data.role === "delivery_rider" ? "Welcome to MansaMart Rider" : "Welcome to MansaMart!",
        body: data.role === "delivery_rider" ? "Complete your rider profile and documents so operations can review your application." : "Discover thousands of products and book home services from Gambian businesses.",
        icon: "information-circle-outline",
        color: "#0EA47A",
      });

      return res.status(201).json({ token, user: safeUser(user) });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid data" });
      if (err instanceof Error && /Gambian phone/.test(err.message)) return res.status(400).json({ message: err.message });
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
      if (user.accountStatus !== "active") return res.status(403).json({ message: "This administrator account is suspended" });
      if (isAdminMfaRequired()) {
        if (!process.env.ADMIN_MFA_PEPPER || process.env.ADMIN_MFA_PEPPER.length < 32 || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
          return res.status(503).json({ message: "Administrator MFA is not configured" });
        }
        const challengeId = crypto.randomUUID();
        const code = crypto.randomInt(100000, 1000000).toString();
        await db.delete(adminMfaChallenges).where(eq(adminMfaChallenges.userId, user.id));
        await db.insert(adminMfaChallenges).values({
          id: challengeId,
          userId: user.id,
          codeHash: hashAdminMfaChallenge(challengeId, code, process.env.ADMIN_MFA_PEPPER!),
          expiresAt: new Date(Date.now() + 10 * 60_000),
          ipAddress: req.ip,
        });
        try {
          await sendAdminLoginCode(user.email, code);
        } catch {
          await db.delete(adminMfaChallenges).where(eq(adminMfaChallenges.id, challengeId));
          return res.status(503).json({ message: "Administrator verification email could not be delivered" });
        }
        await db.insert(auditLogs).values({ actorId: user.id, action: "admin_mfa_challenge_created", entityType: "admin_mfa_challenge", entityId: challengeId, metadata: { ip: req.ip } }).catch(() => {});
        return res.json({ mfaRequired: true, challengeId, expiresIn: 10 * 60 });
      }
      const token = await createSession(user.id, "admin", 8 * 60 * 60 * 1000, sessionMetadataFromRequest(req));
      await db.insert(auditLogs).values({ actorId: user.id, action: "admin_login", entityType: "session", metadata: { ip: req.ip } }).catch(() => {});
      return res.json({ token, user: safeUser(user), expiresIn: 8 * 60 * 60 });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid login data" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/auth/mfa/verify", adminLoginRateLimit, async (req: Request, res: Response) => {
    try {
      if (String(req.header("x-mansamart-app") || "").toLowerCase() !== "admin" || !adminOriginAllowed(req)) {
        return res.status(403).json({ message: "Administrator login is only available through the secure administrator portal." });
      }
      if (!isAdminMfaRequired()) return res.status(404).json({ message: "Administrator MFA is not enabled" });
      const { challengeId, code } = z.object({
        challengeId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
      }).parse(req.body);
      const [row] = await db.select({ challenge: adminMfaChallenges, user: users })
        .from(adminMfaChallenges)
        .innerJoin(users, eq(adminMfaChallenges.userId, users.id))
        .where(and(
          eq(adminMfaChallenges.id, challengeId),
          isNull(adminMfaChallenges.usedAt),
          gt(adminMfaChallenges.expiresAt, new Date()),
        ))
        .limit(1);
      if (!row || row.user.role !== "admin" || row.user.accountStatus !== "active" || row.challenge.attempts >= 5) {
        return res.status(401).json({ message: "Invalid or expired verification code" });
      }
      if (!isAdminMfaCodeValid(row.challenge.codeHash, challengeId, code, process.env.ADMIN_MFA_PEPPER || "")) {
        await db.update(adminMfaChallenges).set({ attempts: sql`${adminMfaChallenges.attempts} + 1` }).where(eq(adminMfaChallenges.id, challengeId));
        await db.insert(auditLogs).values({ actorId: row.user.id, action: "admin_mfa_failed", entityType: "admin_mfa_challenge", entityId: challengeId, metadata: { ip: req.ip } }).catch(() => {});
        return res.status(401).json({ message: "Invalid or expired verification code" });
      }
      const [used] = await db.update(adminMfaChallenges).set({ usedAt: new Date() })
        .where(and(eq(adminMfaChallenges.id, challengeId), isNull(adminMfaChallenges.usedAt)))
        .returning();
      if (!used) return res.status(409).json({ message: "Verification code was already used" });
      const token = await createSession(row.user.id, "admin", 8 * 60 * 60 * 1000, sessionMetadataFromRequest(req));
      await db.insert(auditLogs).values({ actorId: row.user.id, action: "admin_login_mfa", entityType: "session", metadata: { ip: req.ip, challengeId } }).catch(() => {});
      return res.json({ token, user: safeUser(row.user), expiresIn: 8 * 60 * 60 });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Enter the six-digit verification code" });
      if (err instanceof Error && err.message.includes("ADMIN_MFA_PEPPER")) return res.status(503).json({ message: "Administrator MFA is not configured" });
      return res.status(500).json({ message: "Administrator verification failed" });
    }
  });

  app.post("/api/auth/login", authRateLimit, async (req: Request, res: Response) => {
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

      if (user.accountStatus !== "active") return res.status(403).json({ message: "This account is suspended. Contact MansaMart support." });

      if (user.role === "admin") {
        return res.status(403).json({ message: "Administrator accounts must sign in at admin.mansamart.gm" });
      }
      if (!clientAudience(req)) return res.status(400).json({ message: "Unknown MansaMart application" });
      if (!roleAllowedForClient(req, user.role)) {
        return res.status(403).json({ message: "Use the MansaMart application for your account type." });
      }

      const token = await createSession(user.id, clientAudience(req)!, undefined, sessionMetadataFromRequest(req));
      await notifyUser(user.id, "security", "New sign-in", "A new MansaMart session was created with your password.", "/account-security");
      return res.json({ token, user: safeUser(user), hasPin: !!user.pin });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid data" });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/phone/request", authRateLimit, async (req: Request, res: Response) => {
    try {
      const audience = clientAudience(req);
      if (!audience || audience === "admin") return res.status(403).json({ message: "Phone sign-in is not available in this application" });
      if (!isPhoneOtpConfigured()) return res.status(503).json({ message: "Phone verification is not configured yet" });
      const parsed = z.object({
        phone: z.string().min(7).max(30),
        purpose: z.enum(["login", "register"]).default("login"),
        role: z.enum(["user", "vendor", "service_provider", "delivery_rider"]).optional(),
        name: z.string().trim().min(2).max(120).optional(),
      }).parse(req.body);
      const role = parsed.role || defaultRoleForAudience(audience);
      if (!roleAllowedForAudience(audience, role)) return res.status(403).json({ message: "Use the MansaMart application for this account type" });
      if (parsed.purpose === "register" && !parsed.name) return res.status(400).json({ message: "Your name is required to create an account" });
      const phone = normalizeGambianPhone(parsed.phone);
      const [recent] = await db.select().from(phoneOtpChallenges)
        .where(and(eq(phoneOtpChallenges.phone, phone), eq(phoneOtpChallenges.audience, audience), isNull(phoneOtpChallenges.consumedAt)))
        .orderBy(desc(phoneOtpChallenges.createdAt)).limit(1);
      if (recent?.resendAvailableAt && recent.resendAvailableAt.getTime() > Date.now()) {
        res.setHeader("Retry-After", Math.ceil((recent.resendAvailableAt.getTime() - Date.now()) / 1000));
        return res.status(429).json({ message: "Please wait before requesting another code" });
      }
      const challengeId = crypto.randomUUID();
      const code = generatePhoneOtp();
      await db.insert(phoneOtpChallenges).values({
        id: challengeId,
        phone,
        purpose: parsed.purpose,
        audience,
        role,
        name: parsed.name || null,
        codeHash: hashPhoneOtp(challengeId, code),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        resendAvailableAt: new Date(Date.now() + 60_000),
      });
      try {
        await sendPhoneOtp(phone, code);
      } catch {
        await db.delete(phoneOtpChallenges).where(eq(phoneOtpChallenges.id, challengeId));
        return res.status(503).json({ message: "The verification code could not be delivered" });
      }
      return res.status(202).json({
        challengeId,
        expiresIn: 600,
        resendAfter: 60,
        ...(phoneOtpCanExposeDevelopmentCode() ? { developmentCode: code } : {}),
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Invalid phone request" });
      if (err instanceof Error && /Gambian phone/.test(err.message)) return res.status(400).json({ message: err.message });
      return res.status(500).json({ message: "Phone verification could not be started" });
    }
  });

  app.post("/api/auth/phone/verify", authRateLimit, async (req: Request, res: Response) => {
    try {
      const audience = clientAudience(req);
      if (!audience || audience === "admin") return res.status(403).json({ message: "Phone sign-in is not available in this application" });
      const { challengeId, code } = z.object({
        challengeId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
      }).parse(req.body);
      const [challenge] = await db.select().from(phoneOtpChallenges)
        .where(and(eq(phoneOtpChallenges.id, challengeId), eq(phoneOtpChallenges.audience, audience), isNull(phoneOtpChallenges.consumedAt)))
        .limit(1);
      if (!challenge || challenge.expiresAt.getTime() <= Date.now() || challenge.attempts >= 5) {
        return res.status(401).json({ message: "Invalid or expired verification code" });
      }
      if (!verifyPhoneOtp(challenge.id, code, challenge.codeHash)) {
        await db.update(phoneOtpChallenges).set({ attempts: sql`${phoneOtpChallenges.attempts} + 1` }).where(eq(phoneOtpChallenges.id, challenge.id));
        return res.status(401).json({ message: "Invalid or expired verification code" });
      }
      const [consumed] = await db.update(phoneOtpChallenges).set({ consumedAt: new Date() })
        .where(and(eq(phoneOtpChallenges.id, challenge.id), isNull(phoneOtpChallenges.consumedAt))).returning();
      if (!consumed) return res.status(409).json({ message: "This verification code was already used" });

      const [phoneIdentity] = await db.select().from(authIdentities)
        .where(and(eq(authIdentities.provider, "phone"), eq(authIdentities.providerSubject, challenge.phone))).limit(1);
      let user: typeof users.$inferSelect | undefined;
      if (phoneIdentity) [user] = await db.select().from(users).where(eq(users.id, phoneIdentity.userId)).limit(1);
      if (!user) {
        const phoneMatches = await db.select().from(users).where(eq(users.phone, challenge.phone)).limit(2);
        if (phoneMatches.length > 0) return res.status(409).json({ message: "This phone is attached to an account but has not been verified for phone sign-in. Use your password or contact MansaMart support." });
      }
      let created = false;
      if (!user) {
        if (challenge.purpose !== "register") return res.status(404).json({ message: "No MansaMart account uses this phone number" });
        const role = challenge.role || defaultRoleForAudience(audience);
        if (!roleAllowedForAudience(audience, role)) return res.status(403).json({ message: "Use the MansaMart application for this account type" });
        const password = await hashPassword(crypto.randomBytes(48).toString("base64url"));
        [user] = await db.insert(users).values({
          email: internalIdentityEmail("phone", challenge.phone),
          password,
          name: challenge.name || "MansaMart member",
          phone: challenge.phone,
          role: role as any,
          businessName: role === "vendor" || role === "service_provider" ? challenge.name : null,
        }).returning();
        created = true;
      }
      if (user.role === "admin" || !roleAllowedForAudience(audience, user.role)) {
        return res.status(403).json({ message: "Use the MansaMart application for your account type" });
      }
      if (created) await createDefaultProfiles(user);
      await db.insert(authIdentities).values({ userId: user.id, provider: "phone", providerSubject: challenge.phone }).onConflictDoNothing();
      await db.update(authIdentities).set({ lastUsedAt: new Date() })
        .where(and(eq(authIdentities.provider, "phone"), eq(authIdentities.providerSubject, challenge.phone))).catch(() => {});
      const token = await createSession(user.id, audience, undefined, sessionMetadataFromRequest(req));
      await notifyUser(user.id, "security", "Phone sign-in", "A new session was created after phone verification.", "/account-security");
      return res.status(created ? 201 : 200).json({ token, user: safeUser(user), hasPin: !!user.pin, created });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Enter the six-digit verification code" });
      return res.status(500).json({ message: "Phone verification failed" });
    }
  });

  app.post("/api/auth/social", authRateLimit, async (req: Request, res: Response) => {
    try {
      const audience = clientAudience(req);
      if (!audience || audience === "admin") return res.status(403).json({ message: "Social sign-in is not available in this application" });
      const parsed = z.object({
        provider: z.enum(["google", "apple"]),
        idToken: z.string().min(100).max(10_000),
        nonce: z.string().min(16).max(256).optional(),
        role: z.enum(["user", "vendor", "service_provider", "delivery_rider"]).optional(),
        name: z.string().trim().min(2).max(120).optional(),
      }).parse(req.body);
      const identity = await verifyIdentityToken(parsed.provider, parsed.idToken, parsed.nonce);
      const replayHash = identityTokenHash(parsed.idToken);
      try {
        await db.insert(externalAuthTokens).values({ provider: parsed.provider, tokenHash: replayHash, expiresAt: identity.expiresAt });
      } catch (error: any) {
        if (error?.code === "23505") return res.status(409).json({ message: "This identity token was already used. Please sign in again." });
        throw error;
      }

      const [existingIdentity] = await db.select().from(authIdentities)
        .where(and(eq(authIdentities.provider, parsed.provider), eq(authIdentities.providerSubject, identity.subject))).limit(1);
      let user: typeof users.$inferSelect | undefined;
      let created = false;
      if (existingIdentity) {
        [user] = await db.select().from(users).where(eq(users.id, existingIdentity.userId)).limit(1);
      } else if (identity.email && identity.emailVerified) {
        [user] = await db.select().from(users).where(eq(users.email, identity.email)).limit(1);
      }
      if (!user) {
        const role = parsed.role || defaultRoleForAudience(audience);
        if (!roleAllowedForAudience(audience, role)) return res.status(403).json({ message: "Use the MansaMart application for this account type" });
        if (!identity.email || !identity.emailVerified) return res.status(400).json({ message: "The identity provider must share a verified email when creating an account" });
        const password = await hashPassword(crypto.randomBytes(48).toString("base64url"));
        [user] = await db.insert(users).values({
          email: identity.email,
          password,
          name: parsed.name || identity.name || "MansaMart member",
          role: role as any,
          businessName: role === "vendor" || role === "service_provider" ? (parsed.name || identity.name) : null,
        }).returning();
        created = true;
      }
      if (user.role === "admin" || !roleAllowedForAudience(audience, user.role)) {
        return res.status(403).json({ message: "Use the MansaMart application for your account type" });
      }
      await db.insert(authIdentities).values({
        userId: user.id,
        provider: parsed.provider,
        providerSubject: identity.subject,
        providerEmail: identity.email,
      }).onConflictDoNothing();
      await db.update(authIdentities).set({ lastUsedAt: new Date(), providerEmail: identity.email })
        .where(and(eq(authIdentities.provider, parsed.provider), eq(authIdentities.providerSubject, identity.subject)));
      if (created) await createDefaultProfiles(user);
      const token = await createSession(user.id, audience, undefined, sessionMetadataFromRequest(req));
      await notifyUser(user.id, "security", `${parsed.provider === "apple" ? "Apple" : "Google"} sign-in`, "A new session was created using your connected identity.", "/account-security");
      return res.status(created ? 201 : 200).json({ token, user: safeUser(user), hasPin: !!user.pin, created });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Invalid sign-in request" });
      if (err instanceof Error && /not configured|keys are unavailable/.test(err.message)) return res.status(503).json({ message: err.message });
      if (err instanceof Error && /identity token|signing key|nonce/.test(err.message)) return res.status(401).json({ message: err.message });
      return res.status(500).json({ message: "Social sign-in failed" });
    }
  });

  app.post("/api/auth/forgot-password", authRateLimit, async (req: Request, res: Response) => {
    const generic = { message: "If that account exists, password reset instructions have been sent." };
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
      if (user && user.role !== "admin") {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
        await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60_000) });
        await sendPasswordResetEmail(user.email, token).catch((error) => {
          console.warn("Password reset email could not be delivered:", error instanceof Error ? error.message : "email error");
        });
      }
      return res.status(202).json(generic);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Enter a valid email address" });
      return res.status(202).json(generic);
    }
  });

  app.post("/api/auth/reset-password", authRateLimit, async (req: Request, res: Response) => {
    try {
      const { token, password } = z.object({ token: z.string().min(32).max(256), password: z.string().min(8).max(128) }).parse(req.body);
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const success = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM password_reset_tokens WHERE token_hash = ${tokenHash} FOR UPDATE`);
        const [reset] = await tx.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
        if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) return false;
        const passwordHash = await hashPassword(password);
        await tx.update(users).set({ password: passwordHash, updatedAt: new Date() }).where(eq(users.id, reset.userId));
        await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, reset.id));
        await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
        return true;
      });
      if (!success) return res.status(400).json({ message: "This reset link is invalid or expired" });
      return res.json({ success: true });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Invalid reset request" });
      return res.status(500).json({ message: "Password reset failed" });
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
      if (data.phone) data.phone = normalizeGambianPhone(data.phone);
      if (isPersonalProfileLocked(user)) {
        const updated = await submitPersonalProfileChange(user, data);
        return res.json({ user: safeUser(updated), changeRequestSubmitted: true, message: "Your verified personal profile is locked. Changes were submitted for admin approval." });
      }
      const [updated] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
      return res.json({ user: safeUser(updated) });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      if (err instanceof Error && /Gambian phone/.test(err.message)) return res.status(400).json({ message: err.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: Request, res: Response) => {
    const token = getTokenFromRequest(req);
    if (token) await deleteSession(token);
    return res.json({ success: true });
  });

  app.get("/api/auth/sessions", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    const current = (req as any).session as typeof sessions.$inferSelect;
    const rows = await db.select({
      id: sessions.id,
      audience: sessions.audience,
      deviceName: sessions.deviceName,
      devicePlatform: sessions.devicePlatform,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
      createdAt: sessions.createdAt,
    }).from(sessions).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastSeenAt));
    return res.json(rows.map(row => ({ ...row, current: row.id === current.id })));
  });

  app.delete("/api/auth/sessions/:id", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    const sessionId = param(req, "id");
    const [revoked] = await db.update(sessions).set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id), isNull(sessions.revokedAt))).returning({ id: sessions.id });
    if (!revoked) return res.status(404).json({ message: "Session not found" });
    await audit(user.id, "session.revoked", "session", sessionId, { current: sessionId === (req as any).session?.id });
    return res.json({ success: true });
  });

  app.delete("/api/auth/sessions", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    const current = (req as any).session as typeof sessions.$inferSelect;
    const revoked = await db.update(sessions).set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, user.id), ne(sessions.id, current.id), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    await audit(user.id, "sessions.revoked_others", "session", current.id, { count: revoked.length });
    return res.json({ success: true, revoked: revoked.length });
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
    const canSeeHidden = viewer?.role === "vendor" && viewer.id === p.vendorId;
    if (!canSeeHidden && (!p.inStock || Number(p.stock || 0) <= 0)) return res.status(404).json({ message: "Product not available" });
    return res.json(p);
  });

  app.post("/api/products", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
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
      const [vendorProfileForProduct] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
      if (!isBusinessVerified(vendorProfileForProduct)) {
        return res.status(403).json({ message: "Your vendor profile must be verified before you can publish products." });
      }
      const primaryCategory = vendorProfileForProduct?.shopCategory || user.businessType || "general";
      const allowedCategories = new Set([primaryCategory, ...(Array.isArray(vendorProfileForProduct?.allowedCategories) ? vendorProfileForProduct.allowedCategories : [])]);
      if (primaryCategory !== "general" && !allowedCategories.has(data.category)) {
        return res.status(403).json({ message: `Your shop profile is set as ${primaryCategory}. Update your vendor profile before posting ${data.category} products.` });
      }
      const stockValue = Number(data.stock ?? 100);
      const cleanImages = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 8) : [];
      const productData: any = { ...data };
      productData.brand = vendorProfileForProduct?.storeName || user.businessName || user.name || data.brand;
      productData.location = vendorProfileForProduct?.location || data.location || user.area || user.city || user.region || "The Gambia";
      productData.area = data.area || user.area || user.city || vendorProfileForProduct?.location || productData.location;
      productData.latitude = data.latitude ?? user.latitude ?? null;
      productData.longitude = data.longitude ?? user.longitude ?? null;
      const [p] = await db.insert(products).values({ ...productData, images: cleanImages, stock: stockValue, inStock: stockValue > 0, vendorId: user.id, rating: 4.5, reviewCount: 0 }).returning();
      return res.status(201).json(p);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/products/:id", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [p] = await db.select().from(products).where(eq(products.id, param(req, "id"))).limit(1);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (p.vendorId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const [profile] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
      if (!isBusinessVerified(profile)) {
        return res.status(403).json({ message: "Your vendor profile must be verified before you can update products." });
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
      if (data.category) {
        const [vp] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
        const primaryCategory = vp?.shopCategory || user.businessType || "general";
        const allowedCategories = new Set([primaryCategory, ...(Array.isArray(vp?.allowedCategories) ? vp.allowedCategories : [])]);
        if (primaryCategory !== "general" && !allowedCategories.has(data.category)) {
          return res.status(403).json({ message: `Your shop profile is set as ${primaryCategory}. Update your vendor profile before posting ${data.category} products.` });
        }
      }
      const updateData: any = { ...data };
      const [vp] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, user.id)).limit(1);
      updateData.brand = vp?.storeName || user.businessName || user.name || p.brand;
      updateData.location = vp?.location || data.location || user.area || user.city || user.region || p.location || "The Gambia";
      updateData.area = data.area || user.area || user.city || vp?.location || p.area || updateData.location;
      updateData.latitude = data.latitude ?? user.latitude ?? p.latitude ?? null;
      updateData.longitude = data.longitude ?? user.longitude ?? p.longitude ?? null;
      if (Array.isArray(updateData.images)) updateData.images = updateData.images.filter(Boolean).slice(0, 8);
      if (typeof updateData.stock === "number") updateData.inStock = updateData.stock > 0;
      const [updated] = await db.update(products).set(updateData).where(eq(products.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [p] = await db.select().from(products).where(eq(products.id, param(req, "id"))).limit(1);
      if (!p) return res.status(404).json({ message: "Not found" });
      if (p.vendorId !== user.id) return res.status(403).json({ message: "Forbidden" });
      await db.delete(products).where(eq(products.id, param(req, "id")));
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products/vendor/mine", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
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

  app.post("/api/services", requireAuth, requireRole("service_provider"), async (req: Request, res: Response) => {
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
      const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
      if (!isBusinessVerified(profile)) {
        return res.status(403).json({ message: "Your provider profile must be verified before you can publish services." });
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

  app.put("/api/services/:id", requireAuth, requireRole("service_provider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [s] = await db.select().from(services).where(eq(services.id, param(req, "id"))).limit(1);
      if (!s) return res.status(404).json({ message: "Not found" });
      if (s.providerId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
      if (!isBusinessVerified(profile)) {
        return res.status(403).json({ message: "Your provider profile must be verified before you can update services." });
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
      updateData.area = data.area || user.area || user.city || user.region || s.area || "The Gambia";
      updateData.latitude = data.latitude ?? user.latitude ?? s.latitude ?? null;
      updateData.longitude = data.longitude ?? user.longitude ?? s.longitude ?? null;
      updateData.providerName = user.businessName ?? user.name;
      const [updated] = await db.update(services).set(updateData).where(eq(services.id, param(req, "id"))).returning();
      return res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/services/provider/mine", requireAuth, requireRole("service_provider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(services).where(eq(services.providerId, user.id)).orderBy(desc(services.createdAt));
    return res.json(rows);
  });

  app.delete("/api/services/:id", requireAuth, requireRole("service_provider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [service] = await db.select().from(services).where(eq(services.id, param(req, "id"))).limit(1);
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (service.providerId !== user.id) return res.status(403).json({ message: "Forbidden" });
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

  app.get("/api/orders", requireAuth, requireRole("user", "vendor"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (user.role === "vendor") {
      const rows = await getOrdersForVendor(user.id);
      return res.json(rows);
    }
    const rows = await db.select().from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt));
    return res.json(rows.map(safeOrder));
  });

  app.get("/api/orders/:id", requireAuth, requireRole("user", "vendor"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [o] = await db.select().from(orders).where(eq(orders.id, param(req, "id"))).limit(1);
    if (!o) return res.status(404).json({ message: "Not found" });
    if (user.role === "vendor") {
      const vendorOrder = (await getOrdersForVendor(user.id)).find((order) => order.id === o.id);
      if (!vendorOrder) return res.status(403).json({ message: "Forbidden" });
      return res.json(safeOrder(vendorOrder));
    }
    if (o.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
    return res.json(safeOrder(o));
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
        deliveryLatitude: z.number().min(-90).max(90).optional(),
        deliveryLongitude: z.number().min(-180).max(180).optional(),
        deliveryArea: z.string().optional(),
        notes: z.string().optional(),
      }).refine((value) => (value.deliveryLatitude == null) === (value.deliveryLongitude == null), {
        message: "Delivery latitude and longitude must be provided together",
        path: ["deliveryLatitude"],
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

  app.put("/api/orders/:id/status", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const orderId = param(req, "id");
      const [currentOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!currentOrder) return res.status(404).json({ message: "Order not found" });

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

  app.get("/api/bookings", requireAuth, requireRole("user", "service_provider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    let rows: Array<{ booking: typeof bookings.$inferSelect; providerName: string | null }>;
    if (user.role === "service_provider") {
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

      await notifyUser(user.id, "booking_submitted", "Booking Submitted!", `Your booking for ${service.name} on ${data.date} at ${data.time} is pending confirmation.`, "/bookings", { bookingId: b.id, status: "pending" });

      if (service.providerId) {
        await notifyUser(service.providerId, "new_booking", "New Service Booking", `${user.name} requested ${service.name} on ${data.date} at ${data.time}.`, "/bookings", { bookingId: b.id, status: "pending" });
      }

      return res.status(201).json({ ...b, providerName: service.providerName });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/bookings/:id/status", requireAuth, requireRole("user", "service_provider"), async (req: Request, res: Response) => {
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
        await notifyUser(b.userId, "booking_updated", "Booking Updated", `${b.serviceName} is now ${status.replace(/_/g, " ")}.`, "/bookings", { bookingId: b.id, status });
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

  app.get("/api/cart", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const items = await db
      .select({ cartItem: cartItems, product: products })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(and(eq(cartItems.userId, user.id), eq(products.inStock, true), gt(products.stock, 0)));
    return res.json(items);
  });

  app.post("/api/cart", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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

  app.put("/api/cart/:id", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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

  app.delete("/api/cart/:id", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.delete(cartItems).where(and(eq(cartItems.id, param(req, "id")), eq(cartItems.userId, user.id)));
    return res.json({ success: true });
  });

  app.delete("/api/cart", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.delete(cartItems).where(eq(cartItems.userId, user.id));
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // WISHLIST
  // ────────────────────────────────────────────────────────────────

  app.get("/api/wishlist", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const items = await db
      .select({ wishlistItem: wishlistItems, product: products })
      .from(wishlistItems)
      .innerJoin(products, eq(wishlistItems.productId, products.id))
      .where(and(eq(wishlistItems.userId, user.id), eq(products.inStock, true), gt(products.stock, 0)));
    return res.json(items);
  });

  app.post("/api/wishlist", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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

  app.delete("/api/wishlist/:productId", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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

  app.post("/api/reviews", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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

  app.get("/api/notifications", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return res.json(rows);
  });

  app.put("/api/notifications/:id/read", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const now = new Date();
    await db.update(notifications).set({ isRead: true, readAt: now })
      .where(and(eq(notifications.id, param(req, "id")), eq(notifications.userId, user.id)));
    await db.update(notificationDeliveries).set({ readAt: now, updatedAt: now })
      .where(and(eq(notificationDeliveries.notificationId, param(req, "id")), eq(notificationDeliveries.userId, user.id)));
    return res.json({ success: true });
  });

  app.put("/api/notifications/read-all", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const now = new Date();
    await db.update(notifications).set({ isRead: true, readAt: now }).where(eq(notifications.userId, user.id));
    await db.update(notificationDeliveries).set({ readAt: now, updatedAt: now }).where(eq(notificationDeliveries.userId, user.id));
    return res.json({ success: true });
  });

  app.get("/api/notifications/preferences", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    let [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, user.id)).limit(1);
    if (!preference) {
      [preference] = await db.insert(notificationPreferences).values({ userId: user.id }).returning();
    }
    return res.json(preference);
  });

  app.put("/api/notifications/preferences", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as typeof users.$inferSelect;
      const values = z.object({
        orders: z.boolean().optional(),
        delivery: z.boolean().optional(),
        payments: z.boolean().optional(),
        bookings: z.boolean().optional(),
        messages: z.boolean().optional(),
        promotions: z.boolean().optional(),
        security: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        whatsappEnabled: z.boolean().optional(),
        whatsappPhone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/).nullable().optional(),
        quietHoursEnabled: z.boolean().optional(),
        quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        timezone: z.string().trim().min(3).max(80).optional(),
        unreadEscalationEnabled: z.boolean().optional(),
      }).strict().parse(req.body);
      if (values.whatsappEnabled && !values.whatsappPhone) return res.status(400).json({ message: "A WhatsApp phone number is required for opt-in" });
      const consent = values.whatsappEnabled === true ? new Date() : values.whatsappEnabled === false ? null : undefined;
      const saved = { ...values, ...(consent !== undefined ? { whatsappOptInAt: consent } : {}), updatedAt: new Date() };
      const [updated] = await db.insert(notificationPreferences).values({ userId: user.id, ...saved })
        .onConflictDoUpdate({ target: notificationPreferences.userId, set: saved }).returning();
      return res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid notification preferences" });
      return res.status(500).json({ message: "Notification preferences could not be saved" });
    }
  });

  app.get("/api/notifications/devices", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    const rows = await db.select({
      id: pushDevices.id,
      audience: pushDevices.audience,
      platform: pushDevices.platform,
      deviceName: pushDevices.deviceName,
      enabled: pushDevices.enabled,
      lastSeenAt: pushDevices.lastSeenAt,
      createdAt: pushDevices.createdAt,
    }).from(pushDevices).where(eq(pushDevices.userId, user.id)).orderBy(desc(pushDevices.lastSeenAt));
    return res.json(rows);
  });

  app.post("/api/notifications/devices", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as typeof users.$inferSelect;
      const session = (req as any).session as typeof sessions.$inferSelect;
      const { expoPushToken, platform, deviceName } = z.object({
        expoPushToken: z.string().min(20).max(300),
        platform: z.enum(["ios", "android"]),
        deviceName: z.string().trim().min(1).max(120).optional(),
      }).parse(req.body);
      if (!isExpoPushToken(expoPushToken)) return res.status(400).json({ message: "Invalid Expo push token" });
      const [device] = await db.insert(pushDevices).values({
        userId: user.id,
        expoPushToken,
        audience: session.audience,
        platform,
        deviceName: deviceName || session.deviceName,
        enabled: true,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: pushDevices.expoPushToken,
        set: { userId: user.id, audience: session.audience, platform, deviceName: deviceName || session.deviceName, enabled: true, lastSeenAt: new Date(), updatedAt: new Date() },
      }).returning({ id: pushDevices.id, enabled: pushDevices.enabled });
      return res.status(201).json(device);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message || "Invalid push device" });
      return res.status(500).json({ message: "Push device could not be registered" });
    }
  });

  app.delete("/api/notifications/devices/:id", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    const [disabled] = await db.update(pushDevices).set({ enabled: false, updatedAt: new Date() })
      .where(and(eq(pushDevices.id, param(req, "id")), eq(pushDevices.userId, user.id))).returning({ id: pushDevices.id });
    if (!disabled) return res.status(404).json({ message: "Push device not found" });
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

  app.get("/api/admin/access/me", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    const admin = (req as any).user as typeof users.$inferSelect;
    const [profile] = await db.select().from(adminAccessProfiles).where(eq(adminAccessProfiles.userId, admin.id)).limit(1);
    const staffRole = (profile?.staffRole || "super_admin") as AdminStaffRole;
    return res.json({ staffRole, department: profile?.department || "management", status: profile?.status || "active", permissions: permissionsForRole(staffRole, profile?.permissions || []) });
  });

  app.get("/api/admin/staff", requireAuth, requireRole("admin"), requireAdminPermission("staff.manage"), async (_req: Request, res: Response) => {
    const admins = await db.select({ user: users, access: adminAccessProfiles }).from(users)
      .leftJoin(adminAccessProfiles, eq(adminAccessProfiles.userId, users.id)).where(eq(users.role, "admin")).orderBy(desc(users.createdAt));
    return res.json(admins.map(({ user, access }) => ({ ...safeUser(user), staffRole: access?.staffRole || "super_admin", permissions: permissionsForRole((access?.staffRole || "super_admin") as AdminStaffRole, access?.permissions || []), department: access?.department || "management", staffStatus: access?.status || "active" })));
  });

  app.put("/api/admin/staff/:userId", requireAuth, requireRole("admin"), requireAdminPermission("staff.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user as typeof users.$inferSelect;
      const targetId = param(req, "userId");
      const body = z.object({ staffRole: z.enum(ADMIN_STAFF_ROLES), department: z.string().trim().min(2).max(80), status: z.enum(["active", "suspended"]), permissions: z.array(z.enum(ADMIN_PERMISSIONS)).max(ADMIN_PERMISSIONS.length).default([]), currentPassword: z.string().min(1) }).parse(req.body);
      if (!(await comparePassword(body.currentPassword, admin.password))) return res.status(403).json({ message: "Administrator reauthentication failed" });
      const [target] = await db.select().from(users).where(and(eq(users.id, targetId), eq(users.role, "admin"))).limit(1);
      if (!target) return res.status(404).json({ message: "Administrator not found" });
      if (targetId === admin.id && (body.status !== "active" || body.staffRole !== "super_admin")) return res.status(409).json({ message: "You cannot remove your own active super-administrator access" });
      const [profile] = await db.insert(adminAccessProfiles).values({ userId: targetId, staffRole: body.staffRole, department: body.department, status: body.status, permissions: body.permissions, updatedAt: new Date() })
        .onConflictDoUpdate({ target: adminAccessProfiles.userId, set: { staffRole: body.staffRole, department: body.department, status: body.status, permissions: body.permissions, updatedAt: new Date() } }).returning();
      if (body.status === "suspended") await db.delete(sessions).where(eq(sessions.userId, targetId));
      await audit(admin.id, "admin.staff_access_updated", "user", targetId, { staffRole: body.staffRole, department: body.department, status: body.status, permissions: body.permissions });
      return res.json(profile);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0]?.message || "Invalid staff access update" });
      return res.status(500).json({ message: "Staff access update failed" });
    }
  });

  app.get("/api/admin/settings", requireAuth, requireRole("admin"), requireAdminPermission("settings.manage"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(platformSettings).where(eq(platformSettings.isSensitive, false)).orderBy(platformSettings.category, platformSettings.key);
    return res.json(rows);
  });

  app.put("/api/admin/settings/:key", requireAuth, requireRole("admin"), requireAdminPermission("settings.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user as typeof users.$inferSelect;
      const { value, currentPassword } = z.object({ value: z.unknown(), currentPassword: z.string().min(1) }).parse(req.body);
      if (!isSafePlatformSettingValue(value)) return res.status(400).json({ message: "Unsupported setting value" });
      if (!(await comparePassword(currentPassword, admin.password))) return res.status(403).json({ message: "Administrator reauthentication failed" });
      const key = param(req, "key");
      const [existing] = await db.select().from(platformSettings).where(and(eq(platformSettings.key, key), eq(platformSettings.isSensitive, false))).limit(1);
      if (!existing) return res.status(404).json({ message: "Editable setting not found" });
      const [updated] = await db.update(platformSettings).set({ value: value as any, updatedBy: admin.id, updatedAt: new Date() }).where(eq(platformSettings.key, key)).returning();
      await audit(admin.id, "admin.setting_updated", "platform_setting", key, { previousValue: existing.value, value });
      return res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Invalid setting update" });
      return res.status(500).json({ message: "Setting update failed" });
    }
  });

  app.get("/api/admin/incidents", requireAuth, requireRole("admin"), requireAdminPermission("dashboard.read"), async (_req: Request, res: Response) => {
    return res.json(await db.select().from(operationalIncidents).orderBy(desc(operationalIncidents.createdAt)).limit(200));
  });

  app.post("/api/admin/incidents", requireAuth, requireRole("admin"), requireAdminPermission("orders.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user as typeof users.$inferSelect;
      const body = z.object({ type: z.string().trim().min(2).max(80), severity: z.enum(["low", "medium", "high", "critical"]), title: z.string().trim().min(3).max(180), description: z.string().trim().max(3000).optional(), entityType: z.string().trim().max(80).optional(), entityId: z.string().trim().max(120).optional() }).parse(req.body);
      const [incident] = await db.insert(operationalIncidents).values({ ...body, assignedTo: admin.id }).returning();
      await audit(admin.id, "admin.incident_created", "operational_incident", incident.id, { severity: body.severity, type: body.type });
      return res.status(201).json(incident);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0]?.message || "Invalid incident" });
      return res.status(500).json({ message: "Incident could not be created" });
    }
  });

  app.put("/api/admin/incidents/:id", requireAuth, requireRole("admin"), requireAdminPermission("orders.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user as typeof users.$inferSelect;
      const { status, resolution } = z.object({ status: z.enum(["open", "investigating", "resolved", "closed"]), resolution: z.string().trim().max(3000).optional() }).parse(req.body);
      if (["resolved", "closed"].includes(status) && (!resolution || resolution.length < 5)) return res.status(400).json({ message: "A resolution is required" });
      const [incident] = await db.update(operationalIncidents).set({ status, resolution, resolvedAt: ["resolved", "closed"].includes(status) ? new Date() : null, updatedAt: new Date() }).where(eq(operationalIncidents.id, param(req, "id"))).returning();
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      await audit(admin.id, `admin.incident_${status}`, "operational_incident", incident.id, { resolution });
      return res.json(incident);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Invalid incident update" });
      return res.status(500).json({ message: "Incident update failed" });
    }
  });

  app.get("/api/admin/notifications", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const recent = await db.select().from(notificationDeliveries).orderBy(desc(notificationDeliveries.createdAt)).limit(100);
    return res.json({
      recent,
      stats: {
        queued: recent.filter(row => row.status === "queued").length,
        sent: recent.filter(row => ["sent", "delivered", "read"].includes(row.status)).length,
        failed: recent.filter(row => row.status === "failed").length,
        cancelled: recent.filter(row => row.status === "cancelled").length,
      },
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

  app.put("/api/admin/users/:id/status", requireAuth, requireRole("admin"), requireAdminPermission("users.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user as typeof users.$inferSelect;
      const targetId = param(req, "id");
      const { status, reason, currentPassword } = z.object({ status: z.enum(["active", "suspended"]), reason: z.string().trim().min(5).max(500), currentPassword: z.string().min(1) }).parse(req.body);
      if (targetId === admin.id) return res.status(409).json({ message: "You cannot suspend your own account" });
      if (!(await comparePassword(currentPassword, admin.password))) return res.status(403).json({ message: "Administrator reauthentication failed" });
      const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) return res.status(404).json({ message: "User not found" });
      const [updated] = await db.update(users).set({ accountStatus: status, suspensionReason: status === "suspended" ? reason : null, suspendedAt: status === "suspended" ? new Date() : null, updatedAt: new Date() }).where(eq(users.id, targetId)).returning();
      if (status === "suspended") await db.delete(sessions).where(eq(sessions.userId, targetId));
      await audit(admin.id, `admin.user_${status}`, "user", targetId, { reason, previousStatus: target.accountStatus });
      return res.json(safeUser(updated));
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0]?.message || "Invalid account status update" });
      return res.status(500).json({ message: "Account status update failed" });
    }
  });

  app.put("/api/admin/users/:id/role", requireAuth, requireRole("admin"), requireAdminPermission("users.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      const targetId = param(req, "id");
      const { role, currentPassword, reason } = z.object({ role: z.enum(["user", "vendor", "service_provider", "delivery_rider", "admin"]), currentPassword: z.string().min(1), reason: z.string().trim().min(5).max(500) }).parse(req.body);
      if (targetId === admin.id) return res.status(409).json({ message: "Administrators cannot change their own role" });
      if (!(await comparePassword(currentPassword, admin.password))) return res.status(403).json({ message: "Administrator reauthentication failed" });
      const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "admin" && role !== "admin") {
        const admins = await db.select({ value: count() }).from(users).where(eq(users.role, "admin"));
        if (Number(admins[0]?.value || 0) <= 1) return res.status(409).json({ message: "The last administrator cannot be demoted" });
      }
      const [u] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, targetId)).returning();
      await db.delete(sessions).where(eq(sessions.userId, targetId));
      await audit(admin.id, "admin.user_role_changed", "user", targetId, { previousRole: target.role, role, reason });
      return res.json(safeUser(u));
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0]?.message || "Invalid role change" });
      return res.status(500).json({ message: "Role change failed" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireRole("admin"), requireAdminPermission("users.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      const targetId = param(req, "id");
      const { currentPassword, reason } = z.object({ currentPassword: z.string().min(1), reason: z.string().trim().min(5).max(500) }).parse(req.body || {});
      if (targetId === admin.id) return res.status(409).json({ message: "Administrators cannot delete their own account" });
      if (!(await comparePassword(currentPassword, admin.password))) return res.status(403).json({ message: "Administrator reauthentication failed" });
      const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "admin") {
        const admins = await db.select({ value: count() }).from(users).where(eq(users.role, "admin"));
        if (Number(admins[0]?.value || 0) <= 1) return res.status(409).json({ message: "The last administrator cannot be deleted" });
      }
      await audit(admin.id, "admin.user_deleted", "user", targetId, { role: target.role, email: target.email, reason });
      await db.delete(users).where(eq(users.id, targetId));
      return res.json({ success: true });
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0]?.message || "Invalid deletion request" });
      return res.status(500).json({ message: "User deletion failed" });
    }
  });

  app.get("/api/admin/orders", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    return res.json(rows.map(safeOrder));
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
  app.get("/api/addresses", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(addresses).where(eq(addresses.userId, user.id)).orderBy(desc(addresses.isDefault));
    return res.json(rows);
  });

  app.post("/api/addresses", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const schema = z.object({ label: z.string().default("Home"), fullName: z.string().min(1), phone: z.string().min(1), address: z.string().min(1), city: z.string().min(1), region: z.string().min(1), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), locationAccuracy: z.number().nonnegative().optional(), isDefault: z.boolean().default(false) }).refine((value) => (value.latitude == null) === (value.longitude == null), { message: "Latitude and longitude must be provided together", path: ["latitude"] });
    const data = schema.parse(req.body);
    if (data.isDefault) await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    const [addr] = await db.insert(addresses).values({ ...data, userId: user.id }).returning();
    return res.json(addr);
  });

  app.put("/api/addresses/:id", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const schema = z.object({ label: z.string().optional(), fullName: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), city: z.string().optional(), region: z.string().optional(), latitude: z.number().min(-90).max(90).optional().nullable(), longitude: z.number().min(-180).max(180).optional().nullable(), locationAccuracy: z.number().nonnegative().optional().nullable(), isDefault: z.boolean().optional() }).refine((value) => ("latitude" in value) === ("longitude" in value) && (value.latitude == null) === (value.longitude == null), { message: "Latitude and longitude must be updated together", path: ["latitude"] });
    const data = schema.parse(req.body);
    if (data.isDefault) await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    const [addr] = await db.update(addresses).set(data).where(and(eq(addresses.id, param(req, "id")), eq(addresses.userId, user.id))).returning();
    return res.json(addr);
  });

  app.delete("/api/addresses/:id", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    await db.delete(addresses).where(and(eq(addresses.id, param(req, "id")), eq(addresses.userId, user.id)));
    return res.json({ success: true });
  });

  // ────────────────────────────────────────────────────────────────
  // VENDOR PROFILES
  // ────────────────────────────────────────────────────────────────
  app.get("/api/vendors/me/profile", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
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
    return res.json({ ...publicVendorProfile(vp), vendorName: vendorUser?.name, products: vendorProducts, reviews: vendorReviews, productCount: vendorProducts.length });
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
  app.get("/api/providers/me/profile", requireAuth, requireRole("service_provider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [pp] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, user.id)).limit(1);
    return res.json(pp || null);
  });

  app.get("/api/providers/:id", async (req: Request, res: Response) => {
    const [pp] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, param(req, "id"))).limit(1);
    if (!pp) return res.status(404).json({ message: "Provider not found" });
    const providerServices = await db.select().from(services).where(eq(services.providerId, param(req, "id")));
    const providerReviews = await db.select().from(reviews).where(and(eq(reviews.targetId, param(req, "id")), eq(reviews.targetType, "provider"))).orderBy(desc(reviews.createdAt)).limit(10);
    return res.json({ ...publicProviderProfile(pp), services: providerServices, reviews: providerReviews, serviceCount: providerServices.length });
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
  app.post("/api/coupons/validate", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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

  app.post("/api/reviews/:targetType/:targetId", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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

  app.post("/api/reviews/:id/helpful", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const reviewId = param(req, "id");
    try {
      const updated = await db.transaction(async (tx) => {
        const [rev] = await tx.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
        if (!rev) return null;
        const inserted = await tx.insert(reviewHelpfulVotes).values({ reviewId, userId: user.id }).onConflictDoNothing().returning();
        if (inserted.length === 0) throw new Error("ALREADY_VOTED");
        const [row] = await tx.update(reviews).set({ helpful: sql`${reviews.helpful} + 1` }).where(eq(reviews.id, reviewId)).returning();
        return row;
      });
      if (!updated) return res.status(404).json({ message: "Review not found" });
      return res.json(updated);
    } catch (error: any) {
      if (error.message === "ALREADY_VOTED" || error.code === "23505") return res.status(409).json({ message: "You already marked this review helpful" });
      return res.status(500).json({ message: "Unable to record helpful vote" });
    }
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
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(128) }).parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    const valid = await comparePassword(currentPassword, u.password);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
    const hashed = await hashPassword(newPassword);
    await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, user.id));
    await db.delete(sessions).where(eq(sessions.userId, user.id));
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

  app.put("/api/admin/verify/personal/:userId", requireAuth, requireRole("admin"), requireAdminPermission("verification.manage"), async (req: Request, res: Response) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [u] = await db.update(users).set({ verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified", profileChangeNote: note, updatedAt: new Date() }).where(eq(users.id, param(req, "userId"))).returning();
    if (!u) return res.status(404).json({ message: "User not found" });
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "🎉 Profile Verified!" : "Verification Update", body: status === "verified" ? "Your personal profile has been verified. Future personal changes require admin approval." : `Verification update: ${note || "Please resubmit your documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(safeUser(u as any));
  });

  app.put("/api/admin/verify/vendor/:userId", requireAuth, requireRole("admin"), requireAdminPermission("verification.manage"), async (req: Request, res: Response) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [vp] = await db.update(vendorProfiles).set({ verificationStatus: status, verificationNote: note, profileEditLocked: status === "verified", updatedAt: new Date() }).where(eq(vendorProfiles.userId, param(req, "userId"))).returning();
    if (!vp) return res.status(404).json({ message: "Vendor profile not found" });
    await db.update(users).set({ role: "vendor", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "🎉 Store Verified!" : "Verification Update", body: status === "verified" ? "Your store has been verified! You can now sell on MansaMart." : `Verification update: ${note || "Please resubmit your documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(vp);
  });

  app.put("/api/admin/verify/provider/:userId", requireAuth, requireRole("admin"), requireAdminPermission("verification.manage"), async (req: Request, res: Response) => {
    const { status, note } = z.object({ status: z.enum(["verified", "rejected"]), note: z.string().optional() }).parse(req.body);
    const [pp] = await db.update(providerProfiles).set({ verificationStatus: status, verificationNote: note, updatedAt: new Date() }).where(eq(providerProfiles.userId, param(req, "userId"))).returning();
    if (!pp) return res.status(404).json({ message: "Provider profile not found" });
    await db.update(users).set({ role: "service_provider", verificationStatus: status, isVerified: status === "verified", profileEditLocked: status === "verified" }).where(eq(users.id, param(req, "userId")));
    await db.insert(notifications).values({ userId: param(req, "userId"), type: "verification", title: status === "verified" ? "🎉 Profile Verified!" : "Verification Update", body: status === "verified" ? "Your provider profile has been verified!" : `Update: ${note || "Please resubmit documents."}`, icon: status === "verified" ? "checkmark-circle" : "alert-circle", color: status === "verified" ? "#0EA47A" : "#E63946" });
    return res.json(pp);
  });

  app.put("/api/admin/verify/rider/:userId", requireAuth, requireRole("admin"), requireAdminPermission("verification.manage"), async (req: Request, res: Response) => {
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

  app.put("/api/admin/personal-profile-change/:userId", requireAuth, requireRole("admin"), requireAdminPermission("verification.manage"), async (req: Request, res: Response) => {
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

  app.put("/api/admin/vendor-profile-change/:userId", requireAuth, requireRole("admin"), requireAdminPermission("verification.manage"), async (req: Request, res: Response) => {
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
  app.get("/api/vendor/dashboard", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
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

  app.get("/api/provider/dashboard", requireAuth, requireRole("service_provider"), async (req: Request, res: Response) => {
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

  app.get("/api/vendor/low-stock", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(products).where(eq(products.vendorId, user.id)).orderBy(products.stock);
    return res.json(rows.filter(p => p.stock <= 10));
  });

  app.put("/api/vendor/products/:id/stock", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { stock } = z.object({ stock: z.number().int().min(0) }).parse(req.body);
      const [product] = await db.select().from(products).where(and(eq(products.id, param(req, "id")), eq(products.vendorId, user.id))).limit(1);
      if (!product) return res.status(404).json({ message: "Product not found" });
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
  app.get("/api/shopper/me", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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

  app.put("/api/shopper/me", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
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
  app.get("/api/vendor/flash-deals", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
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

  app.post("/api/vendor/flash-deals", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
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

  app.delete("/api/vendor/flash-deals/:id", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const [deal] = await db.select().from(flashDeals).where(eq(flashDeals.id, param(req, "id"))).limit(1);
      if (!deal) return res.status(404).json({ message: "Not found" });
      const [product] = await db.select().from(products).where(eq(products.id, deal.productId)).limit(1);
      if (!product || product.vendorId !== user.id) return res.status(403).json({ message: "Forbidden" });
      await db.update(flashDeals).set({ isActive: false }).where(eq(flashDeals.id, param(req, "id")));
      return res.json({ success: true });
    } catch { return res.status(500).json({ message: "Server error" }); }
  });

  // ────────────────────────────────────────────────────────────────
  // VENDOR TOOLS - PROMOTE / FEATURE
  // ────────────────────────────────────────────────────────────────
  app.post("/api/vendor/promote/:id", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
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

  app.get("/api/wallet", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
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

  app.get("/api/rider/finance", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [wallet, profile] = await Promise.all([
      getOrCreateWallet(user.id),
      ensureRiderProfile(user),
    ]);
    const [recentTransactions, recentSettlements, recentPayouts, recentEarnings] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(50),
      db.select().from(settlements).where(eq(settlements.beneficiaryId, user.id)).orderBy(desc(settlements.createdAt)).limit(50),
      db.select().from(payouts).where(eq(payouts.userId, user.id)).orderBy(desc(payouts.createdAt)).limit(50),
      db.select().from(riderEarnings).where(eq(riderEarnings.riderId, user.id)).orderBy(desc(riderEarnings.createdAt)).limit(50),
    ]);
    const pendingAmounts = recentPayouts.filter((payout) => payout.status === "pending").map((payout) => payout.amount);
    const payoutMethod = String(profile.payoutMethod || "").toLowerCase().includes("bank") ? "bank_transfer" : profile.mobileMoneyNumber ? "mobile_money" : profile.accountNumber ? "bank_transfer" : "";
    return res.json({
      wallet,
      transactions: recentTransactions,
      settlements: recentSettlements,
      payouts: recentPayouts,
      earnings: recentEarnings,
      summary: {
        availableForPayout: availablePayoutBalance(wallet.balance, pendingAmounts),
        pendingPayout: pendingAmounts.reduce((sum, amount) => sum + amount, 0),
        totalEarned: recentEarnings.filter((earning) => earning.status === "completed").reduce((sum, earning) => sum + earning.amount, 0),
        totalPaidOut: recentPayouts.filter((payout) => payout.status === "completed").reduce((sum, payout) => sum + payout.amount, 0),
      },
      payoutProfile: {
        verificationStatus: profile.verificationStatus,
        method: payoutMethod,
        accountName: profile.accountName || profile.displayName || user.name,
        accountNumber: payoutMethod === "bank_transfer" ? profile.accountNumber || "" : profile.mobileMoneyNumber || "",
        provider: payoutMethod === "bank_transfer" ? profile.bankName || "" : profile.mobileMoneyProvider || "",
      },
    });
  });

  app.post("/api/wallet/deposit/manual", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    try {
      if (process.env.WALLET_PAYMENTS_ENABLED !== "true") return res.status(503).json({ message: "Wallet funding is not available yet" });
      const user = (req as any).user;
      const { amount, method, reference } = z.object({
        amount: z.number().int().min(10).max(100_000),
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

  app.post("/api/wallet/pay-order/:orderId", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    try {
      if (process.env.WALLET_PAYMENTS_ENABLED !== "true") return res.status(503).json({ message: "Wallet payments are not available yet" });
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
      } else if (user.role === "delivery_rider") {
        const [profile] = await db.select().from(deliveryRiders).where(eq(deliveryRiders.userId, user.id)).limit(1);
        if (profile?.verificationStatus !== "verified") return res.status(403).json({ message: "Your rider profile must be verified before requesting a payout." });
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

  app.put("/api/admin/wallet/deposits/:id/confirm", requireAuth, requireRole("admin"), requireAdminPermission("payments.read"), async (req: Request, res: Response) => {
    try {
      if (process.env.WALLET_PAYMENTS_ENABLED !== "true") return res.status(503).json({ message: "Wallet funding is not available yet" });
      const admin = (req as any).user;
      const { currentPassword, reason } = z.object({ currentPassword: z.string().min(1), reason: z.string().trim().min(5).max(500) }).parse(req.body);
      if (!(await comparePassword(currentPassword, admin.password))) return res.status(403).json({ message: "Administrator reauthentication failed" });
      const transactionId = param(req, "id");
      const result = await db.transaction(async (databaseTx) => {
        await databaseTx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
        const [deposit] = await databaseTx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
        if (!deposit || deposit.status !== "pending" || !deposit.userId || deposit.type !== "deposit") throw new Error("PENDING_DEPOSIT_NOT_FOUND");
        await databaseTx.execute(sql`SELECT id FROM wallets WHERE user_id = ${deposit.userId} FOR UPDATE`);
        let [wallet] = await databaseTx.select().from(wallets).where(eq(wallets.userId, deposit.userId)).limit(1);
        if (!wallet) [wallet] = await databaseTx.insert(wallets).values({ userId: deposit.userId }).returning();
        const after = wallet.balance + deposit.amount;
        await databaseTx.update(wallets).set({ balance: after, updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
        const [updated] = await databaseTx.update(transactions).set({ status: "completed", balanceBefore: wallet.balance, balanceAfter: after }).where(eq(transactions.id, deposit.id)).returning();
        await databaseTx.insert(notifications).values({ userId: deposit.userId, type: "wallet", title: "Deposit Confirmed", body: `D ${deposit.amount.toLocaleString()} has been added to your wallet.`, icon: "wallet", color: "#0EA47A" });
        await databaseTx.insert(auditLogs).values({ actorId: admin.id, action: "wallet.deposit_confirmed", entityType: "transaction", entityId: deposit.id, metadata: { userId: deposit.userId, amount: deposit.amount, reason } });
        return updated;
      });
      return res.json(result);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0]?.message || "Invalid confirmation request" });
      if (error.message === "PENDING_DEPOSIT_NOT_FOUND") return res.status(404).json({ message: "Pending deposit not found" });
      return res.status(500).json({ message: "Deposit confirmation failed" });
    }
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

  app.put("/api/admin/payouts/:id", requireAuth, requireRole("admin"), requireAdminPermission("payouts.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      const { status, note, currentPassword } = z.object({ status: z.enum(["approved", "rejected", "completed"]), note: z.string().trim().max(1000).optional(), currentPassword: z.string().optional() }).parse(req.body);
      if (status === "completed" && (!currentPassword || !(await comparePassword(currentPassword, admin.password)))) {
        return res.status(403).json({ message: "Administrator reauthentication is required to complete a payout" });
      }

      const result = await db.transaction(async (tx) => {
        const payoutId = param(req, "id");
        await tx.execute(sql`SELECT id FROM payouts WHERE id = ${payoutId} FOR UPDATE`);
        const [current] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
        if (!current) throw new Error("PAYOUT_NOT_FOUND");
        const allowed = (current.status === "pending" && ["approved", "rejected"].includes(status)) || (current.status === "approved" && ["completed", "rejected"].includes(status));
        if (!allowed) throw new Error("INVALID_PAYOUT_TRANSITION");
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
        return { row, current };
      });
      await audit(admin.id, `payout.${status}`, "payout", result.current.id, { amount: result.current.amount, userId: result.current.userId, note });
      await notifyUser(result.current.userId, "payment", "Payout Updated", `Your payout request for D ${result.current.amount.toLocaleString()} is now ${status}.`, "/wallet", { payoutId: result.current.id, status });
      return res.json(result.row);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Invalid payout update" });
      if (error.message === "PAYOUT_NOT_FOUND") return res.status(404).json({ message: "Payout request not found" });
      if (error.message === "INVALID_PAYOUT_TRANSITION") return res.status(409).json({ message: "That payout status change is not allowed" });
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

  app.get("/api/rider/me/profile", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user as typeof users.$inferSelect;
    const profile = await ensureRiderProfile(user);
    const completion = await computeProfileCompletion(user);
    return res.json({ ...safeRiderProfile(profile), user: safeUser(user), completion });
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
      return res.json({ ...safeRiderProfile(profile), completion });
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
      return res.json({ ...safeRiderProfile(profile), completion });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      console.error(err);
      return res.status(500).json({ message: "Rider documents update failed" });
    }
  });

  app.post("/api/rider/apply", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const data = z.object({ vehicleType: z.string().default("motorbike"), vehiclePlate: z.string().optional(), licenseNumber: z.string().optional(), documents: z.array(z.object({ type: z.string(), url: z.string(), name: z.string() })).optional() }).parse(req.body);
      const [existing] = await db.select().from(deliveryRiders).where(eq(deliveryRiders.userId, user.id)).limit(1);
      if (existing) return res.json(safeRiderProfile(existing));
      const [profile] = await db.insert(deliveryRiders).values({ ...data, userId: user.id }).returning();
      return res.status(201).json(safeRiderProfile(profile));
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/rider/me", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const profile = await ensureRiderProfile(user);
    const activeDeliveries = await db.select().from(deliveries).where(eq(deliveries.riderId, user.id)).orderBy(desc(deliveries.createdAt)).limit(20);
    const offers = await db.select().from(deliveryRequests).where(and(eq(deliveryRequests.riderId, user.id), eq(deliveryRequests.status, "offered"))).orderBy(desc(deliveryRequests.createdAt)).limit(20);
    const completion = await computeProfileCompletion(user);
    return res.json({ profile: safeRiderProfile(profile), activeDeliveries, offers, completion });
  });

  app.put("/api/rider/status", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const requested = z.object({
        isOnline: z.boolean().optional(),
        isAvailable: z.boolean().optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
      }).parse(req.body);
      const current = await ensureRiderProfile(user);
      const active = await db.select({ id: deliveries.id, status: deliveries.status })
        .from(deliveries)
        .where(eq(deliveries.riderId, user.id));
      const resolved = resolveRiderPresence({
        verificationStatus: current.verificationStatus,
        currentOnline: current.isOnline,
        requestedOnline: requested.isOnline,
        requestedAvailable: requested.isAvailable,
        hasActiveDelivery: active.some((delivery) => isActiveDeliveryStatus(delivery.status)),
      });
      if (!resolved.ok) return res.status(403).json({ message: resolved.message });
      const [profile] = await db.update(deliveryRiders).set({
        ...resolved.presence,
        ...(requested.latitude != null ? { latitude: requested.latitude } : {}),
        ...(requested.longitude != null ? { longitude: requested.longitude } : {}),
        updatedAt: new Date(),
      }).where(eq(deliveryRiders.userId, user.id)).returning();
      return res.json(profile);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Rider status update failed" });
    }
  });

  app.post("/api/delivery/dispatch", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { orderId, pickupAddress, pickupLatitude, pickupLongitude } = z.object({
        orderId: z.string(),
        pickupAddress: z.string().optional(),
        pickupLatitude: z.number().min(-90).max(90).optional(),
        pickupLongitude: z.number().min(-180).max(180).optional(),
      }).refine((value) => (value.pickupLatitude == null) === (value.pickupLongitude == null), { message: "Pickup latitude and longitude must be provided together", path: ["pickupLatitude"] }).parse(req.body);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      await ensureVendorFulfillments(order);
      const parties = await getOrderParties(order);
      const fulfillments = await db.select().from(orderVendorFulfillments).where(eq(orderVendorFulfillments.orderId, orderId));
      if (!parties.vendorIds.includes(user.id)) return res.status(403).json({ message: "Forbidden" });
      if (fulfillments.length === 0 || fulfillments.some((row) => row.status !== "ready_for_pickup")) return res.status(409).json({ message: "Every seller must mark their items ready before dispatch." });
      const [existingDelivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, order.id)).orderBy(desc(deliveries.createdAt)).limit(1);
      if (existingDelivery && !["failed", "cancelled"].includes(existingDelivery.status)) return res.status(409).json({ message: "Rider dispatch has already started for this order", delivery: existingDelivery });
      const safeDropoffAddress = `${order.address}, ${order.city}`;
      const safeDropoffLatitude = order.deliveryLatitude;
      const safeDropoffLongitude = order.deliveryLongitude;
      const safeDeliveryFee = order.shipping;
      const safePickupAddress = pickupAddress || user.area || user.address || user.city || "Vendor location";
      const safePickupLatitude = pickupLatitude ?? user.latitude ?? null;
      const safePickupLongitude = pickupLongitude ?? user.longitude ?? null;
      const [delivery] = await db.insert(deliveries).values({ orderId, pickupAddress: safePickupAddress, pickupLatitude: safePickupLatitude, pickupLongitude: safePickupLongitude, dropoffAddress: safeDropoffAddress, dropoffLatitude: safeDropoffLatitude, dropoffLongitude: safeDropoffLongitude, deliveryFee: safeDeliveryFee, status: "searching" }).returning();
      const riders = await db.select().from(deliveryRiders).where(and(eq(deliveryRiders.isOnline, true), eq(deliveryRiders.isAvailable, true), eq(deliveryRiders.verificationStatus, "verified")));
      const nearest = riders.map(r => ({ ...r, distance: distanceKm(r.latitude, r.longitude, safePickupLatitude, safePickupLongitude) })).sort((a, b) => a.distance - b.distance).slice(0, 5);
      for (const rider of nearest) {
        await db.insert(deliveryRequests).values({ deliveryId: delivery.id, riderId: rider.userId, distanceKm: rider.distance, status: "offered", expiresAt: new Date(Date.now() + 60_000) });
        await notifyUser(rider.userId, "delivery_offer", "New Delivery Request", `Pickup: ${safePickupAddress}. Fee: D ${safeDeliveryFee.toLocaleString()}`, "/(rider)/deliveries", { deliveryId: delivery.id, orderId: order.id });
      }
      await db.update(orders).set({ status: "rider_searching" as any, updatedAt: new Date() }).where(eq(orders.id, orderId));
      return res.status(201).json({ delivery, offeredRiders: nearest.length });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      if (err.code === "23505" && err.constraint === "idx_deliveries_one_active_order") {
        return res.status(409).json({ message: "Rider dispatch has already started for this order" });
      }
      return res.status(500).json({ message: "Server error" });
    }
  });

  async function acceptDeliveryRequest(req: Request, res: Response) {
    const user = (req as any).user;
    try {
      const result = await db.transaction(async (tx) => {
        const requestId = param(req, "id");
        await tx.execute(sql`SELECT id FROM delivery_requests WHERE id = ${requestId} FOR UPDATE`);
        await tx.execute(sql`SELECT user_id FROM delivery_riders WHERE user_id = ${user.id} FOR UPDATE`);
        const [riderProfile] = await tx.select().from(deliveryRiders)
          .where(eq(deliveryRiders.userId, user.id)).limit(1);
        if (!riderProfile || riderProfile.verificationStatus !== "verified" || !riderProfile.isOnline || !riderProfile.isAvailable) {
          throw new Error("RIDER_NOT_READY");
        }
        const [request] = await tx.select().from(deliveryRequests)
          .where(and(eq(deliveryRequests.id, requestId), eq(deliveryRequests.riderId, user.id))).limit(1);
        if (!request) throw new Error("OFFER_NOT_FOUND");
        if (!isDeliveryOfferAcceptable(request)) {
          if (request.status === "offered") await tx.update(deliveryRequests).set({ status: "expired", respondedAt: new Date() }).where(eq(deliveryRequests.id, request.id));
          throw new Error("OFFER_EXPIRED");
        }
        const [activeForRider] = await tx.select({ id: deliveries.id }).from(deliveries)
          .where(and(eq(deliveries.riderId, user.id), inArray(deliveries.status, ["assigned", "picked_up", "in_transit"]))).limit(1);
        if (activeForRider) throw new Error("RIDER_BUSY");
        await tx.execute(sql`SELECT id FROM deliveries WHERE id = ${request.deliveryId} FOR UPDATE`);
        const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, request.deliveryId)).limit(1);
        if (!delivery || delivery.status !== "searching" || delivery.riderId) throw new Error("DELIVERY_ASSIGNED");
        await tx.update(deliveryRequests).set({ status: "cancelled", respondedAt: new Date() })
          .where(and(eq(deliveryRequests.deliveryId, delivery.id), eq(deliveryRequests.status, "offered")));
        await tx.update(deliveryRequests).set({ status: "cancelled", respondedAt: new Date() })
          .where(and(eq(deliveryRequests.riderId, user.id), eq(deliveryRequests.status, "offered")));
        const [acceptedRequest] = await tx.update(deliveryRequests).set({ status: "accepted", respondedAt: new Date() }).where(eq(deliveryRequests.id, request.id)).returning();
        const [updatedDelivery] = await tx.update(deliveries).set({ riderId: user.id, status: "assigned", acceptedAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id)).returning();
        const [updatedOrder] = await tx.update(orders).set({ status: "rider_assigned" as any, riderId: user.id, updatedAt: new Date() }).where(eq(orders.id, delivery.orderId)).returning();
        await tx.update(deliveryRiders).set({ isAvailable: false, updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id));
        return { request: acceptedRequest, delivery: updatedDelivery, order: updatedOrder };
      });
      await addTracking(result.delivery.orderId, "rider_assigned", "Rider assigned", `${user.name} accepted the delivery.`, user, { deliveryId: result.delivery.id });
      await notifyOrderParties(result.order, "Rider Assigned", `${user.name} has accepted the delivery.`, "delivery");
      return res.json(result);
    } catch (err: any) {
      if (err.message === "OFFER_NOT_FOUND") return res.status(404).json({ message: "Delivery offer not found" });
      if (err.message === "OFFER_EXPIRED") return res.status(410).json({ message: "This delivery offer has expired or was already answered" });
      if (err.message === "DELIVERY_ASSIGNED") return res.status(409).json({ message: "Another rider already accepted this delivery" });
      if (err.message === "RIDER_BUSY") return res.status(409).json({ message: "Complete your active delivery before accepting another one" });
      if (err.message === "RIDER_NOT_READY") return res.status(403).json({ message: "You must be verified, online, and available before accepting a delivery" });
      console.error(err);
      return res.status(500).json({ message: "Unable to accept delivery" });
    }
  }

  app.post("/api/delivery/requests/:id/accept", requireAuth, requireRole("delivery_rider"), acceptDeliveryRequest);
  app.post("/api/delivery-requests/:id/accept", requireAuth, requireRole("delivery_rider"), acceptDeliveryRequest);

  async function declineDeliveryRequest(req: Request, res: Response) {
    const user = (req as any).user;
    const [request] = await db.select().from(deliveryRequests)
      .where(and(eq(deliveryRequests.id, param(req, "id")), eq(deliveryRequests.riderId, user.id))).limit(1);
    if (!request || request.status !== "offered") return res.status(404).json({ message: "Delivery offer not available" });
    const [declined] = await db.update(deliveryRequests).set({ status: "cancelled", respondedAt: new Date() })
      .where(and(eq(deliveryRequests.id, request.id), eq(deliveryRequests.status, "offered"))).returning();
    if (!declined) return res.status(409).json({ message: "Delivery offer was already answered" });
    return res.json({ request: declined });
  }

  app.post("/api/delivery/requests/:id/decline", requireAuth, requireRole("delivery_rider"), declineDeliveryRequest);
  app.post("/api/delivery-requests/:id/decline", requireAuth, requireRole("delivery_rider"), declineDeliveryRequest);

  app.put("/api/delivery/:id/status", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { status } = z.object({ status: z.enum(["picked_up", "in_transit", "delivered", "failed", "cancelled"]) }).parse(req.body);
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, param(req, "id"))).limit(1);
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });
    if (delivery.riderId !== user.id) return res.status(403).json({ message: "Forbidden" });
    if (!canChangeDeliveryStatus(user.role, delivery.status, status)) {
      const message = ["picked_up", "delivered"].includes(status)
        ? `${status === "picked_up" ? "Pickup" : "Delivery"} must be confirmed with the one-time QR code.`
        : "That delivery status change is not allowed.";
      return res.status(409).json({ message });
    }
    const extra: any = { status, updatedAt: new Date() };
    const [updated] = await db.update(deliveries).set(extra).where(eq(deliveries.id, delivery.id)).returning();
    if (status === "in_transit") await db.update(orders).set({ status: "on_the_way" as any, updatedAt: new Date() }).where(eq(orders.id, delivery.orderId));
    await addTracking(delivery.orderId, status, status === "in_transit" ? "Delivery on the way" : "Delivery issue reported", status === "in_transit" ? "The rider is travelling to the delivery address." : "The rider reported a delivery issue for support review.", user, { deliveryId: delivery.id });
    return res.json(updated);
  });

  app.get("/api/admin/riders", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select({ rider: deliveryRiders, user: users }).from(deliveryRiders).innerJoin(users, eq(deliveryRiders.userId, users.id)).orderBy(desc(deliveryRiders.createdAt));
    return res.json(rows.map(r => ({ ...r.rider, user: safeUser(r.user) })));
  });

  app.put("/api/admin/riders/:userId/verify", requireAuth, requireRole("admin"), requireAdminPermission("verification.manage"), async (req: Request, res: Response) => {
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
  app.get("/api/support/tickets", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(supportTickets).where(eq(supportTickets.userId, user.id)).orderBy(desc(supportTickets.createdAt)).limit(100);
    return res.json(rows);
  });

  app.post("/api/support/tickets", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
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

  app.get("/api/admin/support/tickets", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(200);
    return res.json(rows);
  });

  app.put("/api/admin/support/tickets/:id", requireAuth, requireRole("admin"), requireAdminPermission("support.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      const { status } = z.object({ status: z.enum(["open", "in_progress", "resolved", "closed"]) }).parse(req.body);
      const [ticket] = await db.update(supportTickets).set({ status, updatedAt: new Date() }).where(eq(supportTickets.id, param(req, "id"))).returning();
      if (!ticket) return res.status(404).json({ message: "Support ticket not found" });
      await audit(admin.id, `support.${status}`, "support_ticket", ticket.id);
      if (ticket.userId) await notifyUser(ticket.userId, "support", "Support ticket updated", `Your support ticket is now ${status.replace(/_/g, " ")}.`, "/support", { ticketId: ticket.id });
      return res.json(ticket);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Invalid support status" });
      return res.status(500).json({ message: "Support ticket update failed" });
    }
  });

  app.get("/api/admin/returns", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select({ request: returnRequests, orderTotal: orders.total, orderStatus: orders.status, customer: users })
      .from(returnRequests)
      .innerJoin(orders, eq(returnRequests.orderId, orders.id))
      .innerJoin(users, eq(returnRequests.userId, users.id))
      .orderBy(desc(returnRequests.createdAt));
    return res.json(rows.map(({ request, orderTotal, orderStatus, customer }) => ({ ...request, orderTotal, orderStatus, customer: safeUser(customer) })));
  });

  app.put("/api/admin/returns/:id", requireAuth, requireRole("admin"), requireAdminPermission("support.manage"), async (req: Request, res: Response) => {
    try {
      const admin = (req as any).user;
      const { status, resolution } = z.object({ status: z.enum(["reviewing", "approved", "rejected", "refunded", "closed"]), resolution: z.string().trim().min(3).max(2000) }).parse(req.body);
      const [request] = await db.update(returnRequests).set({ status, resolution, updatedAt: new Date() }).where(eq(returnRequests.id, param(req, "id"))).returning();
      if (!request) return res.status(404).json({ message: "Return request not found" });
      await audit(admin.id, `return.${status}`, "return_request", request.id, { orderId: request.orderId, resolution });
      await notifyUser(request.userId, "return", "Return request updated", `Your ${request.requestType} request is now ${status}.`, "/returns", { returnRequestId: request.id });
      return res.json(request);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0]?.message || "Invalid return update" });
      return res.status(500).json({ message: "Return request update failed" });
    }
  });

  app.get("/api/admin/audit-logs", requireAuth, requireRole("admin"), requireAdminPermission("audit.read"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(500);
    return res.json(rows);
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

  app.get("/api/conversations", requireAuth, requireRole("user", "vendor", "service_provider", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = await db.select().from(messages).where(eq(messages.senderId, user.id)).orderBy(desc(messages.createdAt)).limit(50);
    return res.json(rows);
  });


  // ────────────────────────────────────────────────────────────────
  // END-TO-END ORDER TRACKING, QR VERIFICATION, DISPATCH & ESCROW
  // ────────────────────────────────────────────────────────────────

  app.get("/api/orders/:id/tracking", requireAuth, requireRole("user", "vendor", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const parties = await getOrderParties(order);
    const allowed = order.userId === user.id || order.riderId === user.id || parties.vendorIds.includes(user.id);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    const events = await db.select().from(orderTrackingEvents).where(eq(orderTrackingEvents.orderId, orderId)).orderBy(desc(orderTrackingEvents.createdAt));
    const qrs = await db.select().from(orderQrCodes).where(eq(orderQrCodes.orderId, orderId)).orderBy(desc(orderQrCodes.createdAt));
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId)).orderBy(desc(deliveries.createdAt)).limit(1);
    const latestRiderLocation = delivery?.riderId ? await db.select().from(riderLocations).where(and(eq(riderLocations.riderId, delivery.riderId), eq(riderLocations.deliveryId, delivery.id))).orderBy(desc(riderLocations.createdAt)).limit(1) : [];
    const visibleQrs = user.role === "user"
        ? qrs.filter((qr) => qr.purpose === "delivery")
        : user.role === "vendor"
          ? qrs.filter((qr) => qr.purpose === "pickup")
          : [];
    const visibleOrder = safeOrder(order);
    const riderLocation = latestRiderLocation[0] || null;
    const headingToDropoff = ["picked_up", "on_the_way", "in_transit"].includes(delivery?.status || order.status);
    const destinationLatitude = headingToDropoff ? delivery?.dropoffLatitude : delivery?.pickupLatitude;
    const destinationLongitude = headingToDropoff ? delivery?.dropoffLongitude : delivery?.pickupLongitude;
    const remainingDistanceKm = riderLocation
      ? distanceKm(riderLocation.latitude, riderLocation.longitude, destinationLatitude, destinationLongitude)
      : null;
    const safeDistanceKm = remainingDistanceKm != null && remainingDistanceKm < 999999 ? Math.round(remainingDistanceKm * 10) / 10 : null;
    const lastUpdatedAt = riderLocation?.createdAt || null;
    return res.json({
      order: visibleOrder,
      events,
      qrs: visibleQrs,
      delivery: delivery || null,
      riderLocation,
      progress: {
        headingTo: headingToDropoff ? "dropoff" : "pickup",
        remainingDistanceKm: safeDistanceKm,
        etaMinutes: safeDistanceKm == null ? null : estimateDeliveryEtaMinutes(safeDistanceKm, riderLocation?.speed),
        lastUpdatedAt,
        isStale: !lastUpdatedAt || Date.now() - new Date(lastUpdatedAt).getTime() > 60_000,
      },
    });
  });

  app.post("/api/orders/:id/confirm-payment", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    try {
      if (process.env.WALLET_PAYMENTS_ENABLED !== "true") return res.status(503).json({ message: "Wallet payments are not available yet" });
      const user = (req as any).user;
      const orderId = param(req, "id");
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
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

  app.post("/api/orders/:id/confirm-vendor", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
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

  app.post("/api/orders/:id/ready-for-pickup", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
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

  app.post("/api/orders/:id/dispatch-rider", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const orderId = param(req, "id");
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const parties = await getOrderParties(order);
      if (!parties.vendorIds.includes(user.id)) return res.status(403).json({ message: "Forbidden" });
      await ensureVendorFulfillments(order);
      const fulfillments = await db.select().from(orderVendorFulfillments).where(eq(orderVendorFulfillments.orderId, order.id));
      if (fulfillments.length === 0 || fulfillments.some((row) => row.status !== "ready_for_pickup")) {
        return res.status(409).json({ message: "Every seller must mark their items ready before dispatching a rider." });
      }
      const [existingDelivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, order.id)).orderBy(desc(deliveries.createdAt)).limit(1);
      if (existingDelivery && !["failed", "cancelled"].includes(existingDelivery.status)) {
        return res.status(409).json({ message: "Rider dispatch has already started for this order", delivery: existingDelivery });
      }
      const body = z.object({ pickupAddress: z.string().optional(), pickupLatitude: z.number().min(-90).max(90).optional(), pickupLongitude: z.number().min(-180).max(180).optional() }).refine((value) => (value.pickupLatitude == null) === (value.pickupLongitude == null), { message: "Pickup latitude and longitude must be provided together", path: ["pickupLatitude"] }).parse(req.body || {});
      const pickupAddress = body.pickupAddress || user.area || user.address || user.city || "Vendor location";
      const pickupLatitude = body.pickupLatitude ?? user.latitude ?? null;
      const pickupLongitude = body.pickupLongitude ?? user.longitude ?? null;
      const [delivery] = await db.insert(deliveries).values({
        orderId: order.id,
        pickupAddress,
        pickupLatitude,
        pickupLongitude,
        dropoffAddress: `${order.address}, ${order.city}`,
        dropoffLatitude: (order as any).deliveryLatitude,
        dropoffLongitude: (order as any).deliveryLongitude,
        deliveryFee: order.shipping ?? 0,
        status: "searching",
      }).returning();
      const riders = await db.select().from(deliveryRiders).where(and(eq(deliveryRiders.isOnline, true), eq(deliveryRiders.isAvailable, true), eq(deliveryRiders.verificationStatus, "verified")));
      const nearest = riders.map(r => ({ ...r, distance: distanceKm(r.latitude, r.longitude, pickupLatitude, pickupLongitude) })).sort((a, b) => a.distance - b.distance).slice(0, 5);
      for (const rider of nearest) {
        await db.insert(deliveryRequests).values({ deliveryId: delivery.id, riderId: rider.userId, distanceKm: rider.distance, status: "offered", expiresAt: new Date(Date.now() + 60_000) });
        await notifyUser(rider.userId, "delivery", "New Delivery Request", `Pickup: ${pickupAddress}. Fee: D ${delivery.deliveryFee.toLocaleString()}`, "/(rider)", { deliveryId: delivery.id, orderId: order.id });
      }
      const [updated] = await db.update(orders).set({ status: "searching_rider" as any, fulfillmentType: "delivery", updatedAt: new Date() }).where(eq(orders.id, order.id)).returning();
      await addTracking(order.id, "searching_rider", "Searching for rider", `${nearest.length} riders were notified.`, user, { deliveryId: delivery.id, offeredRiders: nearest.length });
      return res.status(201).json({ order: updated, delivery, offeredRiders: nearest.length });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      if (err.code === "23505" && err.constraint === "idx_deliveries_one_active_order") {
        return res.status(409).json({ message: "Rider dispatch has already started for this order" });
      }
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/orders/:id/confirm-pickup-qr", requireAuth, requireRole("vendor", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
    const [orderBefore] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!orderBefore) return res.status(404).json({ message: "Order not found" });
    const parties = await getOrderParties(orderBefore);
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId)).orderBy(desc(deliveries.createdAt)).limit(1);
    if (!delivery?.riderId || delivery.status !== "assigned") return res.status(409).json({ message: "A rider must be assigned before pickup can be verified" });
    if (!canVerifyOrderQr({
      actorId: user.id,
      actorRole: user.role,
      purpose: "pickup",
      orderUserId: orderBefore.userId,
      orderRiderId: orderBefore.riderId,
      deliveryRiderId: delivery?.riderId,
      vendorIds: parties.vendorIds,
    })) return res.status(403).json({ message: "Only a seller or the assigned rider can confirm this pickup" });
    const [qr] = await db.select().from(orderQrCodes).where(and(eq(orderQrCodes.orderId, orderId), eq(orderQrCodes.code, code), eq(orderQrCodes.purpose, "pickup"), eq(orderQrCodes.status, "active"))).limit(1);
    if (!qr) return res.status(400).json({ message: "Invalid or expired pickup QR code" });
    const [consumedQr] = await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: new Date(), status: "used" }).where(and(eq(orderQrCodes.id, qr.id), eq(orderQrCodes.status, "active"))).returning();
    if (!consumedQr) return res.status(409).json({ message: "This pickup code was already used" });
    const [order] = await db.update(orders).set({ status: "picked_up" as any, pickupConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    if (delivery) await db.update(deliveries).set({ status: "picked_up", pickedUpAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
    await addTracking(orderId, "picked_up", "Order picked up", "QR verification confirmed rider/vendor handover.", user, { qrId: qr.id });
    await notifyOrderParties(order, "Order Picked Up", "Your order has been picked up by the rider.", "delivery");
    return res.json({ order, verified: true });
  });

  app.post("/api/orders/:id/confirm-delivery-qr", requireAuth, requireRole("user", "delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
    const [orderBefore] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!orderBefore) return res.status(404).json({ message: "Order not found" });
    const [deliveryBefore] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId)).orderBy(desc(deliveries.createdAt)).limit(1);
    if (!canVerifyOrderQr({ actorId: user.id, actorRole: user.role, purpose: "delivery", orderUserId: orderBefore.userId, orderRiderId: orderBefore.riderId, deliveryRiderId: deliveryBefore?.riderId })) return res.status(403).json({ message: "Only the shopper or assigned rider can confirm this delivery" });
    if (!deliveryBefore || !["picked_up", "in_transit"].includes(deliveryBefore.status)) return res.status(409).json({ message: "Pickup must be confirmed before delivery" });
    const [qr] = await db.select().from(orderQrCodes).where(and(eq(orderQrCodes.orderId, orderId), eq(orderQrCodes.code, code), eq(orderQrCodes.purpose, "delivery"), eq(orderQrCodes.status, "active"))).limit(1);
    if (!qr) return res.status(400).json({ message: "Invalid or expired delivery QR code" });
    const [consumedQr] = await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: new Date(), status: "used" }).where(and(eq(orderQrCodes.id, qr.id), eq(orderQrCodes.status, "active"))).returning();
    if (!consumedQr) return res.status(409).json({ message: "This delivery code was already used" });
    const [order] = await db.update(orders).set({ status: "delivered" as any, deliveryConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId)).orderBy(desc(deliveries.createdAt)).limit(1);
    if (delivery) await db.update(deliveries).set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
    if (delivery?.riderId) await db.update(deliveryRiders).set({ isAvailable: true, completedDeliveries: sql`${deliveryRiders.completedDeliveries} + 1`, updatedAt: new Date() }).where(eq(deliveryRiders.userId, delivery.riderId));
    await addTracking(orderId, "delivered", "Order delivered", "Shopper/rider QR verification confirmed delivery.", user, { qrId: qr.id });
    await notifyOrderParties(order, "Order Delivered", "Delivery has been verified. Releasing payment now.", "delivery");
    const released = await releaseEscrowForOrder(order, user);
    return res.json({ order, delivered: true, settlement: released });
  });



  app.post("/api/orders/verify-qr", requireAuth, requireRole("user", "vendor", "delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { code } = z.object({ code: z.string().min(6) }).parse(req.body);
      const [qr] = await db.select().from(orderQrCodes).where(and(eq(orderQrCodes.code, code.trim()), eq(orderQrCodes.status, "active"))).limit(1);
      if (!qr) return res.status(400).json({ message: "Invalid, expired, or already used QR code" });
      const [orderBefore] = await db.select().from(orders).where(eq(orders.id, qr.orderId)).limit(1);
      if (!orderBefore) return res.status(404).json({ message: "Order not found" });
      const parties = await getOrderParties(orderBefore);
      const [deliveryBefore] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderBefore.id)).orderBy(desc(deliveries.createdAt)).limit(1);

      if (qr.purpose === "pickup") {
        if (!deliveryBefore?.riderId || deliveryBefore.status !== "assigned") return res.status(409).json({ message: "A rider must be assigned before pickup can be verified" });
        const allowed = canVerifyOrderQr({ actorId: user.id, actorRole: user.role, purpose: "pickup", orderUserId: orderBefore.userId, orderRiderId: orderBefore.riderId, deliveryRiderId: deliveryBefore?.riderId, vendorIds: parties.vendorIds });
        if (!allowed) return res.status(403).json({ message: "Only the vendor or assigned rider can confirm pickup" });
        const [consumedQr] = await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: new Date(), status: "used" }).where(and(eq(orderQrCodes.id, qr.id), eq(orderQrCodes.status, "active"))).returning();
        if (!consumedQr) return res.status(409).json({ message: "This pickup code was already used" });
        const [order] = await db.update(orders).set({ status: "picked_up" as any, pickupConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderBefore.id)).returning();
        if (deliveryBefore) await db.update(deliveries).set({ status: "picked_up", pickedUpAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, deliveryBefore.id));
        await addTracking(order.id, "picked_up", "Order picked up", "QR verification confirmed vendor-to-rider handover.", user, { qrId: qr.id });
        await notifyOrderParties(order, "Order Picked Up", "Your order has been collected by the rider.", "delivery");
        return res.json({ verified: true, purpose: "pickup", message: "Pickup confirmed", order });
      }

      if (qr.purpose === "delivery") {
        const allowed = canVerifyOrderQr({ actorId: user.id, actorRole: user.role, purpose: "delivery", orderUserId: orderBefore.userId, orderRiderId: orderBefore.riderId, deliveryRiderId: deliveryBefore?.riderId });
        if (!allowed) return res.status(403).json({ message: "Only the shopper or assigned rider can confirm delivery" });
        if (!deliveryBefore || !["picked_up", "in_transit"].includes(deliveryBefore.status)) return res.status(409).json({ message: "Pickup must be confirmed before delivery" });
        const [consumedQr] = await db.update(orderQrCodes).set({ usedBy: user.id, usedAt: new Date(), status: "used" }).where(and(eq(orderQrCodes.id, qr.id), eq(orderQrCodes.status, "active"))).returning();
        if (!consumedQr) return res.status(409).json({ message: "This delivery code was already used" });
        const [order] = await db.update(orders).set({ status: "delivered" as any, deliveryConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderBefore.id)).returning();
        if (deliveryBefore) await db.update(deliveries).set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, deliveryBefore.id));
        if (deliveryBefore?.riderId) await db.update(deliveryRiders).set({ isAvailable: true, completedDeliveries: sql`${deliveryRiders.completedDeliveries} + 1`, updatedAt: new Date() }).where(eq(deliveryRiders.userId, deliveryBefore.riderId));
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

  app.post("/api/orders/:id/complete-and-release-payment", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const orderId = param(req, "id");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
    if (!canReleaseDeliveryPayment(order)) return res.status(409).json({ message: "Delivery must be verified with the one-time delivery code before payment can be released" });
    const result = await releaseEscrowForOrder(order, user);
    return res.json(result);
  });

  app.get("/api/rider/dashboard", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    const user = (req as any).user;
    const profile = await ensureRiderProfile(user);
    const offeredRows = await db.select().from(deliveryRequests).where(and(eq(deliveryRequests.riderId, user.id), eq(deliveryRequests.status, "offered"))).orderBy(desc(deliveryRequests.createdAt)).limit(30);
    const expiredRows = offeredRows.filter((offer) => !isDeliveryOfferAcceptable(offer));
    for (const offer of expiredRows) await db.update(deliveryRequests).set({ status: "expired", respondedAt: new Date() }).where(eq(deliveryRequests.id, offer.id));
    const offers = await Promise.all(offeredRows.filter((offer) => isDeliveryOfferAcceptable(offer)).map(async (offer) => {
      const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, offer.deliveryId)).limit(1);
      return { ...offer, delivery: delivery ? {
        id: delivery.id,
        pickupAddress: delivery.pickupAddress,
        pickupLatitude: delivery.pickupLatitude,
        pickupLongitude: delivery.pickupLongitude,
        deliveryFee: delivery.deliveryFee,
      } : null };
    }));
    const activeDeliveries = await db.select().from(deliveries).where(and(eq(deliveries.riderId, user.id), inArray(deliveries.status, ["assigned", "picked_up", "in_transit"]))).orderBy(desc(deliveries.createdAt)).limit(30);
    const history = await db.select().from(deliveries).where(eq(deliveries.riderId, user.id)).orderBy(desc(deliveries.createdAt)).limit(50);
    const earningRows = await db.select().from(riderEarnings).where(eq(riderEarnings.riderId, user.id)).orderBy(desc(riderEarnings.createdAt)).limit(50);
    const totalEarnings = earningRows.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const completion = await computeProfileCompletion(user);
    return res.json({ profile: safeRiderProfile(profile), offers, activeDeliveries, history, earnings: earningRows, totalEarnings, completion, metrics: { completed: profile?.completedDeliveries || 0, rating: profile?.rating || 0 } });
  });

  app.post("/api/rider/location", requireAuth, requireRole("delivery_rider"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { latitude, longitude, accuracy, heading, speed, deliveryId, recordedAt } = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().nonnegative().optional(),
        heading: z.number().min(0).max(360).optional(),
        speed: z.number().optional(),
        deliveryId: z.string().optional(),
        recordedAt: z.string().datetime().optional(),
      }).parse(req.body);
      if (deliveryId) {
        const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1);
        if (!canRiderAccessDelivery(user.id, delivery)) return res.status(403).json({ message: "Location can only be shared for your active delivery" });
      }
      const locationTime = normalizeRecordedLocationTime(recordedAt);
      if (!locationTime) return res.status(400).json({ message: "Location timestamp is outside the accepted replay window" });
      const [loc] = await db.insert(riderLocations).values({ riderId: user.id, deliveryId, latitude, longitude, accuracy, heading, speed, createdAt: locationTime }).returning();
      await db.update(deliveryRiders).set({ latitude, longitude, updatedAt: new Date() }).where(eq(deliveryRiders.userId, user.id));
      emitRealtime("rider:location", { riderId: user.id, deliveryId, latitude, longitude, accuracy, heading, speed, createdAt: loc.createdAt }, deliveryId ? [`delivery:${deliveryId}`, "role:admin"] : ["role:admin"]);
      return res.status(201).json(loc);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      return res.status(500).json({ message: "Location update failed" });
    }
  });

  app.get("/api/admin/orders/live", requireAuth, requireRole("admin"), requireAdminPermission("delivery.manage"), async (_req: Request, res: Response) => {
    const liveOrders = await db.select().from(orders).orderBy(desc(orders.updatedAt)).limit(100);
    const liveDeliveries = await db.select().from(deliveries).orderBy(desc(deliveries.updatedAt)).limit(100);
    const recentEvents = await db.select().from(orderTrackingEvents).orderBy(desc(orderTrackingEvents.createdAt)).limit(100);
    const recentLocations = await db.select().from(riderLocations).orderBy(desc(riderLocations.createdAt)).limit(500);
    const latestByDelivery = new Map<string, typeof riderLocations.$inferSelect>();
    for (const location of recentLocations) {
      if (location.deliveryId && !latestByDelivery.has(location.deliveryId)) latestByDelivery.set(location.deliveryId, location);
    }
    return res.json({ orders: liveOrders, deliveries: liveDeliveries, events: recentEvents, locations: [...latestByDelivery.values()] });
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
        const audience = parseClientAudience(socket.handshake?.auth?.audience || socket.handshake?.headers?.["x-mansamart-app"]);
        const session = token ? await getSession(token) : null;
        if (!session || !audience || session.session.audience !== audience || !roleAllowedForAudience(audience, session.user.role)) {
          return next(new Error("Unauthorized realtime connection"));
        }
        socket.data.user = safeSocketUser(session.user);
        socket.data.audience = audience;
        socket.join(`user:${session.user.id}`);
        socket.join(`role:${session.user.role}`);
        next();
      } catch (error: any) {
        next(error);
      }
    });

    io.on("connection", (socket: any) => {
      socket.on("order:join", async (orderId: string) => {
        if (!orderId) return;
        const user = socket.data.user;
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) return socket.emit("room:error", { room: "order", message: "Order not found" });
        const parties = await getOrderParties(order);
        const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId)).orderBy(desc(deliveries.createdAt)).limit(1);
        const allowed = user.role === "admin" || order.userId === user.id || parties.vendorIds.includes(user.id) || order.riderId === user.id || delivery?.riderId === user.id;
        if (!allowed) return socket.emit("room:error", { room: "order", message: "Forbidden" });
        socket.join(`order:${orderId}`);
      });
      socket.on("delivery:join", async (deliveryId: string) => {
        if (!deliveryId) return;
        const user = socket.data.user;
        const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1);
        if (!delivery) return socket.emit("room:error", { room: "delivery", message: "Delivery not found" });
        const [order] = await db.select().from(orders).where(eq(orders.id, delivery.orderId)).limit(1);
        if (!order) return socket.emit("room:error", { room: "delivery", message: "Order not found" });
        const parties = await getOrderParties(order);
        const allowed = user.role === "admin" || order.userId === user.id || parties.vendorIds.includes(user.id) || delivery.riderId === user.id;
        if (!allowed) return socket.emit("room:error", { room: "delivery", message: "Forbidden" });
        socket.join(`delivery:${deliveryId}`);
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
