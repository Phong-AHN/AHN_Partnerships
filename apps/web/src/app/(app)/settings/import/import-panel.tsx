'use client';

import { useRef, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Table,
  TableScroller,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@partners/ui';
import { useAction } from '@/components/use-action';
import { commitImportAction, previewImportAction } from '@/features/import/actions';
import type { ImportPlan } from '@/features/import/plan';

/**
 * Upload → preview → confirm. The file is read in the browser and sent as
 * text; nothing is stored. The preview is the server's plan, and the confirm
 * re-plans and writes it in one transaction.
 */
export function ImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);

  const preview = useAction(previewImportAction, {
    toastOnSuccess: false,
    refresh: false,
    onSuccess: (data) => setPlan(data),
  });
  const commit = useAction(commitImportAction, {
    onSuccess: () => {
      setPlan(null);
      setCsv(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const creates = plan?.rows.filter((row) => row.partner === 'create').length ?? 0;
  const updates = plan?.rows.filter((row) => row.partner === 'update').length ?? 0;
  const deals = plan?.rows.filter((row) => row.deal === 'create').length ?? 0;
  const contacts = plan?.rows.reduce((sum, row) => sum + row.newContacts.length, 0) ?? 0;

  return (
    <Card>
      <CardHeader
        title="Import partners"
        icon={<FileUp className="size-4" />}
        description="A CSV in the checklist format: name, sector, contacts (separated by ;), ask_type (CM / RR / SC), priority, stage, existing, amount_usd, summary. An export from this page works too."
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            className="text-muted file:border-line file:bg-surface-1 file:text-ink hover:file:bg-surface-2 text-[13px] file:mr-3 file:rounded-[var(--radius-sm)] file:border file:px-3 file:py-1.5 file:text-[13px] file:font-medium"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              setPlan(null);
              if (!file) return;
              const text = await file.text();
              setCsv(text);
              setFileName(file.name);
              void preview.run({ csv: text });
            }}
          />
          {preview.pending && (
            <span className="text-muted text-[13px]">Checking {fileName}...</span>
          )}
        </div>

        {preview.error && (
          <Alert tone="danger" dense>
            {preview.error}
          </Alert>
        )}

        {plan && plan.issues.length > 0 && (
          <Alert
            tone="danger"
            title={`${plan.issues.length} problem${plan.issues.length === 1 ? '' : 's'} - fix the file and choose it again. Nothing has been imported.`}
          >
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {plan.issues.map((issue, index) => (
                <li key={`${issue.line}-${index}`}>
                  Line {issue.line}: {issue.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {commit.fieldErrors.csv && (
          <Alert tone="danger" title={commit.error ?? 'Nothing was imported.'}>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {commit.fieldErrors.csv.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
        )}

        {plan && plan.rows.length > 0 && (
          <>
            <p className="text-ink-soft text-[13px]">
              <strong>{fileName}</strong>: {creates} new partner{creates === 1 ? '' : 's'},{' '}
              {updates} to update, {contacts} new contact{contacts === 1 ? '' : 's'}, {deals} new
              deal{deals === 1 ? '' : 's'}.
            </p>
            <TableScroller className="max-h-[28rem] overflow-y-auto">
              <Table>
                <THead>
                  <tr>
                    <TH numeric>Line</TH>
                    <TH>Partner</TH>
                    <TH>New contacts</TH>
                    <TH>Deal</TH>
                  </tr>
                </THead>
                <TBody>
                  {plan.rows.map((row) => (
                    <TR key={row.line}>
                      <TD numeric className="text-muted">
                        {row.line}
                      </TD>
                      <TD>
                        <span className="font-medium">{row.name}</span>{' '}
                        <Badge tone={row.partner === 'create' ? 'success' : 'info'} size="sm">
                          {row.partner === 'create' ? 'New' : 'Update'}
                        </Badge>
                      </TD>
                      <TD className="text-ink-soft text-[12.5px]">
                        {row.newContacts.length > 0 ? (
                          row.newContacts.join(', ')
                        ) : (
                          <span className="text-faint">-</span>
                        )}
                      </TD>
                      <TD className="text-[12.5px]">
                        {row.deal === 'create' ? (
                          <span>
                            <Badge tone="success" size="sm">
                              New
                            </Badge>{' '}
                            {row.dealSummary}
                          </span>
                        ) : row.deal === 'keep' ? (
                          <span className="text-muted">Already has this deal - kept as is</span>
                        ) : (
                          <span className="text-faint">No deal</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroller>
          </>
        )}
      </CardBody>
      {plan && plan.rows.length > 0 && plan.issues.length === 0 && csv && (
        <CardFooter>
          <p className="text-muted text-[12.5px]">
            All rows are written together - if anything fails, nothing is imported.
          </p>
          <Button
            variant="primary"
            size="sm"
            loading={commit.pending}
            onClick={() => void commit.run({ csv })}
          >
            <Upload className="size-4" />
            Import {plan.rows.length} row{plan.rows.length === 1 ? '' : 's'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
