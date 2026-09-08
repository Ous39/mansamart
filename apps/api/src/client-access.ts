export type ClientAudience = "customer" | "business" | "rider" | "web";

export const clientRoles: Readonly<Record<ClientAudience, readonly string[]>> = {
  customer: ["user"],
  business: ["vendor", "service_provider"],
  rider: ["delivery_rider"],
  web: ["user", "vendor", "service_provider", "delivery_rider"],
};

export function parseClientAudience(value?: string | null): ClientAudience | null {
  const normalized = String(value || "web").trim().toLowerCase();
  return normalized in clientRoles ? normalized as ClientAudience : null;
}

export function roleAllowedForAudience(audience: ClientAudience | null, role: string): boolean {
  return !!audience && clientRoles[audience].includes(role);
}
