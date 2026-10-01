import type { NonAdminRole, UserRole } from "@mansamart/shared-types";

export const GENERAL_WEB_ROLES: readonly NonAdminRole[] = ["user", "vendor", "service_provider", "delivery_rider"];

export function roleCanUseGeneralWeb(role: UserRole): role is NonAdminRole {
  return GENERAL_WEB_ROLES.includes(role as NonAdminRole);
}

export function defaultWebPath(role: NonAdminRole): string {
  if (role === "vendor") return "/vendor";
  if (role === "service_provider") return "/provider";
  if (role === "delivery_rider") return "/rider";
  return "/account";
}

export function canUseCustomerCommerce(role: UserRole | null | undefined): boolean {
  return role === "user";
}

export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://mansamart.gm");
    return url.origin === "https://mansamart.gm" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function nextVendorStatus(status: string): string | null {
  return ({ pending: "confirmed", confirmed: "preparing", preparing: "ready_for_pickup" } as Record<string, string>)[status] || null;
}

export function nextBookingStatus(status: string): string | null {
  return ({ pending: "confirmed", confirmed: "in_progress", in_progress: "completed" } as Record<string, string>)[status] || null;
}
