/**
 * `resource:action`. Every enforcement point - server action, route handler,
 * navigation - calls the same engine. The UI uses it to hide controls; the
 * server uses it to decide. A frontend check is never sufficient.
 */
export const PERMISSIONS = [
  /** See everything: dashboard, pipeline, partners, members, export. */
  'workspace:read',

  // Pipeline work
  'partner:write',
  'partner:archive',
  'contact:write',
  'activity:write',
  'deal:write',
  /** Move a deal between stages, including closing it WON or LOST. */
  'deal:move_stage',
  'membership:write',

  // Administration
  'tier:manage',
  'user:manage',
  'settings:manage',
  'data:import',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
