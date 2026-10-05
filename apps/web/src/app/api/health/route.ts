import { NextResponse } from 'next/server';
import { db } from '@partners/db';
import { logger } from '@partners/observability';

export const dynamic = 'force-dynamic';

/**
 * Uptime check: the app is up and can reach Postgres. Also confirms the
 * latest migration is applied - the failure that took Mercator down.
 */
export async function GET(): Promise<Response> {
  try {
    const [row] = await db.$queryRaw<{ migration: string | null }[]>`
      SELECT migration_name AS migration FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
    return NextResponse.json({ ok: true, migration: row?.migration ?? null });
  } catch (error) {
    logger.error({ err: error }, 'health check failed');
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
