import { spawnSync } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

type RepairStep = {
  label: string;
  scriptName: string;
  args: string[];
};

function parseArgs() {
  const args = process.argv.slice(2);
  const hasFlag = (flag: string) => args.includes(flag);
  const getValue = (name: string) => {
    const exact = args.find((arg) => arg.startsWith(`${name}=`));
    return exact ? exact.slice(name.length + 1) : undefined;
  };

  return {
    apply: hasFlag('--apply'),
    allowNegative: hasFlag('--allow-negative'),
    wageringMultiplier: getValue('--wageringMultiplier')
      ? Number(getValue('--wageringMultiplier'))
      : 5,
    userId: getValue('--userId') ? Number(getValue('--userId')) : undefined,
    limit: getValue('--limit') ? Number(getValue('--limit')) : undefined,
  };
}

function runStep(step: RepairStep) {
  const backendRoot = path.join(__dirname, '../..');
  const scriptPath = path.join(__dirname, step.scriptName);

  console.log(`[WalletHistoryRepair] Running ${step.label}...`);
  console.log(
    `[WalletHistoryRepair] node -r ts-node/register ${step.scriptName} ${step.args.join(' ')}`.trim(),
  );

  const result = spawnSync(
    process.execPath,
    ['-r', 'ts-node/register', scriptPath, ...step.args],
    {
      cwd: backendRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    throw new Error(`${step.label} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function buildSharedArgs(params: {
  apply: boolean;
  allowNegative: boolean;
  wageringMultiplier: number;
  userId?: number;
  limit?: number;
}) {
  const args: string[] = [];

  if (params.apply) args.push('--apply');
  if (params.allowNegative) args.push('--allow-negative');
  if (Number.isFinite(params.wageringMultiplier)) {
    args.push(`--wageringMultiplier=${params.wageringMultiplier}`);
  }
  if (typeof params.userId === 'number' && Number.isFinite(params.userId)) {
    args.push(`--userId=${params.userId}`);
  }
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    args.push(`--limit=${params.limit}`);
  }

  return args;
}

async function main() {
  const { apply, allowNegative, wageringMultiplier, userId, limit } = parseArgs();

  console.log(`[WalletHistoryRepair] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('[WalletHistoryRepair] Synthetic transaction logs: DISABLED');
  console.log(`[WalletHistoryRepair] Wagering multiplier for repaired bonus tracking: ${wageringMultiplier}x`);
  if (allowNegative) {
    console.log('[WalletHistoryRepair] Negative-balance correction: ENABLED');
  }
  if (userId) console.log(`[WalletHistoryRepair] Scoped to userId=${userId}`);
  if (limit) console.log(`[WalletHistoryRepair] Limit=${limit}`);

  const sharedArgs = buildSharedArgs({
    apply,
    allowNegative,
    wageringMultiplier,
    userId,
    limit,
  });

  const steps: RepairStep[] = [
    {
      label: 'sports bonus transaction repair',
      scriptName: 'repair-sports-bonus-transactions.ts',
      args: sharedArgs,
    },
    {
      label: 'bonus convert recovery',
      scriptName: 'repair-bonus-convert-recovery.ts',
      args: sharedArgs,
    },
    {
      label: 'bonus wallet backfill',
      scriptName: 'backfill-bonus-wallets.ts',
      args: [
        ...(apply ? ['--apply'] : []),
        '--no-log',
        ...(typeof userId === 'number' ? [`--userId=${userId}`] : []),
        ...(typeof limit === 'number' ? [`--limit=${limit}`] : []),
      ],
    },
    {
      label: 'wallet stabilization',
      scriptName: 'stabilize-repaired-wallets.ts',
      args: [
        ...(apply ? ['--apply'] : []),
        ...(typeof userId === 'number' ? [`--userId=${userId}`] : []),
        ...(typeof limit === 'number' ? [`--limit=${limit}`] : []),
      ],
    },
  ];

  for (const step of steps) {
    runStep(step);
  }

  console.log(`[WalletHistoryRepair] Complete. mode=${apply ? 'APPLY' : 'DRY-RUN'}`);
}

main().catch((error) => {
  console.error('[WalletHistoryRepair] Failed:', error);
  process.exitCode = 1;
});
