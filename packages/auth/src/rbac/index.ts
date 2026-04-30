export const USER_ROLES = ['admin', 'operator', 'analyst', 'viewer'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

export function hasRequiredRole(role: string, allowedRoles: readonly string[]): boolean {
  return allowedRoles.includes(role);
}
