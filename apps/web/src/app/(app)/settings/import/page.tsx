import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { PARTNER_CSV_COLUMNS } from '@partners/core';
import { can } from '@partners/rbac';
import { buttonStyles, Card, CardBody, CardHeader, Mono, PermissionDenied } from '@partners/ui';
import { requirePrincipalOrRedirect } from '@/server/session';
import { ImportPanel } from './import-panel';

export const metadata: Metadata = { title: 'Import & export' };
export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const principal = await requirePrincipalOrRedirect('/settings/import');
  if (!can(principal, 'data:import')) return <PermissionDenied />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <ImportPanel />
      <Card className="h-fit">
        <CardHeader title="Export" icon={<Download className="size-4" />} />
        <CardBody className="space-y-4 text-[13px]">
          <p className="text-ink-soft">
            The whole pipeline as a CSV: one row per deal, partners without a deal on a row of their
            own. The Pipeline page exports just the filtered view.
          </p>
          <a href="/api/export" className={buttonStyles('secondary', 'sm')}>
            <Download className="size-4" />
            Download CSV
          </a>
          <div>
            <p className="text-muted mb-1.5 text-[12px] font-medium">Columns read on import</p>
            <div className="flex flex-wrap gap-1">
              {PARTNER_CSV_COLUMNS.map((column) => (
                <Mono key={column}>{column}</Mono>
              ))}
            </div>
            <p className="text-muted mt-2 text-[12px] leading-5">
              Only <strong>name</strong> and <strong>sector</strong> are required. Matching is by
              partner name (ignoring case): an existing partner is updated, never duplicated, and
              blank cells never erase what is on file. A deal is added only when the partner has
              none for that year and ask.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
