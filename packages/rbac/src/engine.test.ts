import { describe, expect, it } from 'vitest';
import { USER_ROLES, type UserRole } from '@partners/core';
import { assertCan, can, type Principal } from './engine';
import { ROLE_PERMISSIONS } from './matrix';
import { navigationFor } from './navigation';
import { PERMISSIONS } from './permissions';

const principal = (role: UserRole, overrides: Partial<Principal> = {}): Principal => ({
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  role,
  isActive: true,
  ...overrides,
});

describe('can', () => {
  it('denies every permission to a deactivated user', () => {
    const user = principal('ADMIN', { isActive: false });
    for (const permission of PERMISSIONS) expect(can(user, permission)).toBe(false);
  });

  it('lets every role read', () => {
    for (const role of USER_ROLES) expect(can(principal(role), 'workspace:read')).toBe(true);
  });

  it('keeps a viewer read-only', () => {
    expect(ROLE_PERMISSIONS.VIEWER).toEqual(['workspace:read']);
    expect(can(principal('VIEWER'), 'deal:move_stage')).toBe(false);
    expect(() => assertCan(principal('VIEWER'), 'partner:write')).toThrow(/permission/);
  });

  it('lets a member work the pipeline but not administer it', () => {
    const member = principal('MEMBER');
    for (const permission of [
      'partner:write',
      'contact:write',
      'activity:write',
      'deal:write',
      'deal:move_stage',
      'membership:write',
    ] as const) {
      expect(can(member, permission)).toBe(true);
    }
    for (const permission of [
      'partner:archive',
      'tier:manage',
      'user:manage',
      'settings:manage',
      'data:import',
    ] as const) {
      expect(can(member, permission)).toBe(false);
    }
  });

  it('gives an admin everything', () => {
    for (const permission of PERMISSIONS) expect(can(principal('ADMIN'), permission)).toBe(true);
  });
});

describe('navigationFor', () => {
  const hrefs = (role: UserRole) =>
    navigationFor(principal(role)).flatMap((group) => group.items.map((item) => item.href));

  it('shows settings only to admins', () => {
    expect(hrefs('ADMIN')).toContain('/settings');
    expect(hrefs('MEMBER')).not.toContain('/settings');
    expect(hrefs('VIEWER')).not.toContain('/settings');
  });

  it('shows the four pipeline screens to everyone', () => {
    for (const role of USER_ROLES) {
      expect(hrefs(role)).toEqual(
        expect.arrayContaining(['/dashboard', '/pipeline', '/partners', '/members']),
      );
    }
  });
});
