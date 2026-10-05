import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { landingPathFor } from '@partners/rbac';
import { getPrincipal } from '@/server/session';
import { SetPasswordForm } from './set-password-form';

export const metadata: Metadata = { title: 'Set your password' };

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const principal = await getPrincipal();
  if (principal) redirect(landingPathFor(principal));

  const { token } = await searchParams;

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5 py-12 sm:px-10">
      <div className="w-full max-w-sm">
        {token ? (
          <>
            <h1 className="text-ink text-[22px] font-semibold leading-7 tracking-tight">
              Set your password
            </h1>
            <p className="text-muted mb-7 mt-1.5 text-[13.5px]">
              This finishes setting up your AHN Partnerships account.
            </p>
            <SetPasswordForm token={token} />
          </>
        ) : (
          <div className="text-center">
            <h1 className="text-ink text-[22px] font-semibold leading-7 tracking-tight">
              That link is missing something
            </h1>
            <p className="text-muted mt-2 text-[13.5px]">Ask an admin for a new link.</p>
          </div>
        )}
      </div>
    </main>
  );
}
