import { NextResponse } from 'next/server';
import { clock, ForbiddenError, toAppError } from '@partners/core';
import { can } from '@partners/rbac';
import { parsePipelineFilters } from '@/features/deals/queries';
import { buildPipelineCsv } from '@/features/import/export';
import { requirePrincipal } from '@/server/session';

/**
 * The pipeline as CSV. Reads the same query string as `/pipeline`, so the
 * "Export CSV" button there downloads exactly the filtered view on screen;
 * with no filters it is the whole partner list.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const principal = await requirePrincipal();
    if (!can(principal, 'workspace:read')) throw new ForbiddenError();

    const params: Record<string, string> = {};
    for (const [key, value] of new URL(request.url).searchParams) {
      if (key !== 'view' && key !== 'due') params[key] = value;
    }
    const filters =
      Object.keys(params).length > 0 ? parsePipelineFilters(params, principal.id) : null;
    const csv = buildPipelineCsv(filters);
    const filename = `ahn-partnerships-${clock.now().toISOString().slice(0, 10)}.csv`;

    // A UTF-8 BOM so Excel opens accented names correctly.
    return new Response(String.fromCharCode(0xfeff) + (await csv), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(appError.toJSON(), { status: appError.status });
  }
}
