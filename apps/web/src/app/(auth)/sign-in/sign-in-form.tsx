'use client';

import { useActionState, useState } from 'react';
import { ArrowRight, MailCheck } from 'lucide-react';
import { Alert, Button, Field, Input } from '@partners/ui';
import { requestSignInLinkAction } from '@/features/auth/actions';
import type { ActionResult } from '@/server/action';

export function SignInForm({ next, devHint }: { next?: string; devHint: boolean }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ email: string }> | null,
    FormData
  >(requestSignInLinkAction, null);
  const [again, setAgain] = useState(false);
  const failed = state && !state.ok ? state : null;

  if (state?.ok && !again) {
    return (
      <div className="space-y-4">
        <Alert tone="success" icon={<MailCheck className="size-4" />} title="Check your email">
          If <strong>{state.data.email}</strong> has an account, a sign-in link is on its way. It
          works once and expires in 15 minutes.
        </Alert>
        {devHint && (
          <p className="text-muted text-[12px]">
            Local development: no Resend key is set, so the link is printed in the dev server log.
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={() => setAgain(true)}>
          Use a different address or send again
        </Button>
      </div>
    );
  }

  return (
    <form
      action={(data) => {
        setAgain(false);
        formAction(data);
      }}
      className="space-y-4"
      noValidate
    >
      {next && <input type="hidden" name="next" value={next} />}

      {failed && !failed.fieldErrors && (
        <Alert tone="danger" dense>
          {failed.error}
        </Alert>
      )}

      <Field label="Work email" htmlFor="email" required error={failed?.fieldErrors?.email ?? null}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@ahnmedia.com"
          required
          autoFocus
          aria-invalid={Boolean(failed?.fieldErrors?.email)}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
        Email me a sign-in link
        <ArrowRight className="size-4" />
      </Button>

      <p className="text-muted text-center text-[12px]">
        No password needed. AHN team only - an admin adds new people.
      </p>
    </form>
  );
}
