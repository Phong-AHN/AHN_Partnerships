'use client';

import { usePathname } from 'next/navigation';
import { Tabs } from '@partners/ui';

export function SettingsTabs({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname();
  const active =
    [...items]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname.startsWith(item.href))?.href ??
    items[0]?.href ??
    '';
  return <Tabs items={items} active={active} />;
}
