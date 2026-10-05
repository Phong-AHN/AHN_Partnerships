'use client';

import { useRef, useState } from 'react';
import {
  LOGGABLE_ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  type LoggableActivityType,
} from '@partners/core';
import { Button, cn, Field, Input, Select, Textarea } from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { logActivityAction } from '@/features/activity/actions';

/** The quick note box: pick what kind of touch it was, write a line, save. */
export function ActivityComposer({
  partnerId,
  deals,
  today,
}: {
  partnerId: string;
  deals: readonly { id: string; title: string }[];
  today: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<LoggableActivityType>('NOTE');
  const log = useAction(logActivityAction, {
    onSuccess: () => {
      formRef.current?.reset();
      setType('NOTE');
    },
  });
  const errors = log.fieldErrors;

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void log.run({ ...readForm(event.currentTarget), partnerId, type });
      }}
    >
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Kind of entry">
        {LOGGABLE_ACTIVITY_TYPES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => setType(value)}
            className={cn(
              'rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors',
              type === value
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line text-muted hover:text-ink hover:border-line-strong',
            )}
          >
            {ACTIVITY_TYPE_LABEL[value].label}
          </button>
        ))}
      </div>
      <Field
        label="What happened"
        htmlFor="activity-body"
        hideLabel
        error={fieldError(errors, 'body')}
      >
        <Textarea
          id="activity-body"
          name="body"
          rows={3}
          maxLength={5000}
          placeholder={
            type === 'CALL'
              ? 'Who you spoke to and what was agreed'
              : type === 'MEETING'
                ? 'Who was there and what comes next'
                : type === 'EMAIL'
                  ? 'What was sent or received'
                  : 'Write a note'
          }
          aria-invalid={Boolean(errors.body)}
        />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        {deals.length > 0 && (
          <Field label="About deal" htmlFor="activity-deal" className="min-w-[12rem] flex-1">
            <Select id="activity-deal" name="dealId" defaultValue="" className="h-8.5">
              <option value="">The partner in general</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="When" htmlFor="activity-date" error={fieldError(errors, 'occurredOn')}>
          <Input
            id="activity-date"
            name="occurredOn"
            type="date"
            max={today}
            defaultValue={today}
            className="h-8.5"
          />
        </Field>
        <Button type="submit" variant="primary" size="sm" loading={log.pending} className="ml-auto">
          Log {ACTIVITY_TYPE_LABEL[type].label.toLowerCase()}
        </Button>
      </div>
    </form>
  );
}
