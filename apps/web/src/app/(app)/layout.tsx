import { navigationFor } from '@partners/rbac';
import { MobileNav, Sidebar, Wordmark } from '@/components/shell/sidebar';
import { SearchBox } from '@/components/shell/search-box';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { UserMenu } from '@/components/shell/user-menu';
import { getBadgeCounts } from '@/features/shell/queries';
import { requirePrincipalOrRedirect } from '@/server/session';

/** The signed-in surface. Every page under it can assume a principal. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const principal = await requirePrincipalOrRedirect();
  const groups = navigationFor(principal);
  const badges = await getBadgeCounts();

  const userMenu = <UserMenu name={principal.name} email={principal.email} role={principal.role} />;

  return (
    <div className="flex min-h-dvh">
      <Sidebar groups={groups} badges={badges} footer={userMenu} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-canvas/85 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-md sm:px-5">
          <MobileNav groups={groups} badges={badges} footer={userMenu} />
          <div className="lg:hidden">
            <Wordmark />
          </div>

          <div className="mx-auto flex w-full max-w-2xl justify-center px-2">
            <SearchBox />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[86rem]">{children}</div>
        </main>

        <footer className="border-line text-faint border-t px-6 py-4 text-[11.5px]">
          AHN Partnerships - one record per partner. Amounts in USD. Dates in UTC.
        </footer>
      </div>
    </div>
  );
}
