import * as crypto from 'crypto';

/**
 * Payment-gateway handoff token.
 *
 * The legacy implementation sent a base64-encoded JSON blob containing
 * { orderNo, amount, userId, returnUrl } in the URL to an external PHP
 * gateway page. That is reversible and user_id-tamperable.
 *
 * IMPORTANT: The backend never trusts this token for crediting — credit
 * is driven by the PENDING transaction looked up via orderNo. The token
 * is display-only input for the external gateway page.
 *
 * Changes here:
 *  - userId is removed from the payload (not needed by gateway UI).
 *  - Payload is HMAC-signed with PAYMENT_TOKEN_SECRET so any modification
 *    is detectable if the token ever round-trips back to us.
 *  - The envelope stays base64-URL-safe and backwards-parseable by code
 *    that just JSON.parse's it (fields orderNo, amount, returnUrl).
 */

function getSecret(): string {
  const secret = process.env.PAYMENT_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'PAYMENT_TOKEN_SECRET (or JWT_SECRET) must be set and at least 16 characters',
    );
  }
  return secret;
}

export interface PaymentTokenInput {
  orderNo: string;
  amount: number | string;
  returnUrl?: string;
}

export function buildPaymentToken(input: PaymentTokenInput): string {
  const body = {
    orderNo: input.orderNo,
    amount: input.amount,
    returnUrl: input.returnUrl || '',
    ts: Date.now(),
  };
  const bodyJson = JSON.stringify(body);
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(bodyJson)
    .digest('hex');
  const envelope = { ...body, sig };
  return Buffer.from(JSON.stringify(envelope)).toString('base64');
}

export function verifyPaymentToken(
  token: string,
  maxAgeMs = 30 * 60 * 1000,
): PaymentTokenInput | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const { sig, ...body } = decoded || {};
    if (!sig || !body || !body.orderNo) return null;
    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(JSON.stringify(body))
      .digest('hex');
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    if (body.ts && Date.now() - body.ts > maxAgeMs) return null;
    return {
      orderNo: body.orderNo,
      amount: body.amount,
      returnUrl: body.returnUrl,
    };
  } catch {
    return null;
  }
}
