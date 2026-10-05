import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { CircleCheck } from 'lucide-react';
import { landingPathFor } from '@partners/rbac';
import { LogoMark } from '@/components/shell/sidebar';
import { getPrincipal } from '@/server/session';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

const PROMISES = [
  'Where every partner stands, and who owns the next step.',
  'What we are asking each one for - membership, referral or strategic.',
  'Booked against target, and what is still in the pipeline.',
  'Which follow-ups are overdue and which members are up for renewal.',
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const principal = await getPrincipal();
  if (principal) redirect(landingPathFor(principal));

  const { next } = await searchParams;

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel. Hidden on small screens - it is atmosphere, not content. */}
      <section className="bg-ink relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid absolute inset-0 opacity-[0.18]" aria-hidden />
        <div
          className="absolute -left-32 -top-40 size-[540px] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, oklch(0.55 0.2 275), transparent 68%)' }}
          aria-hidden
        />
        <div
          className="absolute -bottom-48 -right-32 size-[520px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, oklch(0.62 0.15 158), transparent 70%)' }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3 p-12">
          <LogoMark className="size-9" />
          <div>
            <p className="text-[15px] font-semibold leading-5 tracking-tight">AHN Partnerships</p>
            <p className="text-[12px] leading-4 text-white/55">AHN &middot; AHNF 2027</p>
          </div>
        </div>

        <div className="relative max-w-lg p-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            Partnership pipeline
          </p>
          <h1 className="mt-4 text-balance text-[38px] font-semibold leading-[1.1] tracking-tight">
            Work it as a pipeline, not fifty identical emails.
          </h1>
          <ul className="mt-8 space-y-3">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-start gap-3 text-[14px] text-white/75">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-white/45" />
                {promise}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative p-12">
          <p className="text-[12px] text-white/40">
            Corporate memberships, referral and revenue partnerships, and strategic and community
            partnerships - one record per partner.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="size-9" />
            <div>
              <p className="text-ink text-[15px] font-semibold leading-5 tracking-tight">
                AHN Partnerships
              </p>
              <p className="text-muted text-[12px] leading-4">AHN &middot; AHNF 2027</p>
            </div>
          </div>

          <h2 className="text-ink text-[22px] font-semibold leading-7 tracking-tight">Sign in</h2>
          <p className="text-muted mb-7 mt-1.5 text-[13.5px]">
            Use the account an admin set up for you.
          </p>

          <SignInForm next={next} />
        </div>
      </section>
    </main>
  );
}
