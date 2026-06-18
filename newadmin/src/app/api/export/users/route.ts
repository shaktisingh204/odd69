import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// Streaming CSV export for Users. Returns EVERY column on the `User` table so admins
// can pull the full record. Query params mirror the users list page filters:
//   search  free text (username / email / phone)
//   role    Role value or 'ALL'
//   status  'ACTIVE' | 'BANNED' | 'ALL'
//
// No server-action payload limit because this is a route handler, and rows are
// streamed in batches of 2000 to keep memory bounded.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function csvEscape(v: unknown): string {
  let s: string;
  if (v == null) s = '';
  else if (v instanceof Date) s = v.toISOString();
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const search = sp.get('search') || '';
    const role = sp.get('role') || '';
    const status = sp.get('status') || '';

    const where: Prisma.UserWhereInput = {};
    const andClauses: Prisma.UserWhereInput[] = [];

    if (search) {
      andClauses.push({
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (role && role !== 'ALL') {
      andClauses.push({ role: role as any });
    }
    if (status === 'BANNED') andClauses.push({ isBanned: true });
    else if (status === 'ACTIVE') andClauses.push({ isBanned: false });

    if (andClauses.length) where.AND = andClauses;

    // Pull one row to discover the column set dynamically so newly added columns get
    // exported automatically without needing to keep this file in sync.
    const sample = await prisma.user.findFirst({ where, orderBy: { id: 'asc' } });
    const baseColumns = sample
      ? Object.keys(sample).filter((k) => {
          const v = (sample as any)[k];
          return v == null || typeof v !== 'object' || v instanceof Date;
        })
      : [
          'id',
          'email',
          'phoneNumber',
          'username',
          'firstName',
          'lastName',
          'role',
          'balance',
          'isBanned',
          'createdAt',
        ];

    const BATCH_SIZE = 2000;
    const encoder = new TextEncoder();
    let lastId = 0;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Header row
        controller.enqueue(encoder.encode(baseColumns.map(csvEscape).join(',') + '\n'));
        try {
          while (true) {
            const rows = await prisma.user.findMany({
              where: { AND: [where, { id: { gt: lastId } }] },
              orderBy: { id: 'asc' },
              take: BATCH_SIZE,
            });
            if (rows.length === 0) break;

            const chunks: string[] = [];
            for (const u of rows) {
              const line = baseColumns
                .map((col) => csvEscape((u as any)[col]))
                .join(',');
              chunks.push(line);
            }
            controller.enqueue(encoder.encode(chunks.join('\n') + '\n'));

            lastId = rows[rows.length - 1].id;
            if (rows.length < BATCH_SIZE) break;
          }
          controller.close();
        } catch (err) {
          console.error('[export/users] stream error:', err);
          controller.error(err);
        }
      },
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users_full_${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[export/users] failed:', err);
    return new Response('Export failed', { status: 500 });
  }
}
