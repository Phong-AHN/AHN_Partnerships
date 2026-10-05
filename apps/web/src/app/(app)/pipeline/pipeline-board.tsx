'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Moon } from 'lucide-react';
import { DEAL_STAGE_LABEL, PIPELINE_STAGES, type DealStage } from '@partners/core';
import { Avatar, Badge, cn, TONE_DOT } from '@partners/ui';
import { AskChip, DealValue, DueLabel, money } from '@/components/domain';
import { useMoveStage, type TierChoice } from '@/components/deals/move-stage';
import type { PipelineDeal } from '@/features/deals/queries';

function DealCardBody({
  deal,
  now,
  dragging,
}: {
  deal: PipelineDeal;
  now: Date;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        'border-line bg-surface-1 shadow-card space-y-2 rounded-[var(--radius-md)] border p-3 text-left',
        deal.overdue && 'border-danger/45',
        dragging && 'shadow-overlay rotate-1',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/partners/${deal.partner.id}`}
            className="text-ink hover:text-accent-ink block truncate text-[13.5px] font-semibold leading-5"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {deal.partner.name}
          </Link>
          <p className="text-muted truncate text-[11.5px]">{deal.title}</p>
        </div>
        {deal.owner && <Avatar name={deal.owner.name} size="xs" />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <AskChip askType={deal.askType} short />
        <DealValue
          askType={deal.askType}
          amountMinor={deal.amountMinor}
          tierName={deal.tier?.name}
        />
      </div>
      {deal.nextAction && (
        <div className="text-[12px] leading-4">
          <p className="text-ink-soft line-clamp-2">{deal.nextAction}</p>
          <DueLabel
            due={deal.nextActionDue}
            stage={deal.stage}
            now={now}
            className="text-[11.5px]"
          />
        </div>
      )}
      {deal.stale && (
        <Badge
          tone="warning"
          size="sm"
          title="No note, call, email, meeting or stage change lately"
        >
          <Moon className="size-3" />
          Gone quiet
        </Badge>
      )}
    </div>
  );
}

function DraggableDeal({
  deal,
  now,
  disabled,
}: {
  deal: PipelineDeal;
  now: Date;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-roledescription="Draggable deal"
      aria-label={`${deal.partner.name}, ${deal.title}, ${DEAL_STAGE_LABEL[deal.stage].label}`}
      className={cn(
        'touch-none rounded-[var(--radius-md)] outline-none',
        !disabled && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-35',
      )}
    >
      <DealCardBody deal={deal} now={now} />
    </div>
  );
}

function Column({
  stage,
  deals,
  now,
  canMove,
}: {
  stage: DealStage;
  deals: readonly PipelineDeal[];
  now: Date;
  canMove: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((sum, deal) => sum + (deal.amountMinor ?? 0), 0);
  const descriptor = DEAL_STAGE_LABEL[stage];

  return (
    <section
      ref={setNodeRef}
      aria-label={`${descriptor.label}, ${deals.length} deals`}
      className={cn(
        'bg-surface-2/70 flex w-[17rem] shrink-0 flex-col rounded-[var(--radius-lg)] border border-transparent transition-colors',
        isOver && 'border-accent bg-accent-soft/50',
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <span className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', TONE_DOT[descriptor.tone])} />
          <span className="text-ink text-[13px] font-semibold">{descriptor.label}</span>
          <span className="tabular bg-surface-1 text-muted rounded-full px-1.5 text-[11px] font-medium">
            {deals.length}
          </span>
        </span>
        <span className="tabular text-muted text-[11.5px]" title="Total value in this column">
          {total > 0 ? money(total, true) : ''}
        </span>
      </header>
      <div className="scrollbar-slim flex max-h-[calc(100dvh-17rem)] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {deals.map((deal) => (
          <DraggableDeal key={deal.id} deal={deal} now={now} disabled={!canMove} />
        ))}
        {deals.length === 0 && (
          <p className="text-faint border-line rounded-[var(--radius-md)] border border-dashed px-3 py-6 text-center text-[12px]">
            {canMove ? 'Drop a deal here' : 'No deals'}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * The board. Dragging a card to another column asks the server to move it -
 * through the same `moveStageAction` and rules as every other way of moving a
 * deal - and asks for a tier, a start date or a reason first when the move
 * needs one. The card sits in its new column while that happens and goes back
 * if the move is cancelled or refused.
 */
export function PipelineBoard({
  deals,
  tiers,
  today,
  now,
  canMove,
}: {
  deals: readonly PipelineDeal[];
  tiers: readonly TierChoice[];
  today: string;
  now: Date;
  canMove: boolean;
}) {
  const [overrides, setOverrides] = useState<Record<string, DealStage>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  // Fresh data from the server replaces any optimistic placement.
  useEffect(() => setOverrides({}), [deals]);

  const { request, dialog } = useMoveStage({
    tiers,
    today,
    onSettled: (dealId, ok) => {
      if (ok) return;
      setOverrides((current) => {
        const next = { ...current };
        delete next[dealId];
        return next;
      });
    },
  });

  const sensors = useSensors(
    // A small distance so clicking the partner link is a click, not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const placed = useMemo(
    () => deals.map((deal) => ({ ...deal, stage: overrides[deal.id] ?? deal.stage })),
    [deals, overrides],
  );
  const byStage = useMemo(() => {
    const map = new Map<DealStage, PipelineDeal[]>(PIPELINE_STAGES.map((stage) => [stage, []]));
    for (const deal of placed) map.get(deal.stage)?.push(deal);
    return map;
  }, [placed]);
  const active = activeId ? placed.find((deal) => deal.id === activeId) : undefined;

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const to = event.over?.id as DealStage | undefined;
    const deal = placed.find((item) => item.id === event.active.id);
    if (!to || !deal || deal.stage === to) return;
    setOverrides((current) => ({ ...current, [deal.id]: to }));
    void request(
      {
        id: deal.id,
        title: deal.title,
        partnerName: deal.partner.name,
        askType: deal.askType,
        stage: deal.stage,
        tierId: deal.tierId,
      },
      to,
    );
  };

  return (
    <>
      <DndContext
        id="pipeline-board"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active: a }) =>
              `Picked up ${placed.find((d) => d.id === a.id)?.partner.name ?? 'deal'}.`,
            onDragOver: ({ over }) =>
              over ? `Over ${DEAL_STAGE_LABEL[over.id as DealStage].label}.` : 'Not over a stage.',
            onDragEnd: ({ over }) =>
              over ? `Dropped in ${DEAL_STAGE_LABEL[over.id as DealStage].label}.` : 'Dropped.',
            onDragCancel: () => 'Move cancelled.',
          },
        }}
      >
        <div className="scrollbar-slim -mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-3">
            {PIPELINE_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                deals={byStage.get(stage) ?? []}
                now={now}
                canMove={canMove}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="w-[16rem]">
              <DealCardBody deal={active} now={now} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {dialog}
    </>
  );
}
