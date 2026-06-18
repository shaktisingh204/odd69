/**
 * Returns the currency symbol for a given ISO-4217 currency code.
 * Falls back to the code itself if no symbol is found.
 */
export function getCurrencySymbol(code: string): string {
    const symbols: Record<string, string> = {
        INR: '$',
        USD: '$',
        EUR: '€',
        GBP: '£',
        JPY: '¥',
        CNY: '¥',
        AUD: 'A$',
        CAD: 'C$',
        CHF: 'CHF',
        HKD: 'HK$',
        SGD: 'S$',
        SEK: 'kr',
        NOK: 'kr',
        DKK: 'kr',
        NZD: 'NZ$',
        MXN: 'MX$',
        BRL: 'R$',
        ZAR: 'R',
        RUB: '₽',
        TRY: '₺',
        KRW: '₩',
        THB: '฿',
        MYR: 'RM',
        IDR: 'Rp',
        PHP: '₱',
        PKR: '₨',
        BDT: '৳',
        AED: 'د.إ',
        SAR: '﷼',
        QAR: '﷼',
        KWD: 'KD',
        BHD: 'BD',
        OMR: 'OM',
        EGP: 'E£',
        NGN: '₦',
        KES: 'KSh',
        GHS: '₵',
        UAH: '₴',
        VND: '₫',
        CZK: 'Kč',
        PLN: 'zł',
        HUF: 'Ft',
        RON: 'lei',
        HRK: 'kn',
        ILS: '₪',
        ARS: '$',
        CLP: '$',
        COP: '$',
        PEN: 'S/',
        VES: 'Bs',
    };
    return symbols[code?.toUpperCase()] ?? code ?? '$';
}

/**
 * Format a number with the appropriate currency symbol for a given currency code.
 * The platform is USD-only, so amounts default to USD and en-US formatting.
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
    const symbol = getCurrencySymbol(currencyCode || 'USD');
    return `${symbol}${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
