'use client';

import { useState } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { Button, ConfirmDialog } from '@partners/ui';
import { useAction } from '@/components/use-action';
import { archivePartnerAction } from '@/features/partners/actions';

export function ArchiveButton({
  partnerId,
  name,
  archived,
}: {
  partnerId: string;
  name: string;
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useAction(archivePartnerAction, { onSuccess: () => setOpen(false) });

  if (archived) {
    return (
      <Button
        variant="secondary"
        size="sm"
        loading={toggle.pending}
        onClick={() => void toggle.run({ id: partnerId, archived: false })}
      >
        <ArchiveRestore className="size-3.5" />
        Restore
      </Button>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Archive className="size-3.5" />
        Archive
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void toggle.run({ id: partnerId, archived: true })}
        title={`Archive ${name}?`}
        description="It leaves the partner list, the pipeline and the dashboard. Nothing is deleted, and it can be restored from the archived filter."
        confirmLabel="Archive"
        variant="danger"
        busy={toggle.pending}
      />
    </>
  );
}
