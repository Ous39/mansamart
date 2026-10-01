import type { NonAdminRole, UserRole } from "@mansamart/shared-types";

export const WEB_ROLES: readonly NonAdminRole[] = ["user", "vendor", "service_provider", "delivery_rider"];
export const BUSINESS_ROLES: readonly UserRole[] = ["vendor", "service_provider"];

export function webRouteForRole(role: NonAdminRole): string {
  return role === "user" ? "/account" : role === "vendor" ? "/vendor" : role === "service_provider" ? "/provider" : "/rider";
}

export function roleLabel(role: UserRole): string {
  return ({ user: "Customer", vendor: "Vendor", service_provider: "Service Provider", delivery_rider: "Delivery Rider", admin: "Administrator" })[role];
}

export function createTokenStore(key: string) {
  return {
    get: () => globalThis.localStorage?.getItem(key) ?? null,
    set: (token: string) => globalThis.localStorage?.setItem(key, token),
    clear: () => globalThis.localStorage?.removeItem(key),
  };
}
