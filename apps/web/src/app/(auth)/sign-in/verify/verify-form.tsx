'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Alert, Button, buttonStyles } from '@partners/ui';
import { verifySignInAction } from '@/features/auth/actions';
import type { ActionResult } from '@/server/action';

export function VerifyForm({ token, next }: { token: string; next?: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<never> | null, FormData>(
    verifySignInAction,
    null,
  );
  const failed = state && !state.ok ? state : null;

  if (failed) {
    return (
      <div className="space-y-4">
        <Alert tone="danger" dense>
          {failed.error}
        </Alert>
        <Link href="/sign-in" className={buttonStyles('primary', 'md', 'w-full')}>
          Get a new link
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      {next && <input type="hidden" name="next" value={next} />}
      <Button type="submit" variant="primary" size="lg" fullWidth loading={pending} autoFocus>
        Sign in to AHN Partnerships
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
