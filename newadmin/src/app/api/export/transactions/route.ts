import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// Streaming CSV export for Transactions (DEPOSIT / WITHDRAWAL / ALL).
// Route handlers in Next.js have no server-action body-size limit, so this returns
// the full filtered set — not just the current page — regardless of how many rows.
//
// Query params mirror what the finance pages pass to `getTransactionsFiltered`:
//   type           'DEPOSIT' | 'WITHDRAWAL' | 'ALL' (default 'ALL')
//   search         free text
//   status         'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'ALL'
//   methodFilter   'UPI' | 'BANK' | 'CRYPTO' | 'MANUAL' | 'ALL'
//   currencyFilter 'FIAT' | 'CRYPTO' | 'ALL'
//   dateFrom, dateTo   ISO dates
//   amountMin, amountMax

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CSV_HEADERS = [
  'ID',
  'User',
  'Email',
  'Phone',
  'Type',
  'Amount',
  'Status',
  'Method',
  'UTR',
  'TxnID',
  'Remarks',
  'PaymentDetails',
  'Date',
];

function csvEscape(v: unknown): string {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = (sp.get('type') || 'ALL').toUpperCase();
    const search = sp.get('search') || '';
    const status = sp.get('status') || '';
    const methodFilter = sp.get('methodFilter') || '';
    const currencyFilter = sp.get('currencyFilter') || 'ALL';
    const dateFrom = sp.get('dateFrom') || '';
    const dateTo = sp.get('dateTo') || '';
    const amountMin = sp.get('amountMin') || '';
    const amountMax = sp.get('amountMax') || '';

    // Build the same `where` clause as `getTransactionsFiltered`.
    const where: Prisma.TransactionWhereInput = {};
    where.NOT = { type: 'BONUS_CONVERT_REVERSED' };

    if (search) {
      where.OR = [
        { utr: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
        { paymentMethod: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phoneNumber: { contains: search, mode: 'insensitive' } } },
        { paymentDetails: { path: ['upiId'], string_contains: search } },
        { paymentDetails: { path: ['receive_account'], string_contains: search } },
        { paymentDetails: { path: ['acctNo'], string_contains: search } },
        { paymentDetails: { path: ['accountNo'], string_contains: search } },
        { paymentDetails: { path: ['ifsc'], string_contains: search } },
        { paymentDetails: { path: ['holderName'], string_contains: search } },
        { paymentDetails: { path: ['address'], string_contains: search } },
      ];
    }

    if (status && status !== 'ALL') {
      if (type === 'DEPOSIT' && status === 'COMPLETED') {
        where.status = { in: ['COMPLETED', 'APPROVED'] };
      } else {
        where.status = status;
      }
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (currencyFilter === 'FIAT') {
      where.NOT = {
        OR: [
          { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
          { paymentMethod: { startsWith: 'CRYPTO_' } },
        ],
      };
    } else if (currencyFilter === 'CRYPTO') {
      where.OR = [
        { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
        { paymentMethod: { startsWith: 'CRYPTO_' } },
      ];
    }

    const andClauses: Prisma.TransactionWhereInput[] = [];

    if (methodFilter && methodFilter !== 'ALL') {
      if (methodFilter === 'UPI') {
        andClauses.push({ paymentMethod: { contains: 'upi', mode: 'insensitive' } });
      } else if (methodFilter === 'BANK') {
        andClauses.push({
          OR: [
            { paymentMethod: { contains: 'bank', mode: 'insensitive' } },
            { paymentMethod: { contains: 'neft', mode: 'insensitive' } },
            { paymentMethod: { contains: 'imps', mode: 'insensitive' } },
          ],
        });
      } else if (methodFilter === 'CRYPTO') {
        andClauses.push({
          OR: [
            { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
            { paymentMethod: { contains: 'crypto', mode: 'insensitive' } },
          ],
        });
      } else if (methodFilter === 'MANUAL') {
        andClauses.push({ paymentMethod: { contains: 'manual', mode: 'insensitive' } });
      }
    }

    if (dateFrom || dateTo) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        createdAtFilter.lte = endDate;
      }
      andClauses.push({ createdAt: createdAtFilter });
    }

    if (amountMin || amountMax) {
      const amountFilter: { gte?: number; lte?: number } = {};
      if (amountMin) amountFilter.gte = parseFloat(amountMin);
      if (amountMax) amountFilter.lte = parseFloat(amountMax);
      andClauses.push({ amount: amountFilter });
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    // Stream the result out in batches so memory stays bounded for very large exports.
    const BATCH_SIZE = 2000;
    const encoder = new TextEncoder();
    let lastId: number | null = null;
    let rowCount = 0;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(CSV_HEADERS.map(csvEscape).join(',') + '\n'));
        try {
          while (true) {
            const rows = await prisma.transaction.findMany({
              where: lastId == null ? where : { AND: [where, { id: { lt: lastId } }] },
              orderBy: { id: 'desc' },
              take: BATCH_SIZE,
              include: {
                user: { select: { username: true, email: true, phoneNumber: true } },
              },
            });
            if (rows.length === 0) break;

            const chunks: string[] = [];
            for (const tx of rows) {
              const line = [
                tx.id,
                tx.user?.username || '',
                tx.user?.email || '',
                tx.user?.phoneNumber || '',
                tx.type,
                tx.amount,
                tx.status,
                tx.paymentMethod || '',
                tx.utr || '',
                tx.transactionId || '',
                tx.remarks || '',
                tx.paymentDetails || '',
                new Date(tx.createdAt).toISOString(),
              ]
                .map(csvEscape)
                .join(',');
              chunks.push(line);
            }
            controller.enqueue(encoder.encode(chunks.join('\n') + '\n'));
            rowCount += rows.length;
            lastId = rows[rows.length - 1].id;
            if (rows.length < BATCH_SIZE) break;
          }
          controller.close();
        } catch (err) {
          console.error('[export/transactions] stream error:', err);
          controller.error(err);
        }
      },
    });

    const label =
      type === 'DEPOSIT' ? 'deposits' : type === 'WITHDRAWAL' ? 'withdrawals' : 'transactions';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${label}_${stamp}.csv`;

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Export-Rows': String(rowCount), // set after streaming, may not reach client
      },
    });
  } catch (err) {
    console.error('[export/transactions] failed:', err);
    return new Response('Export failed', { status: 500 });
  }
}
