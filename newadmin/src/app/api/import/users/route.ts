import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { Role, KycStatus } from '@prisma/client';

// POST /api/import/users
//
// multipart/form-data:
//   file     CSV file — first row = headers, subsequent rows = user records
//   mode     'create' | 'upsert'   (create = skip existing, upsert = update existing)
//   dryRun   'true' | 'false'
//
// Match priority (row → existing user): email → phoneNumber → username.
// Password column is optional; if missing/blank and a new user is being created,
// a random 16-char password is generated and returned in the report so the admin
// can distribute credentials out-of-band.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Columns that may appear in the CSV and map 1:1 to User fields. Any extras are
// silently ignored so you can import CSVs produced by /api/export/users without
// stripping read-only columns (id, createdAt, updatedAt, etc.).
const STRING_FIELDS = new Set<string>([
  'email',
  'phoneNumber',
  'username',
  'firstName',
  'lastName',
  'city',
  'country',
  'currency',
  'onesignalPlayerId',
  'bonus_id',
  'activeWallet',
  'referralCode',
]);
const BOOLEAN_FIELDS = new Set<string>(['isBanned']);
const NUMBER_FIELDS = new Set<string>([
  'balance',
  'exposure',
  'fiatBonus',
  'cryptoBonus',
  'casinoBonus',
  'sportsBonus',
  'cryptoBalance',
  'wageringRequired',
  'wageringDone',
  'casinoBonusWageringRequired',
  'casinoBonusWageringDone',
  'sportsBonusWageringRequired',
  'sportsBonusWageringDone',
  'depositWageringRequired',
  'depositWageringDone',
  'totalDeposited',
  'totalWagered',
  'depositLimit',
  'lossLimit',
]);
const INT_FIELDS = new Set<string>(['referrerId', 'agentId', 'masterId', 'managerId']);
const DATE_FIELDS = new Set<string>(['selfExclusionUntil', 'createdAt']);

// ── Tiny RFC 4180 CSV parser ──────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
    } else {
      if (c === '"') {
        inQuotes = true;
        i += 1;
      } else if (c === ',') {
        row.push(field);
        field = '';
        i += 1;
      } else if (c === '\r') {
        // swallow \r — handled with \n
        i += 1;
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        field = '';
        row = [];
        i += 1;
      } else {
        field += c;
        i += 1;
      }
    }
  }
  // Flush trailing cell/row if no terminating newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function genRandomPassword(len = 16): string {
  return crypto.randomBytes(len).toString('base64url').slice(0, len);
}

function coerce(col: string, raw: string): any {
  const v = raw == null ? '' : raw.trim();
  if (v === '' || v.toLowerCase() === 'null') return null;
  if (STRING_FIELDS.has(col)) return v;
  if (BOOLEAN_FIELDS.has(col)) return ['true', '1', 'yes', 'y', 't'].includes(v.toLowerCase());
  if (NUMBER_FIELDS.has(col)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (INT_FIELDS.has(col)) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (DATE_FIELDS.has(col)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (col === 'role') {
    const r = v.toUpperCase();
    return (Object.values(Role) as string[]).includes(r) ? (r as Role) : null;
  }
  if (col === 'kycStatus') {
    const s = v.toUpperCase();
    return (Object.values(KycStatus) as string[]).includes(s) ? (s as KycStatus) : null;
  }
  if (col === 'partnershipSettings') {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

type ImportResult = {
  summary: {
    total: number;
    created: number;
    updated: number;
    skippedExisting: number;
    errors: number;
    dryRun: boolean;
    mode: 'create' | 'upsert';
  };
  generatedPasswords: Array<{ row: number; username: string | null; email: string | null; password: string }>;
  errorsList: Array<{ row: number; reason: string; data?: Record<string, any> }>;
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const mode = ((form.get('mode') as string) || 'create').toLowerCase() as 'create' | 'upsert';
    const dryRun = String(form.get('dryRun') || 'false').toLowerCase() === 'true';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing `file` field (CSV)' }, { status: 400 });
    }
    if (mode !== 'create' && mode !== 'upsert') {
      return NextResponse.json({ error: 'mode must be create or upsert' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text).filter((r) => r.some((c) => c.trim().length > 0));
    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV must contain a header row and at least one data row' }, { status: 400 });
    }

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);

    const result: ImportResult = {
      summary: {
        total: dataRows.length,
        created: 0,
        updated: 0,
        skippedExisting: 0,
        errors: 0,
        dryRun,
        mode,
      },
      generatedPasswords: [],
      errorsList: [],
    };

    // Pre-hash passwords OUTSIDE the transaction so bcrypt's CPU cost doesn't
    // eat into Prisma's interactive transaction timeout.
    const preHashedPasswords: Map<number, { hash: string; plain?: string }> = new Map();
    for (let i = 0; i < dataRows.length; i++) {
      const pwIdx = headers.indexOf('password');
      const providedPassword = pwIdx >= 0 ? (dataRows[i][pwIdx] || '').trim() : '';
      let plainPw = providedPassword;
      if (!plainPw) {
        plainPw = genRandomPassword(16);
        preHashedPasswords.set(i, { hash: await bcrypt.hash(plainPw, 10), plain: plainPw });
      } else {
        preHashedPasswords.set(i, { hash: await bcrypt.hash(plainPw, 10) });
      }
    }

    // Process row-by-row inside a transaction when applying, so a mid-file error
    // doesn't leave a half-imported state.
    const doRow = async (client: Prisma.TransactionClient, rowIdx: number, cells: string[]) => {
      const record: Record<string, any> = {};
      headers.forEach((h, i) => {
        record[h] = cells[i] ?? '';
      });

      // Resolve matching user (email → phoneNumber → username).
      const email = (record.email || '').trim() || null;
      const phoneNumber = (record.phoneNumber || '').trim() || null;
      const username = (record.username || '').trim() || null;

      if (!email && !phoneNumber && !username) {
        throw new Error('Row has no email, phoneNumber, or username — cannot identify user');
      }

      let existing = null;
      if (email) existing = await client.user.findUnique({ where: { email } });
      if (!existing && phoneNumber) existing = await client.user.findUnique({ where: { phoneNumber } });
      if (!existing && username) existing = await client.user.findUnique({ where: { username } });

      // Build the data object from the CSV, filtered to the columns we support.
      const data: Record<string, any> = {};
      for (const h of headers) {
        if (h === 'id' || h === 'updatedAt') continue; // read-only
        if (h === 'password') continue; // handled separately
        if (
          STRING_FIELDS.has(h) ||
          BOOLEAN_FIELDS.has(h) ||
          NUMBER_FIELDS.has(h) ||
          INT_FIELDS.has(h) ||
          DATE_FIELDS.has(h) ||
          h === 'role' ||
          h === 'kycStatus' ||
          h === 'partnershipSettings'
        ) {
          const v = coerce(h, record[h] ?? '');
          if (v !== null && v !== undefined) data[h] = v;
        }
      }

      const preHashed = preHashedPasswords.get(rowIdx)!;

      if (existing) {
        if (mode === 'create') {
          result.summary.skippedExisting += 1;
          return;
        }
        // upsert: update
        const updateData: any = { ...data };
        const providedPassword = (record.password || '').trim();
        if (providedPassword) {
          updateData.password = preHashed.hash;
        }
        if (!dryRun) {
          await client.user.update({ where: { id: existing.id }, data: updateData });
        }
        result.summary.updated += 1;
      } else {
        // create
        const createData: any = { ...data };
        if (preHashed.plain) {
          result.generatedPasswords.push({
            row: rowIdx + 2, // +1 for 0-index, +1 for header row
            username,
            email,
            password: preHashed.plain,
          });
        }
        createData.password = preHashed.hash;
        // Required fields safety
        if (!createData.role) createData.role = Role.USER;
        if (!createData.currency) createData.currency = 'INR';
        if (!createData.activeWallet) createData.activeWallet = 'fiat';
        if (!dryRun) {
          await client.user.create({ data: createData });
        }
        result.summary.created += 1;
      }
    };

    if (dryRun) {
      // Dry run — don't wrap in a transaction, just validate row by row.
      for (let i = 0; i < dataRows.length; i++) {
        try {
          await doRow(prisma as any, i, dataRows[i]);
        } catch (e: any) {
          result.summary.errors += 1;
          result.errorsList.push({ row: i + 2, reason: e.message || String(e) });
        }
      }
    } else {
      // Apply — process rows in small transactions of 200 at a time so one bad row
      // doesn't abort the entire import, but work stays transactional in chunks.
      const CHUNK = 50;
      for (let start = 0; start < dataRows.length; start += CHUNK) {
        const slice = dataRows.slice(start, start + CHUNK);
        try {
          await prisma.$transaction(async (tx) => {
            for (let j = 0; j < slice.length; j++) {
              const rowIdx = start + j;
              try {
                await doRow(tx, rowIdx, slice[j]);
              } catch (e: any) {
                result.summary.errors += 1;
                result.errorsList.push({ row: rowIdx + 2, reason: e.message || String(e) });
              }
            }
          }, { timeout: 30000 });
        } catch (txErr: any) {
          // Whole chunk failed — rollback + mark all rows in chunk as errored.
          result.summary.errors += slice.length;
          for (let j = 0; j < slice.length; j++) {
            result.errorsList.push({
              row: start + j + 2,
              reason: `chunk transaction aborted: ${txErr.message || String(txErr)}`,
            });
          }
        }
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[import/users] failed:', err);
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
  }
}
