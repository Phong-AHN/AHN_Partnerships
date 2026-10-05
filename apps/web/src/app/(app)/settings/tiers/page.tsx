import type { Metadata } from 'next';
import { can } from '@partners/rbac';
import {
  Badge,
  Empty,
  Mono,
  PermissionDenied,
  Section,
  Table,
  TableMessage,
  TableScroller,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@partners/ui';
import { money } from '@/components/domain';
import { listAllTiers } from '@/features/tiers/queries';
import { requirePrincipalOrRedirect } from '@/server/session';
import { EditTierButton, NewTierButton } from './tier-form';

export const metadata: Metadata = { title: 'Membership tiers' };
export const dynamic = 'force-dynamic';

export default async function TiersPage() {
  const principal = await requirePrincipalOrRedirect('/settings/tiers');
  if (!can(principal, 'tier:manage')) return <PermissionDenied />;
  const tiers = await listAllTiers();

  return (
    <Section
      title="Membership tiers"
      description="Fixed prices. A deal copies the tier's price when the tier is assigned, so changing a price never rewrites a deal that already has one."
      actions={<NewTierButton />}
    >
      <TableScroller>
        <Table>
          <THead>
            <tr>
              <TH>Tier</TH>
              <TH>Code</TH>
              <TH align="right">Price</TH>
              <TH>Benefits</TH>
              <TH align="right">Deals</TH>
              <TH align="right">Members</TH>
              <TH>Status</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {tiers.length === 0 && (
              <TableMessage colSpan={8}>
                <Empty
                  title="No tiers yet"
                  description="Add the membership levels and their prices."
                  className="py-4"
                />
              </TableMessage>
            )}
            {tiers.map((tier) => (
              <TR key={tier.id} className={tier.isActive ? undefined : 'opacity-60'}>
                <TD className="font-semibold">
                  {tier.name} <span className="text-muted font-normal">{tier.year}</span>
                </TD>
                <TD>
                  <Mono>{tier.code}</Mono>
                </TD>
                <TD numeric align="right">
                  {money(tier.priceMinor)}
                </TD>
                <TD className="max-w-[24rem]">
                  {tier.benefits.length > 0 ? (
                    <ul className="text-ink-soft list-disc space-y-0.5 pl-4 text-[12.5px]">
                      {tier.benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-faint">-</span>
                  )}
                </TD>
                <TD numeric align="right">
                  {tier._count.deals}
                </TD>
                <TD numeric align="right">
                  {tier._count.memberships}
                </TD>
                <TD>
                  <Badge tone={tier.isActive ? 'success' : 'muted'} size="sm">
                    {tier.isActive ? 'Offered' : 'Hidden'}
                  </Badge>
                </TD>
                <TD align="right">
                  <EditTierButton
                    tier={{
                      id: tier.id,
                      name: tier.name,
                      year: tier.year,
                      priceMinor: tier.priceMinor,
                      benefits: tier.benefits,
                      sortOrder: tier.sortOrder,
                      isActive: tier.isActive,
                      dealCount: tier._count.deals,
                    }}
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
