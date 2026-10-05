import * as React from 'react';
import type { Tone } from '@partners/core';
import { cn } from './cn';
import { TONE_DOT } from './tone';

export interface TimelineItemProps {
  tone?: Tone;
  icon?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  /** Renders the connector below. Set false on the last item. */
  connector?: boolean;
}

export function Timeline({ className, ...rest }: React.HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn('relative', className)} {...rest} />;
}

export function TimelineItem({
  tone = 'neutral',
  icon,
  title,
  meta,
  children,
  connector = true,
}: TimelineItemProps) {
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {connector && (
        <span className="bg-line absolute bottom-0 left-[13px] top-7 w-px" aria-hidden />
      )}
      <span
        className={cn(
          'ring-surface-1 relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-4',
          icon ? 'bg-surface-2 text-muted' : TONE_DOT[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-ink min-w-0 text-[13.5px] font-medium leading-5">{title}</p>
          {meta && <span className="text-faint shrink-0 text-[11.5px]">{meta}</span>}
        </div>
        {children && <div className="text-muted mt-1 text-[13px] leading-5">{children}</div>}
      </div>
    </li>
  );
}
