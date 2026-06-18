import { PrismaService } from '../prisma.service';

export const GATEWAY_ONE_ID = 'UPI1';
export const GATEWAY_TWO_ID = 'UPI2';
export const GATEWAY_THREE_ID = 'UPI3';
export const GATEWAY_ONE_LABEL = 'UPI Gateway 1';
export const GATEWAY_TWO_LABEL = 'UPI Gateway 2';
export const GATEWAY_THREE_LABEL = 'UPI Gateway 3';
export const MAX_GATEWAY_RETRIES = 0;

const GATEWAY_LABELS = [GATEWAY_ONE_LABEL, GATEWAY_TWO_LABEL, GATEWAY_THREE_LABEL];

type RetryAwareTransaction = {
  id: number;
  utr: string | null;
  amount: number;
  paymentMethod: string | null;
  paymentDetails: unknown;
  createdAt: Date;
};

type RetryPaymentDetails = {
  retryGroupId?: string;
  gatewayRetryAttempt?: number;
};

export interface GatewayRetryState {
  hasPendingGatewayPayment: boolean;
  forceManual: boolean;
  maxGatewayRetries: number;
  gatewayRetryCount: number;
  retryGroupId: string | null;
  suggestedGatewayId: string | null;
  pendingTransaction: {
    id: number;
    utr: string | null;
    amount: number;
    paymentMethod: string | null;
    createdAt: string;
  } | null;
  message: string;
}

export interface GatewayRetryContext {
  manualRequired: boolean;
  retryState: GatewayRetryState;
  retryGroupId: string;
  gatewayRetryAttempt: number;
  previousPendingTransactionId: number | null;
  previousPendingUtr: string | null;
}

const readPaymentDetails = (paymentDetails: unknown): RetryPaymentDetails => {
  if (
    !paymentDetails ||
    typeof paymentDetails !== 'object' ||
    Array.isArray(paymentDetails)
  ) {
    return {};
  }
  return paymentDetails as RetryPaymentDetails;
};

const getRetryGroupId = (txn: RetryAwareTransaction) => {
  const paymentDetails = readPaymentDetails(txn.paymentDetails);
  return paymentDetails.retryGroupId || txn.utr || `txn-${txn.id}`;
};

const getGatewayIdFromPaymentMethod = (paymentMethod?: string | null) => {
  if (paymentMethod === GATEWAY_ONE_LABEL) return GATEWAY_ONE_ID;
  if (paymentMethod === GATEWAY_TWO_LABEL) return GATEWAY_TWO_ID;
  if (paymentMethod === GATEWAY_THREE_LABEL) return GATEWAY_THREE_ID;
  return null;
};

export async function getGatewayRetryState(
  prisma: PrismaService,
  userId: number,
): Promise<GatewayRetryState> {

  const CLEAR_STATE: GatewayRetryState = {
    hasPendingGatewayPayment: false,
    forceManual: false,
    maxGatewayRetries: MAX_GATEWAY_RETRIES,
    gatewayRetryCount: 0,
    retryGroupId: null,
    suggestedGatewayId: null,
    pendingTransaction: null,
    message: '',
  };

  // Only consider gateway PENDING txns from the last 24 hours (stale = irrelevant)
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const latestPendingGatewayTxn = await prisma.transaction.findFirst({
    where: {
      userId,
      type: 'DEPOSIT',
      status: 'PENDING',
      paymentMethod: { in: GATEWAY_LABELS },
      createdAt: { gte: cutoffTime },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestPendingGatewayTxn) {
    return CLEAR_STATE;
  }

  // ── Auto-resolve: if user submitted a manual deposit AFTER this gateway txn,
  // it means they already handled it via manual UPI — treat gateway as clear.
  const newerManualDeposit = await prisma.transaction.findFirst({
    where: {
      userId,
      type: 'DEPOSIT',
      // Any non-gateway, non-crypto payment (manual, account payment names, etc.)
      paymentMethod: { notIn: [...GATEWAY_LABELS, 'nowpayments', 'crypto'] },
      createdAt: { gt: latestPendingGatewayTxn.createdAt },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (newerManualDeposit) {
    // User already paid manually after the stale gateway attempt — auto-cancel the gateway txn
    await prisma.transaction.update({
      where: { id: latestPendingGatewayTxn.id },
      data: {
        status: 'REJECTED',
        remarks: `Auto-cancelled: superseded by manual deposit (txnId: ${newerManualDeposit.id}, utr: ${newerManualDeposit.utr || 'N/A'})`,
      },
    }).catch(() => { /* non-fatal */ });
    return CLEAR_STATE;
  }

  const retryGroupId = getRetryGroupId(latestPendingGatewayTxn);
  const gatewayTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEPOSIT',
      paymentMethod: { in: GATEWAY_LABELS },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  const attemptsInSameGroup = gatewayTransactions.filter(
    (txn) => getRetryGroupId(txn) === retryGroupId,
  );
  const totalGatewayAttempts = attemptsInSameGroup.length || 1;
  const gatewayRetryCount = Math.max(0, totalGatewayAttempts - 1);
  const forceManual = gatewayRetryCount >= MAX_GATEWAY_RETRIES;
  const pendingGatewayId = getGatewayIdFromPaymentMethod(
    latestPendingGatewayTxn.paymentMethod,
  );
  const suggestedGatewayId =
    pendingGatewayId === GATEWAY_ONE_ID
      ? GATEWAY_TWO_ID
      : pendingGatewayId === GATEWAY_TWO_ID
        ? GATEWAY_THREE_ID
        : pendingGatewayId === GATEWAY_THREE_ID
          ? GATEWAY_ONE_ID
          : null;

  return {
    hasPendingGatewayPayment: true,
    forceManual,
    maxGatewayRetries: MAX_GATEWAY_RETRIES,
    gatewayRetryCount,
    retryGroupId,
    suggestedGatewayId,
    pendingTransaction: {
      id: latestPendingGatewayTxn.id,
      utr: latestPendingGatewayTxn.utr,
      amount: latestPendingGatewayTxn.amount,
      paymentMethod: latestPendingGatewayTxn.paymentMethod,
      createdAt: latestPendingGatewayTxn.createdAt.toISOString(),
    },
    message:
      'Your last gateway payment is still pending. Please continue with Manual UPI for the next retry.',
  };
}

export async function buildGatewayRetryContext(
  prisma: PrismaService,
  userId: number,
  currentOrderNo: string,
): Promise<GatewayRetryContext> {
  const retryState = await getGatewayRetryState(prisma, userId);

  if (!retryState.hasPendingGatewayPayment) {
    return {
      manualRequired: false,
      retryState,
      retryGroupId: currentOrderNo,
      gatewayRetryAttempt: 0,
      previousPendingTransactionId: null,
      previousPendingUtr: null,
    };
  }

  return {
    manualRequired: retryState.forceManual,
    retryState,
    retryGroupId: retryState.retryGroupId || currentOrderNo,
    gatewayRetryAttempt: retryState.gatewayRetryCount + 1,
    previousPendingTransactionId: retryState.pendingTransaction?.id ?? null,
    previousPendingUtr: retryState.pendingTransaction?.utr ?? null,
  };
}
