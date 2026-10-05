import type { UserRole } from '@partners/core';
import { PERMISSIONS, type Permission } from './permissions';

/**
 * The grant matrix. Deny by default: a role holds exactly what is listed here
 * and nothing more.
 *
 * | Permission                        | ADMIN | MEMBER | VIEWER |
 * | --------------------------------- | ----- | ------ | ------ |
 * | See everything                    |   x   |   x    |   x    |
 * | Partners, contacts, deals, notes  |   x   |   x    |        |
 * | Move stage, close WON/LOST        |   x   |   x    |        |
 * | Edit memberships, mark paid       |   x   |   x    |        |
 * | Tiers, users, import, settings    |   x   |        |        |
 * | Archive a partner                 |   x   |        |        |
 */
const VIEWER: Permission[] = ['workspace:read'];

const MEMBER: Permission[] = [
  ...VIEWER,
  'partner:write',
  'contact:write',
  'activity:write',
  'deal:write',
  'deal:move_stage',
  'membership:write',
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: [...PERMISSIONS],
  MEMBER,
  VIEWER,
};
