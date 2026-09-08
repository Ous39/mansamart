export type AppRole = "user" | "vendor" | "service_provider" | "delivery_rider" | "admin";

/**
 * Normalize every role name used across older builds, forms, and API payloads.
 * The database still uses `user` for shopper accounts.
 */
export function normalizeRole(role?: string | null): AppRole {
  const value = String(role || "user").trim().toLowerCase();
  if (["shopper", "customer", "buyer", "user"].includes(value)) return "user";
  if (["provider", "service-provider", "service_provider", "service provider"].includes(value)) return "service_provider";
  if (["rider", "delivery-rider", "delivery_rider", "delivery rider"].includes(value)) return "delivery_rider";
  if (value === "vendor") return "vendor";
  if (value === "admin") return "admin";
  return "user";
}

/**
 * Send each authenticated role to its correct dashboard.
 */
export function getHomeRouteForRole(role?: string | null) {
  switch (normalizeRole(role)) {
    case "admin":
    case "vendor":
    case "service_provider":
    case "delivery_rider":
      return "/";
    case "user":
    default:
      return "/(tabs)";
  }
}

/**
 * Route to the profile/settings screen for each role.
 * Used by profile-completion reminders and protected role pages.
 */
export function getProfileRouteForRole(role?: string | null) {
  switch (normalizeRole(role)) {
    case "admin":
    case "vendor":
    case "service_provider":
    case "delivery_rider":
      return "/";
    case "user":
    default:
      return "/(tabs)/profile";
  }
}

export function displayRoleLabel(role?: string | null) {
  switch (normalizeRole(role)) {
    case "admin":
      return "Admin";
    case "vendor":
      return "Vendor";
    case "service_provider":
      return "Service Provider";
    case "delivery_rider":
      return "Rider";
    case "user":
    default:
      return "Shopper";
  }
}
