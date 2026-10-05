import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { landingPathFor } from '@partners/rbac';
import { LogoMark } from '@/components/shell/sidebar';
import { getPrincipal } from '@/server/session';
import { VerifyForm } from './verify-form';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Where the emailed link lands. Opening it does not sign anyone in - the
 * button does - so a mail scanner that follows every link cannot spend it.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const { token, next } = await searchParams;
  const principal = await getPrincipal();
  if (principal) redirect(landingPathFor(principal));

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5 py-12 sm:px-10">
      <div className="w-full max-w-sm">
        <LogoMark className="mb-6 size-10" />
        {token ? (
          <>
            <h1 className="text-ink text-[22px] font-semibold leading-7 tracking-tight">
              Almost there
            </h1>
            <p className="text-muted mb-7 mt-1.5 text-[13.5px]">
              Confirm to finish signing in. The link works once.
            </p>
            <VerifyForm token={token} next={next} />
          </>
        ) : (
          <>
            <h1 className="text-ink text-[22px] font-semibold leading-7 tracking-tight">
              That link is incomplete
            </h1>
            <p className="text-muted mt-2 text-[13.5px]">
              Copy the whole link from the email, or{' '}
              <Link href="/sign-in" className="text-accent-ink underline-offset-4 hover:underline">
                ask for a new one
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}
