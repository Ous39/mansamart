export const VENDOR_FULFILLMENT_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "cancelled",
] as const;

export type VendorFulfillmentStatus = typeof VENDOR_FULFILLMENT_STATUSES[number];

const PAID_PAYMENT_STATES = new Set(["paid", "succeeded", "settled"]);

export function isBusinessVerified(profile: { verificationStatus?: string | null } | null | undefined) {
  return profile?.verificationStatus === "verified";
}

export function canVendorAdvanceFulfillment(
  current: string,
  next: VendorFulfillmentStatus,
  paymentStatus: string,
) {
  if (!PAID_PAYMENT_STATES.has(paymentStatus)) return false;
  return (
    (current === "pending" && next === "confirmed") ||
    (current === "confirmed" && next === "preparing") ||
    (current === "preparing" && next === "ready_for_pickup")
  );
}

export function deriveMarketplaceOrderStatus(
  currentOrderStatus: string,
  fulfillmentStatuses: string[],
) {
  if (fulfillmentStatuses.length === 0) return currentOrderStatus;
  if (fulfillmentStatuses.every((status) => status === "cancelled")) return "cancelled";
  const active = fulfillmentStatuses.filter((status) => status !== "cancelled");
  if (active.length === 0) return currentOrderStatus;
  if (active.every((status) => status === "ready_for_pickup")) return "ready_for_pickup";
  if (active.every((status) => status === "preparing" || status === "ready_for_pickup")) return "preparing";
  if (active.every((status) => ["confirmed", "preparing", "ready_for_pickup"].includes(status))) return "confirmed";
  return currentOrderStatus;
}

export function availablePayoutBalance(walletBalance: number, pendingPayoutAmounts: number[]) {
  const reserved = pendingPayoutAmounts.reduce((sum, amount) => sum + Math.max(0, Number(amount) || 0), 0);
  return Math.max(0, Math.floor(Number(walletBalance) || 0) - reserved);
}
