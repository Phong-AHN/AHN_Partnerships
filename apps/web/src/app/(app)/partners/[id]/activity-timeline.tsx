import {
  ArrowRightLeft,
  BadgeCheck,
  Handshake,
  Mail,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  ACTIVITY_TYPE_LABEL,
  formatDateTime,
  formatRelative,
  type ActivityType,
} from '@partners/core';
import { Empty, Timeline, TimelineItem } from '@partners/ui';

const ICON: Record<ActivityType, LucideIcon> = {
  NOTE: StickyNote,
  EMAIL: Mail,
  CALL: Phone,
  MEETING: Users,
  STAGE_CHANGE: ArrowRightLeft,
  DEAL_CREATED: Handshake,
  MEMBERSHIP_STARTED: BadgeCheck,
};

export interface TimelineEntry {
  id: string;
  type: ActivityType;
  body: string;
  occurredAt: Date;
  author: { name: string } | null;
  deal: { id: string; title: string } | null;
}

export function ActivityTimeline({
  entries,
  now,
}: {
  entries: readonly TimelineEntry[];
  now: Date;
}) {
  if (entries.length === 0) {
    return (
      <Empty
        title="Nothing logged yet"
        description="Notes, emails, calls and meetings show up here, along with every stage change."
        className="py-8"
      />
    );
  }
  return (
    <Timeline>
      {entries.map((entry, index) => {
        const Icon = ICON[entry.type];
        return (
          <TimelineItem
            key={entry.id}
            icon={<Icon className="size-3.5" />}
            connector={index < entries.length - 1}
            title={
              <span>
                {ACTIVITY_TYPE_LABEL[entry.type].label}
                {entry.author && (
                  <span className="text-muted font-normal"> by {entry.author.name}</span>
                )}
                {entry.deal && (
                  <span className="text-muted font-normal"> · {entry.deal.title}</span>
                )}
              </span>
            }
            meta={
              <span title={formatDateTime(entry.occurredAt)}>
                {formatRelative(entry.occurredAt, now)}
              </span>
            }
          >
            <p className="text-ink-soft whitespace-pre-line">{entry.body}</p>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}
