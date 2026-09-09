export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type CartOptionValue = string | number | boolean | null;

function cleanSelection(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned || undefined;
}

export function normalizeCartSelection(input: {
  selectedColor?: string | null;
  selectedSize?: string | null;
  selectedVariant?: string | null;
  selectedOptions?: Record<string, CartOptionValue>;
}) {
  const selectedColor = cleanSelection(input.selectedColor);
  const selectedSize = cleanSelection(input.selectedSize);
  const selectedVariant = cleanSelection(input.selectedVariant);
  const options: Record<string, CartOptionValue> = {};

  for (const [key, value] of Object.entries(input.selectedOptions || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const cleanKey = key.trim();
    if (!cleanKey || value === undefined || value === "") continue;
    options[cleanKey] = typeof value === "string" ? value.trim() : value;
  }
  if (selectedColor) options.color = selectedColor;
  if (selectedSize) options.size = selectedSize;
  if (selectedVariant) options.variant = selectedVariant;

  const selectedOptions = Object.fromEntries(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)));
  return {
    selectedColor,
    selectedSize,
    selectedVariant,
    selectedOptions,
    optionKey: JSON.stringify(selectedOptions),
  };
}

type BookingAccess = {
  userId: string | null;
  providerId: string | null;
  status: string;
};

const providerTransitions: Readonly<Record<string, readonly BookingStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canUpdateBookingStatus(
  actor: { id: string; role: string },
  booking: BookingAccess,
  nextStatus: BookingStatus,
): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "user") {
    return booking.userId === actor.id
      && nextStatus === "cancelled"
      && ["pending", "confirmed"].includes(booking.status);
  }
  if (actor.role === "service_provider" && booking.providerId === actor.id) {
    return (providerTransitions[booking.status] || []).includes(nextStatus);
  }
  return false;
}

export function hasVerifiedReviewHistory(
  targetType: "product" | "service",
  targetId: string,
  orderHistory: Array<{ status: string; items: unknown }>,
  bookingHistory: Array<{ status: string; serviceId: string | null }>,
): boolean {
  if (targetType === "service") {
    return bookingHistory.some((booking) =>
      booking.serviceId === targetId && booking.status === "completed");
  }

  return orderHistory.some((order) => {
    if (!["delivered", "completed"].includes(order.status)) return false;
    if (!Array.isArray(order.items)) return false;
    return order.items.some((item) => {
      if (!item || typeof item !== "object") return false;
      return String((item as { productId?: unknown }).productId || "") === targetId;
    });
  });
}

export function isOrderReturnEligible(
  order: { status: string; updatedAt: Date | string },
  now = new Date(),
  windowDays = 7,
): boolean {
  if (!["delivered", "completed"].includes(order.status)) return false;
  const updatedAt = new Date(order.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) return false;
  const ageMs = now.getTime() - updatedAt.getTime();
  return ageMs >= 0 && ageMs <= windowDays * 24 * 60 * 60 * 1000;
}
