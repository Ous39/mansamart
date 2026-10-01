export const ADMIN_STAFF_ROLES = ["super_admin", "operations_manager", "finance_officer", "verification_officer", "rider_coordinator", "support_agent", "content_moderator", "auditor"] as const;
export type AdminStaffRole = typeof ADMIN_STAFF_ROLES[number];

export const ADMIN_PERMISSIONS = ["dashboard.read", "users.read", "users.manage", "verification.manage", "orders.manage", "delivery.manage", "payments.read", "payments.refund", "payouts.manage", "support.manage", "content.manage", "notifications.manage", "reports.export", "settings.manage", "audit.read", "staff.manage"] as const;
export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<AdminStaffRole, AdminPermission[]> = {
  super_admin: [...ADMIN_PERMISSIONS],
  operations_manager: ["dashboard.read", "users.read", "verification.manage", "orders.manage", "delivery.manage", "support.manage", "notifications.manage", "reports.export"],
  finance_officer: ["dashboard.read", "users.read", "payments.read", "payments.refund", "payouts.manage", "reports.export", "audit.read"],
  verification_officer: ["dashboard.read", "users.read", "verification.manage", "audit.read"],
  rider_coordinator: ["dashboard.read", "users.read", "delivery.manage", "orders.manage", "support.manage"],
  support_agent: ["dashboard.read", "users.read", "orders.manage", "support.manage"],
  content_moderator: ["dashboard.read", "users.read", "content.manage", "notifications.manage"],
  auditor: ["dashboard.read", "users.read", "payments.read", "reports.export", "audit.read"],
};

export function permissionsForRole(role: AdminStaffRole, overrides: string[] = []): AdminPermission[] {
  if (role === "super_admin") return [...ADMIN_PERMISSIONS];
  return [...new Set([...ROLE_PERMISSIONS[role], ...overrides.filter((value): value is AdminPermission => ADMIN_PERMISSIONS.includes(value as AdminPermission))])];
}
export function hasAdminPermission(role: AdminStaffRole, overrides: string[], permission: AdminPermission): boolean {
  return permissionsForRole(role, overrides).includes(permission);
}
export function isSafePlatformSettingValue(value: unknown): boolean {
  if (["boolean", "number", "string"].includes(typeof value)) return true;
  return !!value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(value).length <= 10_000;
}
