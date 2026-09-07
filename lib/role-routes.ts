export type AppRole = "user" | "vendor" | "service_provider" | "delivery_rider" | "admin";

export function normalizeRole(role?: string | null): AppRole {
  const value = String(role || "user").trim().toLowerCase();
  if (["shopper", "customer", "buyer", "user"].includes(value)) return "user";
  if (["provider", "service-provider", "service_provider", "service provider"].includes(value)) return "service_provider";
  if (["rider", "delivery-rider", "delivery_rider", "delivery rider"].includes(value)) return "delivery_rider";
  if (value === "vendor") return "vendor";
  if (value === "admin") return "admin";
  return "user";
}

export function getDefaultRouteForRole(role?: string | null): string {
  switch (normalizeRole(role)) {
    case "vendor": return "/(vendor)";
    case "service_provider": return "/(provider)";
    case "delivery_rider": return "/(rider)";
    case "admin": return "/(admin)";
    default: return "/(tabs)";
  }
}

export function getProfileRouteForRole(role?: string | null): string {
  switch (normalizeRole(role)) {
    case "vendor": return "/(vendor)/settings";
    case "service_provider": return "/(provider)/settings";
    case "delivery_rider": return "/(rider)/settings";
    case "admin": return "/(admin)";
    default: return "/(tabs)/profile";
  }
}

export function roleDisplayName(role?: string | null): string {
  switch (normalizeRole(role)) {
    case "vendor": return "Vendor";
    case "service_provider": return "Service Provider";
    case "delivery_rider": return "Rider";
    case "admin": return "Admin";
    default: return "Shopper";
  }
}
