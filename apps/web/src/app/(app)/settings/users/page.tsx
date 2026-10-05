import type { Metadata } from 'next';
import { clock, formatRelative, USER_ROLE_LABEL } from '@partners/core';
import { can } from '@partners/rbac';
import {
  Badge,
  PermissionDenied,
  PersonCell,
  Section,
  StatusPill,
  Table,
  TableScroller,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@partners/ui';
import { listUsers } from '@/features/users/queries';
import { requirePrincipalOrRedirect } from '@/server/session';
import { InviteUserButton, UserRowActions } from './user-controls';

export const metadata: Metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const principal = await requirePrincipalOrRedirect('/settings/users');
  if (!can(principal, 'user:manage')) return <PermissionDenied />;
  const users = await listUsers();
  const now = clock.now();

  return (
    <Section
      title="Users"
      description="AHN team only. People sign in with an emailed link - there are no passwords. Admins manage tiers, users, import and settings; members work the pipeline; viewers read."
      actions={<InviteUserButton />}
    >
      <TableScroller>
        <Table>
          <THead>
            <tr>
              <TH>Person</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Last sign-in</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {users.map((user) => (
              <TR key={user.id} className={user.isActive ? undefined : 'opacity-60'}>
                <TD>
                  <PersonCell name={user.name} role={user.email} />
                </TD>
                <TD>
                  <StatusPill descriptor={USER_ROLE_LABEL[user.role]} size="sm" dot={false} />
                </TD>
                <TD>
                  <Badge tone={user.isActive ? 'success' : 'muted'} size="sm">
                    {user.isActive ? 'Active' : 'Deactivated'}
                  </Badge>
                  {user.id === principal.id && (
                    <span className="text-muted ml-2 text-[12px]">You</span>
                  )}
                </TD>
                <TD className="text-muted text-[12.5px]">
                  {user.lastLoginAt ? (
                    formatRelative(user.lastLoginAt, now)
                  ) : (
                    <span className="text-warning-ink">Invited - not signed in yet</span>
                  )}
                </TD>
                <TD>
                  <UserRowActions
                    user={{
                      id: user.id,
                      name: user.name,
                      role: user.role,
                      isActive: user.isActive,
                      invited: user.lastLoginAt === null,
                    }}
                    isSelf={user.id === principal.id}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableScroller>
    </Section>
  );
}
