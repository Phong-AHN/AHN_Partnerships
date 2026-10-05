'use client';

import { Pencil, Plus } from 'lucide-react';
import { DEFAULT_YEAR, minorToDollarsInput } from '@partners/core';
import {
  Alert,
  Button,
  Checkbox,
  DialogTrigger,
  Field,
  FormActions,
  Input,
  Textarea,
} from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { createTierAction, updateTierAction } from '@/features/tiers/actions';

export interface TierFormValues {
  id: string;
  name: string;
  year: number;
  priceMinor: number;
  benefits: string[];
  sortOrder: number;
  isActive: boolean;
  dealCount: number;
}

function TierForm({ tier, onDone }: { tier?: TierFormValues; onDone: () => void }) {
  const create = useAction(createTierAction, { onSuccess: onDone });
  const update = useAction(updateTierAction, { onSuccess: onDone });
  const action = tier ? update : create;
  const errors = action.fieldErrors;
  const key = tier?.id ?? 'new';

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const values = readForm(event.currentTarget);
        if (tier) void update.run({ ...values, id: tier.id });
        else void create.run(values);
      }}
    >
      {tier && tier.dealCount > 0 && (
        <Alert tone="info" dense>
          {tier.dealCount} deal{tier.dealCount === 1 ? ' uses' : 's use'} this tier. A new price
          applies to tiers assigned from now on - those deals keep the price they were given.
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Name"
          htmlFor={`t-name-${key}`}
          required
          error={fieldError(errors, 'name')}
          className="sm:col-span-2"
        >
          <Input
            id={`t-name-${key}`}
            name="name"
            required
            maxLength={60}
            placeholder="Title Package"
            defaultValue={tier?.name}
            autoFocus
          />
        </Field>
        <Field label="Year" htmlFor={`t-year-${key}`} required error={fieldError(errors, 'year')}>
          <Input
            id={`t-year-${key}`}
            name="year"
            type="number"
            min={2020}
            max={2100}
            required
            defaultValue={tier?.year ?? DEFAULT_YEAR}
          />
        </Field>
        <Field
          label="Price (USD)"
          htmlFor={`t-price-${key}`}
          required
          error={fieldError(errors, 'price')}
          className="sm:col-span-2"
        >
          <Input
            id={`t-price-${key}`}
            name="price"
            inputMode="decimal"
            required
            placeholder="50000"
            defaultValue={tier ? minorToDollarsInput(tier.priceMinor) : ''}
          />
        </Field>
        <Field
          label="Order"
          htmlFor={`t-order-${key}`}
          hint="Lower shows first."
          error={fieldError(errors, 'sortOrder')}
        >
          <Input
            id={`t-order-${key}`}
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={tier?.sortOrder ?? 0}
          />
        </Field>
      </div>
      <Field
        label="Benefits"
        htmlFor={`t-benefits-${key}`}
        hint="One per line."
        error={fieldError(errors, 'benefits')}
      >
        <Textarea
          id={`t-benefits-${key}`}
          name="benefits"
          rows={5}
          defaultValue={tier?.benefits.join('\n') ?? ''}
        />
      </Field>
      <Checkbox
        id={`t-active-${key}`}
        name="isActive"
        label="Offered"
        hint="Hidden tiers cannot be given to new deals; existing deals keep them."
        defaultChecked={tier?.isActive ?? true}
      />
      <FormActions>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={action.pending}>
          {tier ? 'Save tier' : 'Add tier'}
        </Button>
      </FormActions>
    </form>
  );
}

export function NewTierButton() {
  return (
    <DialogTrigger
      title="New membership tier"
      trigger={(open) => (
        <Button variant="primary" size="sm" onClick={open}>
          <Plus className="size-4" />
          New tier
        </Button>
      )}
    >
      {(close) => <TierForm onDone={close} />}
    </DialogTrigger>
  );
}

export function EditTierButton({ tier }: { tier: TierFormValues }) {
  return (
    <DialogTrigger
      title={`Edit ${tier.name} ${tier.year}`}
      trigger={(open) => (
        <Button variant="ghost" size="xs" onClick={open}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      )}
    >
      {(close) => <TierForm tier={tier} onDone={close} />}
    </DialogTrigger>
  );
}
