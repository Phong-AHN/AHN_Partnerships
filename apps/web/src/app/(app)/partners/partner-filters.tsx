'use client';

import { PRIORITIES, PRIORITY_LABEL, SECTORS, SECTOR_LABEL } from '@partners/core';
import { Checkbox } from '@partners/ui';
import {
  FilterRow,
  ResetFilters,
  SearchFilter,
  SelectFilter,
  useUrlFilters,
} from '@/components/url-filters';

export function PartnerFilters({ total }: { total: number }) {
  const { params, set, clear, pending } = useUrlFilters();

  return (
    <FilterRow pending={pending}>
      <SearchFilter
        value={params.get('q') ?? ''}
        placeholder="Partner, contact or keyword"
        onCommit={(value) => set('q', value)}
      />
      <SelectFilter
        label="Sector"
        value={params.get('sector') ?? ''}
        allLabel="All sectors"
        options={SECTORS.map((sector) => ({ value: sector, label: SECTOR_LABEL[sector].label }))}
        onChange={(value) => set('sector', value)}
      />
      <SelectFilter
        label="Priority"
        value={params.get('priority') ?? ''}
        allLabel="Any priority"
        options={PRIORITIES.map((priority) => ({
          value: priority,
          label: PRIORITY_LABEL[priority].label,
        }))}
        onChange={(value) => set('priority', value)}
      />
      <Checkbox
        id="filter-archived"
        label="Archived"
        checked={params.get('archived') === '1'}
        onChange={(event) => set('archived', event.target.checked ? '1' : null)}
        className="py-1.5"
      />
      <ResetFilters visible={params.toString().length > 0} onReset={() => clear()} />
      <span className="text-muted ml-auto text-[12.5px] tabular-nums">
        {total} partner{total === 1 ? '' : 's'}
      </span>
    </FilterRow>
  );
}
