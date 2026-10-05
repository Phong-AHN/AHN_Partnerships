'use client';

import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  SECTORS,
  SECTOR_LABEL,
  type Priority,
  type Sector,
} from '@partners/core';
import {
  Alert,
  Button,
  Checkbox,
  DialogTrigger,
  Field,
  FormActions,
  Input,
  Select,
  Textarea,
} from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { createPartnerAction, updatePartnerAction } from '@/features/partners/actions';
import type { UserOption } from '@/features/users/queries';

export interface PartnerFormValues {
  id: string;
  name: string;
  sector: Sector;
  priority: Priority;
  website: string | null;
  summary: string | null;
  ownerId: string | null;
  existingRelationship: boolean;
}

function PartnerForm({
  partner,
  users,
  onDone,
}: {
  partner?: PartnerFormValues;
  users: readonly UserOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const create = useAction(createPartnerAction, {
    onSuccess: (data) => {
      onDone();
      router.push(`/partners/${data.id}`);
    },
  });
  const update = useAction(updatePartnerAction, { onSuccess: onDone });
  const action = partner ? update : create;
  const errors = action.fieldErrors;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const values = readForm(event.currentTarget);
        if (partner) void update.run({ ...values, id: partner.id });
        else void create.run(values);
      }}
    >
      {action.error && Object.keys(errors).length > 0 && (
        <Alert tone="danger" dense>
          {action.error}
        </Alert>
      )}
      <Field label="Name" htmlFor="partner-name" required error={fieldError(errors, 'name')}>
        <Input
          id="partner-name"
          name="name"
          required
          maxLength={160}
          defaultValue={partner?.name}
          autoFocus
          aria-invalid={Boolean(errors.name)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Sector"
          htmlFor="partner-sector"
          required
          error={fieldError(errors, 'sector')}
        >
          <Select id="partner-sector" name="sector" required defaultValue={partner?.sector ?? ''}>
            <option value="" disabled>
              Choose a sector
            </option>
            {SECTORS.map((sector) => (
              <option key={sector} value={sector}>
                {SECTOR_LABEL[sector].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Priority"
          htmlFor="partner-priority"
          required
          error={fieldError(errors, 'priority')}
        >
          <Select
            id="partner-priority"
            name="priority"
            required
            defaultValue={partner?.priority ?? 'BACKLOG'}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Owner at AHN" htmlFor="partner-owner" error={fieldError(errors, 'ownerId')}>
          <Select id="partner-owner" name="ownerId" defaultValue={partner?.ownerId ?? ''}>
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Website" htmlFor="partner-website" error={fieldError(errors, 'website')}>
          <Input
            id="partner-website"
            name="website"
            placeholder="example.com"
            defaultValue={partner?.website ?? ''}
          />
        </Field>
      </div>
      <Field
        label="Opportunity"
        htmlFor="partner-summary"
        hint="One or two lines: what the relationship is and what we could do together."
        error={fieldError(errors, 'summary')}
      >
        <Textarea
          id="partner-summary"
          name="summary"
          rows={3}
          maxLength={2000}
          defaultValue={partner?.summary ?? ''}
        />
      </Field>
      <Checkbox
        id="partner-existing"
        name="existingRelationship"
        label="Existing AHN relationship"
        hint="We have worked with them before."
        defaultChecked={partner?.existingRelationship ?? false}
      />
      <FormActions>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={action.pending}>
          {partner ? 'Save changes' : 'Add partner'}
        </Button>
      </FormActions>
    </form>
  );
}

export function NewPartnerButton({ users }: { users: readonly UserOption[] }) {
  return (
    <DialogTrigger
      title="New partner"
      description="A company or organization we want a 2027 relationship with."
      trigger={(open) => (
        <Button variant="primary" onClick={open}>
          <Plus className="size-4" />
          New partner
        </Button>
      )}
    >
      {(close) => <PartnerForm users={users} onDone={close} />}
    </DialogTrigger>
  );
}

export function EditPartnerButton({
  partner,
  users,
}: {
  partner: PartnerFormValues;
  users: readonly UserOption[];
}) {
  return (
    <DialogTrigger
      title={`Edit ${partner.name}`}
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      )}
    >
      {(close) => <PartnerForm partner={partner} users={users} onDone={close} />}
    </DialogTrigger>
  );
}
