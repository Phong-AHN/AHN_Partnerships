import { redirect } from 'next/navigation';
import { landingPathFor } from '@partners/rbac';
import { getPrincipal } from '@/server/session';

export default async function IndexPage() {
  const principal = await getPrincipal();
  redirect(principal ? landingPathFor(principal) : '/sign-in');
}
