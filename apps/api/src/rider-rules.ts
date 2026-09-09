export const ACTIVE_DELIVERY_STATUSES = ["assigned", "picked_up", "in_transit"] as const;

export type RiderPresence = {
  isOnline: boolean;
  isAvailable: boolean;
};

export function isActiveDeliveryStatus(status?: string | null) {
  return ACTIVE_DELIVERY_STATUSES.includes(status as typeof ACTIVE_DELIVERY_STATUSES[number]);
}

export function isDeliveryOfferAcceptable(
  offer: { status?: string | null; expiresAt?: Date | string | null },
  now = new Date(),
) {
  if (offer.status !== "offered") return false;
  if (!offer.expiresAt) return true;
  const expiresAt = new Date(offer.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function resolveRiderPresence(input: {
  verificationStatus?: string | null;
  currentOnline: boolean;
  requestedOnline?: boolean;
  requestedAvailable?: boolean;
  hasActiveDelivery?: boolean;
}): { ok: true; presence: RiderPresence } | { ok: false; message: string } {
  const isOnline = input.requestedOnline ?? input.currentOnline;
  if (!isOnline) return { ok: true, presence: { isOnline: false, isAvailable: false } };
  if (input.verificationStatus !== "verified") {
    return { ok: false, message: "Your rider profile must be verified before you can go online." };
  }
  const requestedAvailable = input.requestedAvailable ?? true;
  return {
    ok: true,
    presence: {
      isOnline: true,
      isAvailable: requestedAvailable && !input.hasActiveDelivery,
    },
  };
}

export function canRiderAccessDelivery(
  riderId: string,
  delivery: { riderId?: string | null; status?: string | null } | null | undefined,
) {
  return !!delivery && delivery.riderId === riderId && isActiveDeliveryStatus(delivery.status);
}

export function canChangeDeliveryStatus(
  role: string,
  current: string,
  next: string,
) {
  if (["picked_up", "delivered"].includes(next)) return false;
  if (role === "admin") return ["in_transit", "failed", "cancelled"].includes(next);
  if (role !== "delivery_rider") return false;
  if (next === "in_transit") return current === "picked_up";
  if (next === "failed") return isActiveDeliveryStatus(current);
  return false;
}

export function canVerifyOrderQr(input: {
  actorId: string;
  actorRole: string;
  purpose: string;
  orderUserId?: string | null;
  orderRiderId?: string | null;
  deliveryRiderId?: string | null;
  vendorIds?: string[];
}) {
  if (input.actorRole === "admin") return true;
  const assignedRiderId = input.deliveryRiderId || input.orderRiderId;
  if (input.purpose === "pickup") {
    return assignedRiderId === input.actorId || (input.vendorIds || []).includes(input.actorId);
  }
  if (input.purpose === "delivery") {
    return input.orderUserId === input.actorId || assignedRiderId === input.actorId;
  }
  return false;
}

export function canReleaseDeliveryPayment(order: { deliveryConfirmedAt?: Date | string | null; status?: string | null }) {
  return !!order.deliveryConfirmedAt && ["delivered", "completed"].includes(order.status || "");
}
