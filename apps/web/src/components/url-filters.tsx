'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw, Search } from 'lucide-react';
import { cn, Select } from '@partners/ui';

/**
 * Every filter control writes to the URL rather than to local state, so a
 * filtered view is a link you can paste to a colleague and the server stays
 * the only place that decides what the list contains.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  const clear = (keep: readonly string[] = []) => {
    const next = new URLSearchParams();
    for (const key of keep) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  return { params, set, clear, pending };
}

export function SearchFilter({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  return (
    <div className="relative min-w-[14rem] flex-1">
      <Search className="text-faint pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
      <input
        type="search"
        defaultValue={value}
        key={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onCommit((event.target as HTMLInputElement).value.trim());
        }}
        onBlur={(event) => {
          if (event.target.value.trim() !== value) onCommit(event.target.value.trim());
        }}
        className="border-line bg-surface-1 text-ink placeholder:text-faint focus:border-accent focus:ring-accent/20 h-9 w-full rounded-[var(--radius-md)] border pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2"
      />
    </div>
  );
}

export function SelectFilter({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value || null)}
      className="h-9 w-auto min-w-[9.5rem]"
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function ResetFilters({ onReset, visible }: { onReset: () => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onReset}
      className="text-muted hover:text-ink inline-flex items-center gap-1 text-[12.5px] font-medium"
    >
      <RotateCcw className="size-3.5" />
      Reset
    </button>
  );
}

export function FilterRow({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 transition-opacity',
        pending && 'opacity-70',
      )}
    >
      {children}
    </div>
  );
}
