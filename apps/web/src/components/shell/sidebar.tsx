'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import type { NavGroup } from '@partners/rbac';
import { IconButton } from '@partners/ui';
import type { BadgeCounts } from '@/features/shell/queries';
import { NavLink } from './nav-link';

function NavGroups({
  groups,
  badges,
  onNavigate,
}: {
  groups: readonly NavGroup[];
  badges: BadgeCounts;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-5 px-3 py-4" aria-label="Main">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="text-faint mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                description={item.description}
                badge={item.badge ? badges[item.badge] : undefined}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({
  groups,
  badges,
  footer,
}: {
  groups: readonly NavGroup[];
  badges: BadgeCounts;
  footer: React.ReactNode;
}) {
  return (
    <aside className="border-line bg-surface-2/55 sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r lg:flex">
      <div className="border-line flex h-14 items-center gap-2.5 border-b px-4">
        <Wordmark />
      </div>
      <div className="scrollbar-slim flex-1 overflow-y-auto">
        <NavGroups groups={groups} badges={badges} />
      </div>
      <div className="border-line border-t p-3">{footer}</div>
    </aside>
  );
}

/** Real mobile navigation, not a menu that is merely hidden below `lg`. */
export function MobileNav({
  groups,
  badges,
  footer,
}: {
  groups: readonly NavGroup[];
  badges: BadgeCounts;
  footer: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        label="Open navigation"
        size="sm"
        onClick={() => setOpen(true)}
        className="lg:hidden"
      >
        <Menu className="size-4.5" />
      </IconButton>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="bg-ink/40 absolute inset-0 backdrop-blur-[2px]"
          />
          <div className="rise border-line bg-surface-1 shadow-overlay absolute inset-y-0 left-0 flex w-[16.5rem] flex-col border-r">
            <div className="border-line flex h-14 items-center justify-between border-b px-4">
              <Wordmark />
              <IconButton label="Close navigation" size="sm" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="scrollbar-slim flex-1 overflow-y-auto">
              <NavGroups groups={groups} badges={badges} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-line border-t p-3">{footer}</div>
          </div>
        </div>
      )}
    </>
  );
}

export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <span
      className={`bg-accent grid shrink-0 place-items-center rounded-[10px] ${className}`}
      aria-hidden
    >
      {/* Two linked rings: a partnership. */}
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none">
        <circle cx="9" cy="12" r="5" stroke="white" strokeWidth="2.2" />
        <circle cx="15" cy="12" r="5" stroke="white" strokeOpacity="0.6" strokeWidth="2.2" />
      </svg>
    </span>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoMark />
      <span className="min-w-0">
        <span className="text-ink block text-[14px] font-semibold leading-4 tracking-tight">
          Partnerships
        </span>
        <span className="text-muted block text-[10.5px] leading-4">AHN &middot; AHNF 2027</span>
      </span>
    </Link>
  );
}
