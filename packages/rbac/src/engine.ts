import { ForbiddenError, type UserRole } from '@partners/core';
import { ROLE_PERMISSIONS } from './matrix';
import type { Permission } from './permissions';

/**
 * Who is asking. Built on the server from the session and the database row -
 * never from a header, a token claim or a request body.
 */
export interface Principal {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(principal: Principal, permission: Permission): boolean {
  if (!principal.isActive) return false;
  return permissionsFor(principal.role).includes(permission);
}

export function canAny(principal: Principal, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(principal, permission));
}

/** Throws a 403 rather than returning false. Used at every write entry point. */
export function assertCan(principal: Principal, permission: Permission, context = {}): void {
  if (!can(principal, permission)) {
    throw new ForbiddenError('You do not have permission to do that.', {
      permission,
      role: principal.role,
      userId: principal.id,
      ...context,
    });
  }
}
