import { getCurrencySymbol } from '@/utils/currency';

type TransactionLike = {
    paymentMethod?: unknown;
    paymentDetails?: unknown;
    wallet_type?: unknown;
    walletType?: unknown;
};

type CurrencyFormatOptions = {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
};

const normalizeString = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

const toRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const looksLikeCrypto = (value: unknown): boolean => {
    const normalized = normalizeString(value).toLowerCase();
    if (!normalized) return false;

    return (
        normalized === 'usd' ||
        normalized === 'crypto' ||
        normalized === 'crypto_wallet' ||
        normalized.startsWith('crypto_') ||
        normalized.includes('crypto') ||
        normalized.includes('bitcoin') ||
        normalized.includes('nowpayments') ||
        normalized.includes('now')
    );
};

export function isCryptoTransaction(tx: TransactionLike): boolean {
    const details = toRecord(tx.paymentDetails);

    if (
        [
            tx.wallet_type,
            tx.walletType,
            tx.paymentMethod,
            details.method,
            details.walletType,
            details.destinationWallet,
            details.walletLabel,
            details.currency,
            details.depositCurrency,
            details.priceCurrency,
        ].some(looksLikeCrypto)
    ) {
        return true;
    }

    const payCurrency = normalizeString(details.payCurrency);
    if (
        payCurrency &&
        (
            normalizeString(details.payAddress) ||
            normalizeString(details.nowpaymentsOrderId) ||
            looksLikeCrypto(tx.paymentMethod)
        )
    ) {
        return true;
    }

    return false;
}

export function getTransactionDisplayCurrency(
    _tx: TransactionLike,
    _fiatCurrency = 'USD',
): string {
    // Platform is USD-only — every transaction displays in USD.
    return 'USD';
}

export function formatCurrencyAmount(
    amount: number,
    currencyCode = 'USD',
    options: CurrencyFormatOptions = {},
): string {
    const currency = normalizeString(currencyCode).toUpperCase() || 'USD';
    const locale = 'en-US';
    const minimumFractionDigits = options.minimumFractionDigits ?? 2;
    const maximumFractionDigits = options.maximumFractionDigits ?? minimumFractionDigits;

    return `${getCurrencySymbol(currency)}${amount.toLocaleString(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
    })}`;
}

export function formatTransactionAmount(
    amount: number,
    tx: TransactionLike,
    fiatCurrency = 'USD',
    options: CurrencyFormatOptions = {},
): string {
    return formatCurrencyAmount(
        amount,
        getTransactionDisplayCurrency(tx, fiatCurrency),
        options,
    );
}

export function formatCurrencyParts(
    parts: { fiat: number; crypto: number },
    _fiatCurrency = 'USD',
    options: CurrencyFormatOptions = {},
): string {
    // USD-only: combine both buckets into a single USD figure.
    const total = (parts.fiat || 0) + (parts.crypto || 0);
    return formatCurrencyAmount(total, 'USD', options);
}
