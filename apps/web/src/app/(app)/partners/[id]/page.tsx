import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, History } from 'lucide-react';
import { clock, toDateInput } from '@partners/core';
import { can } from '@partners/rbac';
import { Badge, Breadcrumbs, Card, CardBody, CardHeader, PageHeader } from '@partners/ui';
import { PriorityPill, SectorLabel } from '@/components/domain';
import { getPartner } from '@/features/partners/queries';
import { getSettings } from '@/features/settings/service';
import { listTierOptions } from '@/features/tiers/queries';
import { listActiveUsers } from '@/features/users/queries';
import { requirePrincipalOrRedirect } from '@/server/session';
import { EditPartnerButton } from '../partner-form';
import { ActivityComposer } from './activity-composer';
import { ActivityTimeline } from './activity-timeline';
import { ArchiveButton } from './archive-button';
import { ContactsCard } from './contacts-card';
import { DealsCard } from './deals-card';
import { MembershipsCard } from './memberships-card';

export const metadata: Metadata = { title: 'Partner' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requirePrincipalOrRedirect(`/partners/${id}`);
  if (!UUID.test(id)) notFound();

  const [partner, users, tiers, settings] = await Promise.all([
    getPartner(id),
    listActiveUsers(),
    listTierOptions(),
    getSettings(),
  ]);
  if (!partner) notFound();

  const now = clock.now();
  const canWrite = can(principal, 'partner:write');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Breadcrumbs
            items={[{ label: 'Partners', href: '/partners' }, { label: partner.name }]}
          />
        }
        title={partner.name}
        description={partner.summary ?? undefined}
        meta={
          <>
            <PriorityPill priority={partner.priority} />
            <SectorLabel sector={partner.sector} />
            {partner.existingRelationship && (
              <Badge tone="success" size="sm">
                Existing relationship
              </Badge>
            )}
            {partner.archivedAt && (
              <Badge tone="muted" size="sm">
                Archived
              </Badge>
            )}
            <span className="text-muted text-[12.5px]">
              Owner:{' '}
              <span className="text-ink-soft font-medium">
                {partner.owner?.name ?? 'Unassigned'}
              </span>
            </span>
            {partner.website && (
              <Link
                href={partner.website}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent-ink inline-flex items-center gap-1 text-[12.5px] hover:underline"
              >
                {partner.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                <ExternalLink className="size-3" />
              </Link>
            )}
          </>
        }
        actions={
          <>
            {canWrite && (
              <EditPartnerButton
                users={users}
                partner={{
                  id: partner.id,
                  name: partner.name,
                  sector: partner.sector,
                  priority: partner.priority,
                  website: partner.website,
                  summary: partner.summary,
                  ownerId: partner.ownerId,
                  existingRelationship: partner.existingRelationship,
                }}
              />
            )}
            {can(principal, 'partner:archive') && (
              <ArchiveButton
                partnerId={partner.id}
                name={partner.name}
                archived={partner.archivedAt !== null}
              />
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <DealsCard
            partner={partner}
            principal={principal}
            users={users}
            tiers={tiers}
            now={now}
          />

          <Card>
            <CardHeader
              title="Timeline"
              count={partner.activities.length}
              icon={<History className="size-4" />}
              description="Every touch and every stage change, newest first."
            />
            <CardBody className="space-y-5">
              {can(principal, 'activity:write') && (
                <ActivityComposer
                  partnerId={partner.id}
                  deals={partner.deals.map((deal) => ({ id: deal.id, title: deal.title }))}
                  today={toDateInput(now)}
                />
              )}
              <ActivityTimeline entries={partner.activities} now={now} />
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <MembershipsCard
            partner={partner}
            principal={principal}
            now={now}
            renewalNoticeDays={settings.renewalNoticeDays}
          />
          <ContactsCard
            partnerId={partner.id}
            contacts={partner.contacts}
            canEdit={can(principal, 'contact:write')}
          />
        </div>
      </div>
    </div>
  );
}
