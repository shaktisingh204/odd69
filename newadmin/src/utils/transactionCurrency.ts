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

const KNOWN_SYMBOLS: Record<string, string> = {
    INR: '₹',
    USD: '$',
};

/** Format a crypto/USD amount as $ with 2 decimal places */
export function fmtUSD(amount: number): string {
    return `$${Number(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/** Format an INR amount as ₹ with no decimals */
export function fmtINR(amount: number): string {
    return `₹${Number(amount || 0).toLocaleString('en-IN', {
        maximumFractionDigits: 0,
    })}`;
}

/**
 * Smart formatter: returns $ for crypto, ₹ for fiat.
 * Use this anywhere you have a pre-known isCrypto flag.
 */
export function fmtSmart(amount: number, isCrypto: boolean): string {
    return isCrypto ? fmtUSD(amount) : fmtINR(amount);
}

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
    tx: TransactionLike,
    fiatCurrency = 'INR',
): string {
    return isCryptoTransaction(tx) ? 'USD' : fiatCurrency;
}

export function formatCurrencyAmount(
    amount: number,
    currencyCode = 'INR',
    options: CurrencyFormatOptions = {},
): string {
    const currency = normalizeString(currencyCode).toUpperCase() || 'INR';
    const locale = currency === 'USD' ? 'en-US' : 'en-IN';
    const minimumFractionDigits = options.minimumFractionDigits ?? (currency === 'USD' ? 2 : 0);
    const maximumFractionDigits = options.maximumFractionDigits ?? minimumFractionDigits;
    const knownSymbol = KNOWN_SYMBOLS[currency];

    if (knownSymbol) {
        return `${knownSymbol}${amount.toLocaleString(locale, {
            minimumFractionDigits,
            maximumFractionDigits,
        })}`;
    }

    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits,
            maximumFractionDigits,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString(locale, {
            minimumFractionDigits,
            maximumFractionDigits,
        })}`;
    }
}

export function formatTransactionAmount(
    amount: number,
    tx: TransactionLike,
    fiatCurrency = 'INR',
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
    fiatCurrency = 'INR',
    options: CurrencyFormatOptions = {},
): string {
    const formatted: string[] = [];

    if (parts.fiat > 0) {
        formatted.push(formatCurrencyAmount(parts.fiat, fiatCurrency, options));
    }

    if (parts.crypto > 0) {
        formatted.push(formatCurrencyAmount(parts.crypto, 'USD', options));
    }

    if (formatted.length === 0) {
        return formatCurrencyAmount(0, fiatCurrency, options);
    }

    return formatted.join(' + ');
}
