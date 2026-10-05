'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

/**
 * A real form that navigates to the filtered partner list, so a search is
 * bookmarkable and survives a reload. `/` focuses it.
 */
export function SearchBox() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const value = ref.current?.value.trim() ?? '';
        router.push(value ? `/partners?q=${encodeURIComponent(value)}` : '/partners');
      }}
      className="relative hidden w-full max-w-md sm:block"
    >
      <Search className="text-faint pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
      <input
        ref={ref}
        name="q"
        type="search"
        placeholder="Search partners and contacts"
        aria-label="Search partners"
        className="border-line bg-surface-1 text-ink placeholder:text-faint focus:border-accent focus:ring-accent/20 h-9 w-full rounded-[var(--radius-md)] border pl-9 pr-10 text-[13px] focus:outline-none focus:ring-2"
      />
      <kbd className="border-line bg-surface-2 text-faint pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px]">
        /
      </kbd>
    </form>
  );
}
