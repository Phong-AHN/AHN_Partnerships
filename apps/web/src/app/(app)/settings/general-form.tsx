'use client';

import { minorToDollarsInput } from '@partners/core';
import { Button, Card, CardBody, CardHeader, Field, FormActions, Input } from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { updateSettingsAction } from '@/features/settings/actions';

export function GeneralSettingsForm({
  annualTargetMinor,
  renewalNoticeDays,
  staleDays,
  year,
}: {
  annualTargetMinor: number | null;
  renewalNoticeDays: number;
  staleDays: number;
  year: number;
}) {
  const save = useAction(updateSettingsAction);
  const errors = save.fieldErrors;

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Targets and reminders"
        description="Used by the dashboard, the pipeline and the members list."
      />
      <CardBody>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save.run(readForm(event.currentTarget));
          }}
        >
          <Field
            label={`${year} revenue target (USD)`}
            htmlFor="settings-target"
            hint="Booked revenue (won deals) is measured against this. Leave empty if not agreed yet."
            error={fieldError(errors, 'annualTarget')}
          >
            <Input
              id="settings-target"
              name="annualTarget"
              inputMode="decimal"
              placeholder="500000"
              defaultValue={minorToDollarsInput(annualTargetMinor)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Renewal notice (days)"
              htmlFor="settings-notice"
              required
              hint="A membership shows as due for renewal this long before it ends."
              error={fieldError(errors, 'renewalNoticeDays')}
            >
              <Input
                id="settings-notice"
                name="renewalNoticeDays"
                type="number"
                min={1}
                max={365}
                required
                defaultValue={renewalNoticeDays}
              />
            </Field>
            <Field
              label="Gone quiet after (days)"
              htmlFor="settings-stale"
              required
              hint="An open deal with no note, call, email, meeting or stage change for this long is flagged."
              error={fieldError(errors, 'staleDays')}
            >
              <Input
                id="settings-stale"
                name="staleDays"
                type="number"
                min={1}
                max={365}
                required
                defaultValue={staleDays}
              />
            </Field>
          </div>
          <FormActions>
            <Button type="submit" variant="primary" size="sm" loading={save.pending}>
              Save settings
            </Button>
          </FormActions>
        </form>
      </CardBody>
    </Card>
  );
}
