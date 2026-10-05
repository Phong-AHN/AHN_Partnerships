'use client';

import { Download, LayoutGrid, Rows3 } from 'lucide-react';
import {
  ASK_TYPE_LABEL,
  ASK_TYPES,
  DEAL_STAGE_LABEL,
  ENTITIES,
  ENTITY_LABEL,
  PIPELINE_STAGES,
  PRIORITIES,
  PRIORITY_LABEL,
  SECTORS,
  SECTOR_LABEL,
} from '@partners/core';
import { cn } from '@partners/ui';
import {
  FilterRow,
  ResetFilters,
  SearchFilter,
  SelectFilter,
  useUrlFilters,
} from '@/components/url-filters';
import type { UserOption } from '@/features/users/queries';

export function PipelineFilters({
  users,
  years,
  view,
  total,
}: {
  users: readonly UserOption[];
  years: readonly number[];
  view: 'board' | 'table';
  total: number;
}) {
  const { params, set, clear, pending } = useUrlFilters();
  const filtered = [...params.keys()].some((key) => key !== 'view');

  return (
    <div className="space-y-2">
      <FilterRow pending={pending}>
        <SearchFilter
          value={params.get('q') ?? ''}
          placeholder="Partner, deal or next action"
          onCommit={(value) => set('q', value)}
        />
        <SelectFilter
          label="Sector"
          value={params.get('sector') ?? ''}
          allLabel="All sectors"
          options={SECTORS.map((value) => ({ value, label: SECTOR_LABEL[value].label }))}
          onChange={(value) => set('sector', value)}
        />
        <SelectFilter
          label="Priority"
          value={params.get('priority') ?? ''}
          allLabel="Any priority"
          options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABEL[value].label }))}
          onChange={(value) => set('priority', value)}
        />
        <SelectFilter
          label="Ask"
          value={params.get('ask') ?? ''}
          allLabel="Any ask"
          options={ASK_TYPES.map((value) => ({ value, label: ASK_TYPE_LABEL[value].label }))}
          onChange={(value) => set('ask', value)}
        />
        <SelectFilter
          label="Owner"
          value={params.get('owner') ?? ''}
          allLabel="Any owner"
          options={[
            { value: 'me', label: 'Mine' },
            { value: 'none', label: 'Unassigned' },
            ...users.map((user) => ({ value: user.id, label: user.name })),
          ]}
          onChange={(value) => set('owner', value)}
        />
        <SelectFilter
          label="Entity"
          value={params.get('entity') ?? ''}
          allLabel="AHN & AHNF"
          options={ENTITIES.map((value) => ({ value, label: ENTITY_LABEL[value].label }))}
          onChange={(value) => set('entity', value)}
        />
        <SelectFilter
          label="Year"
          value={params.get('year') ?? ''}
          allLabel="All years"
          options={years.map((year) => ({ value: String(year), label: String(year) }))}
          onChange={(value) => set('year', value)}
        />
        <SelectFilter
          label="Follow-up"
          value={params.get('due') ?? ''}
          allLabel="Any follow-up"
          options={[
            { value: 'overdue', label: 'Overdue' },
            { value: 'week', label: 'Due within 7 days' },
            { value: 'stale', label: 'Gone quiet' },
          ]}
          onChange={(value) => set('due', value)}
        />
        {view === 'table' && (
          <SelectFilter
            label="Stage"
            value={params.get('stage') ?? ''}
            allLabel="All stages"
            options={PIPELINE_STAGES.map((value) => ({
              value,
              label: DEAL_STAGE_LABEL[value].label,
            }))}
            onChange={(value) => set('stage', value)}
          />
        )}
      </FilterRow>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted text-[12.5px] tabular-nums">
          {total} deal{total === 1 ? '' : 's'}
        </span>
        <ResetFilters visible={filtered} onReset={() => clear(['view'])} />
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/api/export${params.toString() ? `?${params.toString()}` : ''}`}
            className="border-line bg-surface-1 text-muted hover:text-ink hover:border-line-strong inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors"
          >
            <Download className="size-3.5" />
            Export CSV
          </a>
          <div className="border-line bg-surface-1 flex items-center rounded-[var(--radius-md)] border p-0.5">
            {(
              [
                ['board', LayoutGrid, 'Board'],
                ['table', Rows3, 'Table'],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => set('view', value === 'board' ? null : value)}
                aria-pressed={view === value}
                className={cn(
                  'flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                  view === value ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:text-ink',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
