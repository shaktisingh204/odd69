"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { getSystemConfig, updateSystemConfig, uploadPublicImage } from '@/actions/settings';
import {
    Save, Wallet, ArrowDownRight, ArrowUpRight, CheckCircle,
    ChevronDown, ChevronUp, Search, RefreshCw, Loader2, Shield, QrCode, AlertTriangle, Info,
} from 'lucide-react';

// ─── Inline countries list (ISO codes + flags + currency) ─────────────────────
const ALL_COUNTRIES = [
    { name: 'Afghanistan', code: 'AF', flag: '🇦🇫', currency: 'AFN' },
    { name: 'Albania', code: 'AL', flag: '🇦🇱', currency: 'ALL' },
    { name: 'Algeria', code: 'DZ', flag: '🇩🇿', currency: 'DZD' },
    { name: 'Andorra', code: 'AD', flag: '🇦🇩', currency: 'EUR' },
    { name: 'Angola', code: 'AO', flag: '🇦🇴', currency: 'AOA' },
    { name: 'Antigua and Barbuda', code: 'AG', flag: '🇦🇬', currency: 'XCD' },
    { name: 'Argentina', code: 'AR', flag: '🇦🇷', currency: 'ARS' },
    { name: 'Armenia', code: 'AM', flag: '🇦🇲', currency: 'AMD' },
    { name: 'Australia', code: 'AU', flag: '🇦🇺', currency: 'AUD' },
    { name: 'Austria', code: 'AT', flag: '🇦🇹', currency: 'EUR' },
    { name: 'Azerbaijan', code: 'AZ', flag: '🇦🇿', currency: 'AZN' },
    { name: 'Bahamas', code: 'BS', flag: '🇧🇸', currency: 'BSD' },
    { name: 'Bahrain', code: 'BH', flag: '🇧🇭', currency: 'BHD' },
    { name: 'Bangladesh', code: 'BD', flag: '🇧🇩', currency: 'BDT' },
    { name: 'Barbados', code: 'BB', flag: '🇧🇧', currency: 'BBD' },
    { name: 'Belarus', code: 'BY', flag: '🇧🇾', currency: 'BYN' },
    { name: 'Belgium', code: 'BE', flag: '🇧🇪', currency: 'EUR' },
    { name: 'Belize', code: 'BZ', flag: '🇧🇿', currency: 'BZD' },
    { name: 'Benin', code: 'BJ', flag: '🇧🇯', currency: 'XOF' },
    { name: 'Bhutan', code: 'BT', flag: '🇧🇹', currency: 'BTN' },
    { name: 'Bolivia', code: 'BO', flag: '🇧🇴', currency: 'BOB' },
    { name: 'Bosnia and Herzegovina', code: 'BA', flag: '🇧🇦', currency: 'BAM' },
    { name: 'Botswana', code: 'BW', flag: '🇧🇼', currency: 'BWP' },
    { name: 'Brazil', code: 'BR', flag: '🇧🇷', currency: 'BRL' },
    { name: 'Brunei', code: 'BN', flag: '🇧🇳', currency: 'BND' },
    { name: 'Bulgaria', code: 'BG', flag: '🇧🇬', currency: 'BGN' },
    { name: 'Burkina Faso', code: 'BF', flag: '🇧🇫', currency: 'XOF' },
    { name: 'Burundi', code: 'BI', flag: '🇧🇮', currency: 'BIF' },
    { name: 'Cabo Verde', code: 'CV', flag: '🇨🇻', currency: 'CVE' },
    { name: 'Cambodia', code: 'KH', flag: '🇰🇭', currency: 'KHR' },
    { name: 'Cameroon', code: 'CM', flag: '🇨🇲', currency: 'XAF' },
    { name: 'Canada', code: 'CA', flag: '🇨🇦', currency: 'CAD' },
    { name: 'Central African Republic', code: 'CF', flag: '🇨🇫', currency: 'XAF' },
    { name: 'Chad', code: 'TD', flag: '🇹🇩', currency: 'XAF' },
    { name: 'Chile', code: 'CL', flag: '🇨🇱', currency: 'CLP' },
    { name: 'China', code: 'CN', flag: '🇨🇳', currency: 'CNY' },
    { name: 'Colombia', code: 'CO', flag: '🇨🇴', currency: 'COP' },
    { name: 'Comoros', code: 'KM', flag: '🇰🇲', currency: 'KMF' },
    { name: 'Costa Rica', code: 'CR', flag: '🇨🇷', currency: 'CRC' },
    { name: 'Croatia', code: 'HR', flag: '🇭🇷', currency: 'EUR' },
    { name: 'Cuba', code: 'CU', flag: '🇨🇺', currency: 'CUP' },
    { name: 'Cyprus', code: 'CY', flag: '🇨🇾', currency: 'EUR' },
    { name: 'Czech Republic', code: 'CZ', flag: '🇨🇿', currency: 'CZK' },
    { name: 'Denmark', code: 'DK', flag: '🇩🇰', currency: 'DKK' },
    { name: 'Djibouti', code: 'DJ', flag: '🇩🇯', currency: 'DJF' },
    { name: 'Dominican Republic', code: 'DO', flag: '🇩🇴', currency: 'DOP' },
    { name: 'Ecuador', code: 'EC', flag: '🇪🇨', currency: 'USD' },
    { name: 'Egypt', code: 'EG', flag: '🇪🇬', currency: 'EGP' },
    { name: 'El Salvador', code: 'SV', flag: '🇸🇻', currency: 'USD' },
    { name: 'Estonia', code: 'EE', flag: '🇪🇪', currency: 'EUR' },
    { name: 'Ethiopia', code: 'ET', flag: '🇪🇹', currency: 'ETB' },
    { name: 'Fiji', code: 'FJ', flag: '🇫🇯', currency: 'FJD' },
    { name: 'Finland', code: 'FI', flag: '🇫🇮', currency: 'EUR' },
    { name: 'France', code: 'FR', flag: '🇫🇷', currency: 'EUR' },
    { name: 'Gabon', code: 'GA', flag: '🇬🇦', currency: 'XAF' },
    { name: 'Gambia', code: 'GM', flag: '🇬🇲', currency: 'GMD' },
    { name: 'Georgia', code: 'GE', flag: '🇬🇪', currency: 'GEL' },
    { name: 'Germany', code: 'DE', flag: '🇩🇪', currency: 'EUR' },
    { name: 'Ghana', code: 'GH', flag: '🇬🇭', currency: 'GHS' },
    { name: 'Greece', code: 'GR', flag: '🇬🇷', currency: 'EUR' },
    { name: 'Guatemala', code: 'GT', flag: '🇬🇹', currency: 'GTQ' },
    { name: 'Haiti', code: 'HT', flag: '🇭🇹', currency: 'HTG' },
    { name: 'Honduras', code: 'HN', flag: '🇭🇳', currency: 'HNL' },
    { name: 'Hungary', code: 'HU', flag: '🇭🇺', currency: 'HUF' },
    { name: 'Iceland', code: 'IS', flag: '🇮🇸', currency: 'ISK' },
    { name: 'India', code: 'IN', flag: '🇮🇳', currency: 'INR' },
    { name: 'Indonesia', code: 'ID', flag: '🇮🇩', currency: 'IDR' },
    { name: 'Iran', code: 'IR', flag: '🇮🇷', currency: 'IRR' },
    { name: 'Iraq', code: 'IQ', flag: '🇮🇶', currency: 'IQD' },
    { name: 'Ireland', code: 'IE', flag: '🇮🇪', currency: 'EUR' },
    { name: 'Israel', code: 'IL', flag: '🇮🇱', currency: 'ILS' },
    { name: 'Italy', code: 'IT', flag: '🇮🇹', currency: 'EUR' },
    { name: 'Jamaica', code: 'JM', flag: '🇯🇲', currency: 'JMD' },
    { name: 'Japan', code: 'JP', flag: '🇯🇵', currency: 'JPY' },
    { name: 'Jordan', code: 'JO', flag: '🇯🇴', currency: 'JOD' },
    { name: 'Kazakhstan', code: 'KZ', flag: '🇰🇿', currency: 'KZT' },
    { name: 'Kenya', code: 'KE', flag: '🇰🇪', currency: 'KES' },
    { name: 'Kuwait', code: 'KW', flag: '🇰🇼', currency: 'KWD' },
    { name: 'Kyrgyzstan', code: 'KG', flag: '🇰🇬', currency: 'KGS' },
    { name: 'Laos', code: 'LA', flag: '🇱🇦', currency: 'LAK' },
    { name: 'Latvia', code: 'LV', flag: '🇱🇻', currency: 'EUR' },
    { name: 'Lebanon', code: 'LB', flag: '🇱🇧', currency: 'LBP' },
    { name: 'Libya', code: 'LY', flag: '🇱🇾', currency: 'LYD' },
    { name: 'Lithuania', code: 'LT', flag: '🇱🇹', currency: 'EUR' },
    { name: 'Luxembourg', code: 'LU', flag: '🇱🇺', currency: 'EUR' },
    { name: 'Madagascar', code: 'MG', flag: '🇲🇬', currency: 'MGA' },
    { name: 'Malawi', code: 'MW', flag: '🇲🇼', currency: 'MWK' },
    { name: 'Malaysia', code: 'MY', flag: '🇲🇾', currency: 'MYR' },
    { name: 'Maldives', code: 'MV', flag: '🇲🇻', currency: 'MVR' },
    { name: 'Mali', code: 'ML', flag: '🇲🇱', currency: 'XOF' },
    { name: 'Malta', code: 'MT', flag: '🇲🇹', currency: 'EUR' },
    { name: 'Mauritania', code: 'MR', flag: '🇲🇷', currency: 'MRU' },
    { name: 'Mauritius', code: 'MU', flag: '🇲🇺', currency: 'MUR' },
    { name: 'Mexico', code: 'MX', flag: '🇲🇽', currency: 'MXN' },
    { name: 'Moldova', code: 'MD', flag: '🇲🇩', currency: 'MDL' },
    { name: 'Mongolia', code: 'MN', flag: '🇲🇳', currency: 'MNT' },
    { name: 'Montenegro', code: 'ME', flag: '🇲🇪', currency: 'EUR' },
    { name: 'Morocco', code: 'MA', flag: '🇲🇦', currency: 'MAD' },
    { name: 'Mozambique', code: 'MZ', flag: '🇲🇿', currency: 'MZN' },
    { name: 'Myanmar', code: 'MM', flag: '🇲🇲', currency: 'MMK' },
    { name: 'Namibia', code: 'NA', flag: '🇳🇦', currency: 'NAD' },
    { name: 'Nepal', code: 'NP', flag: '🇳🇵', currency: 'NPR' },
    { name: 'Netherlands', code: 'NL', flag: '🇳🇱', currency: 'EUR' },
    { name: 'New Zealand', code: 'NZ', flag: '🇳🇿', currency: 'NZD' },
    { name: 'Nicaragua', code: 'NI', flag: '🇳🇮', currency: 'NIO' },
    { name: 'Nigeria', code: 'NG', flag: '🇳🇬', currency: 'NGN' },
    { name: 'Norway', code: 'NO', flag: '🇳🇴', currency: 'NOK' },
    { name: 'Oman', code: 'OM', flag: '🇴🇲', currency: 'OMR' },
    { name: 'Pakistan', code: 'PK', flag: '🇵🇰', currency: 'PKR' },
    { name: 'Panama', code: 'PA', flag: '🇵🇦', currency: 'PAB' },
    { name: 'Paraguay', code: 'PY', flag: '🇵🇾', currency: 'PYG' },
    { name: 'Peru', code: 'PE', flag: '🇵🇪', currency: 'PEN' },
    { name: 'Philippines', code: 'PH', flag: '🇵🇭', currency: 'PHP' },
    { name: 'Poland', code: 'PL', flag: '🇵🇱', currency: 'PLN' },
    { name: 'Portugal', code: 'PT', flag: '🇵🇹', currency: 'EUR' },
    { name: 'Qatar', code: 'QA', flag: '🇶🇦', currency: 'QAR' },
    { name: 'Romania', code: 'RO', flag: '🇷🇴', currency: 'RON' },
    { name: 'Russia', code: 'RU', flag: '🇷🇺', currency: 'RUB' },
    { name: 'Rwanda', code: 'RW', flag: '🇷🇼', currency: 'RWF' },
    { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', currency: 'SAR' },
    { name: 'Senegal', code: 'SN', flag: '🇸🇳', currency: 'XOF' },
    { name: 'Serbia', code: 'RS', flag: '🇷🇸', currency: 'RSD' },
    { name: 'Singapore', code: 'SG', flag: '🇸🇬', currency: 'SGD' },
    { name: 'Slovakia', code: 'SK', flag: '🇸🇰', currency: 'EUR' },
    { name: 'Slovenia', code: 'SI', flag: '🇸🇮', currency: 'EUR' },
    { name: 'Somalia', code: 'SO', flag: '🇸🇴', currency: 'SOS' },
    { name: 'South Africa', code: 'ZA', flag: '🇿🇦', currency: 'ZAR' },
    { name: 'South Korea', code: 'KR', flag: '🇰🇷', currency: 'KRW' },
    { name: 'Spain', code: 'ES', flag: '🇪🇸', currency: 'EUR' },
    { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰', currency: 'LKR' },
    { name: 'Sudan', code: 'SD', flag: '🇸🇩', currency: 'SDG' },
    { name: 'Sweden', code: 'SE', flag: '🇸🇪', currency: 'SEK' },
    { name: 'Switzerland', code: 'CH', flag: '🇨🇭', currency: 'CHF' },
    { name: 'Syria', code: 'SY', flag: '🇸🇾', currency: 'SYP' },
    { name: 'Taiwan', code: 'TW', flag: '🇹🇼', currency: 'TWD' },
    { name: 'Tajikistan', code: 'TJ', flag: '🇹🇯', currency: 'TJS' },
    { name: 'Tanzania', code: 'TZ', flag: '🇹🇿', currency: 'TZS' },
    { name: 'Thailand', code: 'TH', flag: '🇹🇭', currency: 'THB' },
    { name: 'Togo', code: 'TG', flag: '🇹🇬', currency: 'XOF' },
    { name: 'Trinidad and Tobago', code: 'TT', flag: '🇹🇹', currency: 'TTD' },
    { name: 'Tunisia', code: 'TN', flag: '🇹🇳', currency: 'TND' },
    { name: 'Turkey', code: 'TR', flag: '🇹🇷', currency: 'TRY' },
    { name: 'Uganda', code: 'UG', flag: '🇺🇬', currency: 'UGX' },
    { name: 'Ukraine', code: 'UA', flag: '🇺🇦', currency: 'UAH' },
    { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', currency: 'AED' },
    { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', currency: 'GBP' },
    { name: 'United States', code: 'US', flag: '🇺🇸', currency: 'USD' },
    { name: 'Uruguay', code: 'UY', flag: '🇺🇾', currency: 'UYU' },
    { name: 'Uzbekistan', code: 'UZ', flag: '🇺🇿', currency: 'UZS' },
    { name: 'Venezuela', code: 'VE', flag: '🇻🇪', currency: 'VES' },
    { name: 'Vietnam', code: 'VN', flag: '🇻🇳', currency: 'VND' },
    { name: 'Yemen', code: 'YE', flag: '🇾🇪', currency: 'YER' },
    { name: 'Zambia', code: 'ZM', flag: '🇿🇲', currency: 'ZMW' },
    { name: 'Zimbabwe', code: 'ZW', flag: '🇿🇼', currency: 'USD' },
    { name: 'International (USD)', code: 'INT', flag: '🌐', currency: 'USD' },
];

// ─── Country Dropdown Component ───────────────────────────────────────────────
function CountryDropdown({
    value,
    onChange,
}: {
    value: string;
    onChange: (code: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selected = ALL_COUNTRIES.find(c => c.code === value) ?? ALL_COUNTRIES.find(c => c.code === 'IN')!;

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return q
            ? ALL_COUNTRIES.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.code.toLowerCase().includes(q) ||
                c.currency.toLowerCase().includes(q)
            )
            : ALL_COUNTRIES;
    }, [search]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-3 bg-slate-900 border border-slate-700 hover:border-indigo-500 rounded-xl px-4 py-3 text-left transition-colors group"
            >
                <span className="text-2xl leading-none shrink-0">{selected.flag}</span>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{selected.name}</p>
                    <p className="text-slate-500 text-xs">{selected.currency} · {selected.code}</p>
                </div>
                <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b border-slate-800">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search country, code, or currency…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                            />
                        </div>
                    </div>
                    {/* List */}
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                        {filtered.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-sm">No countries found</div>
                        ) : (
                            filtered.map(c => (
                                <button
                                    key={c.code + c.name}
                                    type="button"
                                    onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left ${c.code === value ? 'bg-indigo-500/10' : ''}`}
                                >
                                    <span className="text-xl leading-none shrink-0">{c.flag}</span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-white text-sm">{c.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-slate-500 font-mono">{c.currency}</span>
                                        <span className="text-xs text-slate-600 font-mono">{c.code}</span>
                                        {c.code === value && <CheckCircle size={12} className="text-indigo-400" />}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

type AdminNowPaymentsRawCurrency = {
    code: string;
    name: string;
    cg_id?: string | null;
    network?: string | null;
    logo_url?: string | null;
    enable?: boolean;
};

type AdminCurrencyOverrideNetwork = {
    id: string;
    code?: string;
    network: string;
    logoUrl?: string | null;
    enabled?: boolean;
    isAvailableForPayment?: boolean;
};

type AdminCurrencyOverride = {
    code?: string;
    label?: string;
    logoUrl?: string | null;
    networks?: AdminCurrencyOverrideNetwork[];
};

type AdminCurrencyOverrides = Record<string, AdminCurrencyOverride>;

type AdminNowPaymentsCoin = {
    groupKey: string;
    code: string;
    label: string;
    syncedLabel: string;
    logoUrl: string | null;
    syncedLogoUrl: string | null;
    syncedNetworks: Array<{ id: string; code: string; network: string }>;
    overrideNetworks: AdminCurrencyOverrideNetwork[];
};

type ManualUpiAccount = {
    id: string;
    upiId: string;
    qrImageUrl: string;
};

type SystemConfigValues = Record<string, string>;

const parseJsonSafely = <T,>(value: string | undefined, fallback: T): T => {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

const normalizeCurrencyOverridesForComparison = (overrides: AdminCurrencyOverrides): AdminCurrencyOverrides =>
    Object.fromEntries(
        Object.entries(overrides)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupKey, override]) => [
                groupKey,
                {
                    ...override,
                    code: override.code?.trim() || undefined,
                    label: override.label?.trim() || undefined,
                    logoUrl: override.logoUrl ?? null,
                    networks: [...(override.networks || [])]
                        .map((network) => ({
                            ...network,
                            id: network.id.trim(),
                            code: network.code?.trim() || undefined,
                            network: network.network.trim(),
                            logoUrl: network.logoUrl ?? null,
                        }))
                        .sort((a, b) => a.id.localeCompare(b.id) || a.network.localeCompare(b.network)),
                },
            ]),
    );

const createManualUpiAccountId = () =>
    `manual-upi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildManualUpiAccountTag = (upiId: string) =>
    `Manual UPI${upiId.trim() ? ` · ${upiId.trim()}` : ''}`;

const parseManualUpiAccounts = (config: Record<string, string>) => {
    const parsed = parseJsonSafely<ManualUpiAccount[]>(config.MANUAL_UPI_ACCOUNTS, [])
        .map((account) => ({
            id: account?.id?.trim() || createManualUpiAccountId(),
            upiId: account?.upiId?.trim() || '',
            qrImageUrl: account?.qrImageUrl?.trim() || '',
        }))
        .filter((account) => account.upiId);

    if (parsed.length) return parsed;

    const legacyUpiId = config.MANUAL_UPI_ID?.trim() || '';
    const legacyQrImageUrl = config.MANUAL_QR_URL?.trim() || '';
    if (!legacyUpiId) return [];

    return [{
        id: createManualUpiAccountId(),
        upiId: legacyUpiId,
        qrImageUrl: legacyQrImageUrl,
    }];
};

const normalizeAdminNetworkLabel = (network?: string | null, code?: string) => {
    if (!network) return (code || '').toUpperCase();
    const normalized = network.trim().toLowerCase();
    const map: Record<string, string> = {
        eth: 'ERC20',
        erc20: 'ERC20',
        tron: 'TRC20',
        trc20: 'TRC20',
        bsc: 'BSC',
        polygon: 'Polygon',
        matic: 'Polygon',
        sol: 'Solana',
        solana: 'Solana',
        arbitrum: 'Arbitrum',
        optimism: 'Optimism',
        base: 'Base',
        ton: 'TON',
        zksync: 'zkSync',
        avalanche: 'Avalanche',
    };
    return map[normalized] || network.toUpperCase();
};

const getAdminBaseAssetLabel = (name: string | null | undefined, code: string) => {
    const rawName = (name || code).trim();
    const withoutParentheses = rawName.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    return withoutParentheses || code.toUpperCase();
};

const getAdminBaseAssetCode = (code: string, network?: string | null) => {
    const normalized = code.trim().toUpperCase();
    const knownSuffixes = new Set([
        'TRC20', 'ERC20', 'BSC', 'MATIC', 'MAINNET', 'SOL', 'ARB', 'ARC20', 'USDCE', 'BRC20',
        'ETH', 'TRON', 'SOLANA', 'POLYGON', 'AVALANCHE', 'OPTIMISM', 'BASE', 'LINEA', 'ZKSYNC', 'TON',
    ]);
    const normalizedNetwork = (network || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalizedNetwork.length >= 3) knownSuffixes.add(normalizedNetwork);
    const sortedSuffixes = Array.from(knownSuffixes).sort((a, b) => b.length - a.length);
    for (const suffix of sortedSuffixes) {
        if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
            return normalized.slice(0, -suffix.length);
        }
    }
    return normalized;
};

const getAdminGroupKey = (currency: AdminNowPaymentsRawCurrency) => {
    const baseCode = getAdminBaseAssetCode(currency.code, currency.network);
    if (baseCode) return baseCode.toLowerCase();
    if (currency.cg_id?.trim()) return currency.cg_id.trim().toLowerCase();
    return getAdminBaseAssetLabel(currency.name, currency.code).toLowerCase();
};

const buildAdminNowPaymentsCoins = (
    rawCurrencies: AdminNowPaymentsRawCurrency[],
    overrides: AdminCurrencyOverrides,
) => {
    const coinMap = new Map<string, AdminNowPaymentsCoin>();

    for (const currency of rawCurrencies) {
        const groupKey = getAdminGroupKey(currency);
        const existing = coinMap.get(groupKey) ?? {
            groupKey,
            code: getAdminBaseAssetCode(currency.code, currency.network),
            label: getAdminBaseAssetLabel(currency.name, currency.code),
            syncedLabel: getAdminBaseAssetLabel(currency.name, currency.code),
            logoUrl: currency.logo_url || null,
            syncedLogoUrl: currency.logo_url || null,
            syncedNetworks: [],
            overrideNetworks: [],
        };

        existing.syncedNetworks.push({
            id: currency.code.toLowerCase(),
            code: currency.code.toUpperCase(),
            network: normalizeAdminNetworkLabel(currency.network, currency.code),
        });

        coinMap.set(groupKey, existing);
    }

    for (const [groupKey, override] of Object.entries(overrides)) {
        const existing = coinMap.get(groupKey) ?? {
            groupKey,
            code: override.code?.trim().toUpperCase() || groupKey.toUpperCase(),
            label: override.label?.trim() || groupKey.toUpperCase(),
            syncedLabel: groupKey.toUpperCase(),
            logoUrl: override.logoUrl || null,
            syncedLogoUrl: null,
            syncedNetworks: [],
            overrideNetworks: [],
        };

        existing.code = override.code?.trim().toUpperCase() || existing.code;
        existing.label = override.label?.trim() || existing.syncedLabel || existing.label;
        existing.logoUrl = override.logoUrl ?? existing.logoUrl;
        existing.overrideNetworks = override.networks || [];

        coinMap.set(groupKey, existing);
    }

    return Array.from(coinMap.values())
        .map((coin) => ({
            ...coin,
            syncedNetworks: coin.syncedNetworks.sort((a, b) => a.network.localeCompare(b.network) || a.code.localeCompare(b.code)),
            overrideNetworks: [...coin.overrideNetworks].sort((a, b) => a.network.localeCompare(b.network) || a.id.localeCompare(b.id)),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DepositSettingsPage() {
    const [config, setConfig] = useState<SystemConfigValues>({});
    const [currencyOverrides, setCurrencyOverrides] = useState<AdminCurrencyOverrides>({});
    const [savedCurrencyOverrides, setSavedCurrencyOverrides] = useState<AdminCurrencyOverrides>({});
    const [manualAccounts, setManualAccounts] = useState<ManualUpiAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [coinSearch, setCoinSearch] = useState('');
    const [uploadingGroupKey, setUploadingGroupKey] = useState<string | null>(null);
    const [uploadingGatewayLogoKey, setUploadingGatewayLogoKey] = useState<string | null>(null);
    const [uploadingManualAccountId, setUploadingManualAccountId] = useState<string | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        getSystemConfig()
            .then(res => {
                if (res.success && res.data) {
                    setConfig(res.data);
                    setManualAccounts(parseManualUpiAccounts(res.data));
                    const parsedOverrides = parseJsonSafely<AdminCurrencyOverrides>(res.data.NOWPAYMENTS_CURRENCY_OVERRIDES, {});
                    setCurrencyOverrides(parsedOverrides);
                    setSavedCurrencyOverrides(parsedOverrides);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const set = (key: string, value: string) =>
        setConfig((p) => ({ ...p, [key]: value }));

    const addManualAccount = () => {
        setManualAccounts((current) => [
            ...current,
            { id: createManualUpiAccountId(), upiId: '', qrImageUrl: '' },
        ]);
    };

    const updateManualAccount = (id: string, field: keyof ManualUpiAccount, value: string) => {
        setManualAccounts((current) =>
            current.map((account) =>
                account.id === id ? { ...account, [field]: value } : account,
            ),
        );
    };

    const removeManualAccount = (id: string) => {
        setManualAccounts((current) => current.filter((account) => account.id !== id));
    };

    // ─── Derived: are any UPI gateways active? ────────────────────────────────
    const noGatewayActive =
        config.UPI1_ENABLED === 'false' && config.UPI2_ENABLED === 'false';

    const nowPaymentsCoins = useMemo(
        () => buildAdminNowPaymentsCoins(
            parseJsonSafely<{ currencies?: AdminNowPaymentsRawCurrency[] }>(config.NOWPAYMENTS_FULL_CURRENCIES, { currencies: [] }).currencies || [],
            currencyOverrides,
        ),
        [config.NOWPAYMENTS_FULL_CURRENCIES, currencyOverrides],
    );

    const filteredNowPaymentsCoins = useMemo(() => {
        const query = coinSearch.trim().toLowerCase();
        if (!query) return nowPaymentsCoins;
        return nowPaymentsCoins.filter((coin) =>
            `${coin.label} ${coin.code} ${coin.groupKey}`.toLowerCase().includes(query),
        );
    }, [coinSearch, nowPaymentsCoins]);

    const normalizedCurrentOverrides = useMemo(
        () => normalizeCurrencyOverridesForComparison(currencyOverrides),
        [currencyOverrides],
    );
    const normalizedSavedOverrides = useMemo(
        () => normalizeCurrencyOverridesForComparison(savedCurrencyOverrides),
        [savedCurrencyOverrides],
    );
    const pendingOverrideCount = useMemo(() => {
        const allKeys = new Set([
            ...Object.keys(normalizedCurrentOverrides),
            ...Object.keys(normalizedSavedOverrides),
        ]);

        let changed = 0;
        for (const key of allKeys) {
            const currentValue = normalizedCurrentOverrides[key] ?? null;
            const savedValue = normalizedSavedOverrides[key] ?? null;
            if (JSON.stringify(currentValue) !== JSON.stringify(savedValue)) {
                changed += 1;
            }
        }
        return changed;
    }, [normalizedCurrentOverrides, normalizedSavedOverrides]);

    const updateCurrencyOverride = (groupKey: string, updater: (current: AdminCurrencyOverride) => AdminCurrencyOverride) => {
        setCurrencyOverrides((current) => ({
            ...current,
            [groupKey]: updater(current[groupKey] || {}),
        }));
    };

    const setCoinLabelOverride = (groupKey: string, value: string) => {
        setCurrencyOverrides((current) => {
            const currentOverride = current[groupKey] || {};
            const nextOverride: AdminCurrencyOverride = value.trim()
                ? { ...currentOverride, label: value }
                : { ...currentOverride };
            if (!value.trim()) {
                const hasOtherFields = !!nextOverride.code?.trim() || !!nextOverride.logoUrl || (nextOverride.networks || []).length > 0;
                if (!hasOtherFields) {
                    const { [groupKey]: _removed, ...rest } = current;
                    return rest;
                }
            }
            return { ...current, [groupKey]: nextOverride };
        });
    };

    const setCoinLogoOverride = (groupKey: string, value: string | null) => {
        setCurrencyOverrides((current) => {
            const nextOverride = { ...(current[groupKey] || {}), logoUrl: value };
            const hasOtherFields = !!nextOverride.label?.trim() || !!nextOverride.code?.trim() || (nextOverride.networks || []).length > 0;
            if (!value && !hasOtherFields) {
                const { [groupKey]: _removed, ...rest } = current;
                return rest;
            }
            return { ...current, [groupKey]: nextOverride };
        });
    };

    const addManualChain = (groupKey: string, coinCode: string) => {
        updateCurrencyOverride(groupKey, (current) => ({
            ...current,
            code: current.code || coinCode,
            networks: [
                ...(current.networks || []),
                {
                    id: '',
                    code: coinCode,
                    network: '',
                    enabled: true,
                    isAvailableForPayment: true,
                },
            ],
        }));
    };

    const updateManualChain = (
        groupKey: string,
        index: number,
        field: keyof AdminCurrencyOverrideNetwork,
        value: string | boolean,
    ) => {
        updateCurrencyOverride(groupKey, (current) => {
            const networks = [...(current.networks || [])];
            const target: AdminCurrencyOverrideNetwork = {
                ...(networks[index] || {
                    id: '',
                    network: '',
                    enabled: true,
                    isAvailableForPayment: true,
                }),
            };
            if (field === 'enabled' || field === 'isAvailableForPayment') {
                target[field] = Boolean(value);
            } else {
                target[field] = String(value);
            }
            networks[index] = target;
            return { ...current, networks };
        });
    };

    const removeManualChain = (groupKey: string, index: number) => {
        setCurrencyOverrides((current) => {
            const nextOverride = { ...(current[groupKey] || {}) };
            nextOverride.networks = (nextOverride.networks || []).filter((_, networkIndex) => networkIndex !== index);
            const hasOtherFields = !!nextOverride.label?.trim() || !!nextOverride.code?.trim() || !!nextOverride.logoUrl || (nextOverride.networks || []).length > 0;
            if (!hasOtherFields) {
                const { [groupKey]: _removed, ...rest } = current;
                return rest;
            }
            return { ...current, [groupKey]: nextOverride };
        });
    };

    const handleCoinLogoUpload = async (groupKey: string, file: File) => {
        setUploadingGroupKey(groupKey);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'coin-logos');

            const data = await uploadPublicImage(formData);
            if (!data.success || !data.url) {
                throw new Error(data.error || 'Upload failed');
            }
            setCoinLogoOverride(groupKey, data.url);
            showToast('Coin logo uploaded', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to upload coin logo', 'error');
        } finally {
            setUploadingGroupKey(null);
        }
    };

    const handleGatewayLogoUpload = async (configKey: string, file: File) => {
        setUploadingGatewayLogoKey(configKey);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'gateway-logos');

            const data = await uploadPublicImage(formData);
            if (!data.success || !data.url) {
                throw new Error(data.error || 'Upload failed');
            }

            set(configKey, data.url);
            showToast('Gateway logo uploaded', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to upload gateway logo', 'error');
        } finally {
            setUploadingGatewayLogoKey(null);
        }
    };

    const handleManualQrUpload = async (accountId: string, file: File) => {
        setUploadingManualAccountId(accountId);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'manual-upi-qr');

            const data = await uploadPublicImage(formData);
            if (!data.success || !data.url) {
                throw new Error(data.error || 'Upload failed');
            }
            updateManualAccount(accountId, 'qrImageUrl', data.url);
            showToast('Manual QR uploaded', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to upload manual QR', 'error');
        } finally {
            setUploadingManualAccountId(null);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const sanitizedManualAccounts = manualAccounts
                .map((account) => ({
                    id: account.id || createManualUpiAccountId(),
                    upiId: account.upiId.trim(),
                    qrImageUrl: account.qrImageUrl.trim(),
                }))
                .filter((account) => account.upiId);
            const primaryManualAccount = sanitizedManualAccounts[0];
            const normalizedOverrides = normalizeCurrencyOverridesForComparison(currencyOverrides);
            const serializedOverrides = JSON.stringify(normalizedOverrides);
            const res = await updateSystemConfig({
                UPI_GATEWAY_ORDER: config.UPI_GATEWAY_ORDER || 'CASHFREE,UPI1,UPI2,UPI3,UPI4,UPI5,UPI6',
                CASHFREE_ENABLED: config.CASHFREE_ENABLED ?? 'false',
                UPI1_ENABLED: config.UPI1_ENABLED ?? 'true',
                UPI2_ENABLED: config.UPI2_ENABLED ?? 'true',
                UPI3_ENABLED: config.UPI3_ENABLED ?? 'true',
                UPI4_ENABLED: config.UPI4_ENABLED ?? 'false',
                UPI5_ENABLED: config.UPI5_ENABLED ?? 'true',
                UPI6_ENABLED: config.UPI6_ENABLED ?? 'true',
                UPI9_ENABLED: config.UPI9_ENABLED ?? 'true',
                UPI_TEST_USERNAMES: config.UPI_TEST_USERNAMES || '',
                // Gateway display names & taglines
                CASHFREE_NAME: config.CASHFREE_NAME || 'Cashfree Gateway',
                CASHFREE_TAGLINE: config.CASHFREE_TAGLINE || 'Secure · Fast',
                CASHFREE_LOGO_URL: config.CASHFREE_LOGO_URL || '',
                UPI1_NAME: config.UPI1_NAME || 'UPI Gateway 1',
                UPI1_TAGLINE: config.UPI1_TAGLINE || 'NekPay · Instant',
                UPI1_LOGO_URL: config.UPI1_LOGO_URL || '',
                UPI2_NAME: config.UPI2_NAME || 'UPI Gateway 2',
                UPI2_TAGLINE: config.UPI2_TAGLINE || 'UPI / Bank · Fast',
                UPI2_LOGO_URL: config.UPI2_LOGO_URL || '',
                UPI3_NAME: config.UPI3_NAME || 'UPI Gateway 3',
                UPI3_TAGLINE: config.UPI3_TAGLINE || 'iPayment · Instant',
                UPI3_LOGO_URL: config.UPI3_LOGO_URL || '',
                UPI4_NAME: config.UPI4_NAME || 'UPI Gateway 4',
                UPI4_TAGLINE: config.UPI4_TAGLINE || 'Silkpay · Fast',
                UPI4_LOGO_URL: config.UPI4_LOGO_URL || '',
                UPI5_NAME: config.UPI5_NAME || 'UPI Gateway 5',
                UPI5_TAGLINE: config.UPI5_TAGLINE || 'RezorPay · Fast',
                UPI5_LOGO_URL: config.UPI5_LOGO_URL || '',
                UPI6_NAME: config.UPI6_NAME || 'UPI Gateway 6',
                UPI6_TAGLINE: config.UPI6_TAGLINE || 'A-Pay · Fast',
                UPI6_LOGO_URL: config.UPI6_LOGO_URL || '',
                UPI9_NAME: config.UPI9_NAME || 'UPI Gateway 9 (UltraPay)',
                UPI9_TAGLINE: config.UPI9_TAGLINE || 'UltraPay · Fast',
                UPI9_LOGO_URL: config.UPI9_LOGO_URL || '',
                MIN_DEPOSIT: config.MIN_DEPOSIT || '100',
                MIN_DEPOSIT_CASHFREE: config.MIN_DEPOSIT_CASHFREE || '100',
                MIN_DEPOSIT_UPI2: config.MIN_DEPOSIT_UPI2 || '200',
                MIN_DEPOSIT_UPI3: config.MIN_DEPOSIT_UPI3 || '100',
                MIN_DEPOSIT_UPI4: config.MIN_DEPOSIT_UPI4 || '100',
                MIN_DEPOSIT_UPI5: config.MIN_DEPOSIT_UPI5 || '300',
                MIN_DEPOSIT_UPI6: config.MIN_DEPOSIT_UPI6 || '100',
                MIN_DEPOSIT_UPI9: config.MIN_DEPOSIT_UPI9 || '100',
                MIN_DEPOSIT_CRYPTO: config.MIN_DEPOSIT_CRYPTO || '10',
                MAX_DEPOSIT: config.MAX_DEPOSIT || '',
                MIN_WITHDRAWAL: config.MIN_WITHDRAWAL || '500',
                MIN_WITHDRAWAL_CRYPTO: config.MIN_WITHDRAWAL_CRYPTO || '10',
                MAX_WITHDRAWAL: config.MAX_WITHDRAWAL || '',
                AUTO_WITHDRAW_FIAT_LIMIT: config.AUTO_WITHDRAW_FIAT_LIMIT || '1000',
                // Manual gateway (only relevant when no UPI gateway is active)
                MANUAL_PAYMENT_ENABLED: config.MANUAL_PAYMENT_ENABLED ?? 'true',
                MANUAL_UPI_ACCOUNTS: JSON.stringify(sanitizedManualAccounts),
                MANUAL_UPI_ID: primaryManualAccount?.upiId || '',
                MANUAL_QR_URL: primaryManualAccount?.qrImageUrl || '',
                NOWPAYMENTS_CURRENCY_OVERRIDES: serializedOverrides,
            });
            if (res.success) {
                setSavedCurrencyOverrides(normalizedOverrides);
                setConfig((current) => ({
                    ...current,
                    MANUAL_UPI_ACCOUNTS: JSON.stringify(sanitizedManualAccounts),
                    MANUAL_UPI_ID: primaryManualAccount?.upiId || '',
                    MANUAL_QR_URL: primaryManualAccount?.qrImageUrl || '',
                    NOWPAYMENTS_CURRENCY_OVERRIDES: serializedOverrides,
                }));
                showToast('Settings saved successfully!', 'success');
            } else {
                showToast('Failed to save settings', 'error');
            }
        } catch {
            showToast('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-400" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300' : 'bg-red-900/80 border-red-500/40 text-red-300'}`}>
                    <CheckCircle size={16} />
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                            <Wallet size={20} className="text-indigo-400" />
                        </span>
                        Deposit & Withdrawal Settings
                    </h1>
                    <p className="text-slate-400 mt-1 ml-[52px]">
                        Configure payment gateways and transaction limits.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                >
                    {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save All Settings</>}
                </button>
            </div>

            {/* ── SECTION 1: Payment Gateways ── */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
                    <RefreshCw size={18} className="text-emerald-400" />
                    <div>
                        <h2 className="text-white font-bold">Payment Gateways</h2>
                        <p className="text-slate-500 text-xs mt-0.5">
                            UPI gateways for 🇮🇳 India users · Crypto available globally
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {/* Gateway info banner */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-400 font-medium">
                        <CheckCircle size={13} />
                        Enable/disable UPI gateways, set names, logos, taglines, and drag to reorder how they appear to users.
                    </div>

                    {/* Ordered gateway cards */}
                    {(() => {
                        const GW_META: Record<string, { key: string; nameKey: string; tagKey: string; logoKey: string; minKey: string; defaultName: string; defaultTag: string; defaultMin: string; accentEnabled: string; accentBadge: string; icon: string }> = {
                            CASHFREE: { key: 'CASHFREE_ENABLED', nameKey: 'CASHFREE_NAME', tagKey: 'CASHFREE_TAGLINE', logoKey: 'CASHFREE_LOGO_URL', minKey: 'MIN_DEPOSIT_CASHFREE', defaultName: 'Cashfree Gateway', defaultTag: 'Secure · Fast', defaultMin: '100', accentEnabled: 'border-orange-500/40 bg-orange-500/5', accentBadge: 'bg-orange-500/15 text-orange-400', icon: '💳' },
                            UPI1: { key: 'UPI1_ENABLED', nameKey: 'UPI1_NAME', tagKey: 'UPI1_TAGLINE', logoKey: 'UPI1_LOGO_URL', minKey: 'MIN_DEPOSIT', defaultName: 'UPI Gateway 1', defaultTag: 'NekPay · Instant', defaultMin: '100', accentEnabled: 'border-emerald-500/40 bg-emerald-500/5', accentBadge: 'bg-emerald-500/15 text-emerald-400', icon: '🏦' },
                            UPI2: { key: 'UPI2_ENABLED', nameKey: 'UPI2_NAME', tagKey: 'UPI2_TAGLINE', logoKey: 'UPI2_LOGO_URL', minKey: 'MIN_DEPOSIT_UPI2', defaultName: 'UPI Gateway 2', defaultTag: 'UPI / Bank · Fast', defaultMin: '200', accentEnabled: 'border-blue-500/40 bg-blue-500/5', accentBadge: 'bg-blue-500/15 text-blue-400', icon: '📲' },
                            UPI3: { key: 'UPI3_ENABLED', nameKey: 'UPI3_NAME', tagKey: 'UPI3_TAGLINE', logoKey: 'UPI3_LOGO_URL', minKey: 'MIN_DEPOSIT_UPI3', defaultName: 'UPI Gateway 3', defaultTag: 'iPayment · Instant', defaultMin: '100', accentEnabled: 'border-violet-500/40 bg-violet-500/5', accentBadge: 'bg-violet-500/15 text-violet-400', icon: '⚡' },
                            UPI4: { key: 'UPI4_ENABLED', nameKey: 'UPI4_NAME', tagKey: 'UPI4_TAGLINE', logoKey: 'UPI4_LOGO_URL', minKey: 'MIN_DEPOSIT_UPI4', defaultName: 'UPI Gateway 4', defaultTag: 'Silkpay · Fast', defaultMin: '100', accentEnabled: 'border-fuchsia-500/40 bg-fuchsia-500/5', accentBadge: 'bg-fuchsia-500/15 text-fuchsia-400', icon: '🚀' },
                            UPI5: { key: 'UPI5_ENABLED', nameKey: 'UPI5_NAME', tagKey: 'UPI5_TAGLINE', logoKey: 'UPI5_LOGO_URL', minKey: 'MIN_DEPOSIT_UPI5', defaultName: 'UPI Gateway 5', defaultTag: 'RezorPay · Fast', defaultMin: '300', accentEnabled: 'border-rose-500/40 bg-rose-500/5', accentBadge: 'bg-rose-500/15 text-rose-400', icon: '🔥' },
                            UPI6: { key: 'UPI6_ENABLED', nameKey: 'UPI6_NAME', tagKey: 'UPI6_TAGLINE', logoKey: 'UPI6_LOGO_URL', minKey: 'MIN_DEPOSIT_UPI6', defaultName: 'UPI Gateway 6', defaultTag: 'A-Pay · Fast', defaultMin: '100', accentEnabled: 'border-teal-500/40 bg-teal-500/5', accentBadge: 'bg-teal-500/15 text-teal-400', icon: '🔗' },
                            UPI9: { key: 'UPI9_ENABLED', nameKey: 'UPI9_NAME', tagKey: 'UPI9_TAGLINE', logoKey: 'UPI9_LOGO_URL', minKey: 'MIN_DEPOSIT_UPI9', defaultName: 'UPI Gateway 9 (UltraPay)', defaultTag: 'UltraPay · Fast', defaultMin: '100', accentEnabled: 'border-amber-500/40 bg-amber-500/5', accentBadge: 'bg-amber-500/15 text-amber-400', icon: '⚡' },
                        };
                        const orderStr: string = config.UPI_GATEWAY_ORDER || 'CASHFREE,UPI1,UPI2,UPI3,UPI4,UPI5,UPI6,UPI9';
                        const order: string[] = orderStr.split(',').map((s: string) => s.trim()).filter((s: string) => s in GW_META);
                        // Ensure all IDs present (in case config is partial)
                        ['CASHFREE', 'UPI1', 'UPI2', 'UPI3', 'UPI4', 'UPI5', 'UPI6', 'UPI9'].forEach(id => { if (!order.includes(id)) order.push(id); });

                        const moveUp = (idx: number) => {
                            if (idx === 0) return;
                            const next = [...order];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            set('UPI_GATEWAY_ORDER', next.join(','));
                        };
                        const moveDown = (idx: number) => {
                            if (idx === order.length - 1) return;
                            const next = [...order];
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            set('UPI_GATEWAY_ORDER', next.join(','));
                        };

                        return (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {order.map((id, idx) => {
                                    const { key, nameKey, tagKey, logoKey, minKey, defaultName, defaultTag, defaultMin, accentEnabled, accentBadge, icon } = GW_META[id];
                                    const enabled = config[key] !== 'false';
                                    const previewLogo = config[logoKey]?.trim() || '';
                                    return (
                                        <div key={id} className={`rounded-xl border p-4 space-y-3 transition-all ${enabled ? accentEnabled : 'border-slate-700 opacity-60'}`}>
                                            {/* Order controls + position badge */}
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mr-auto">#{idx + 1} shown</span>
                                                <button
                                                    type="button"
                                                    onClick={() => moveUp(idx)}
                                                    disabled={idx === 0}
                                                    className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                                                    title="Move up"
                                                >
                                                    <ChevronUp size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveDown(idx)}
                                                    disabled={idx === order.length - 1}
                                                    className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                                                    title="Move down"
                                                >
                                                    <ChevronDown size={13} />
                                                </button>
                                            </div>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0 mr-3">
                                                    {/* Icon + Editable Name row */}
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-base leading-none text-white">
                                                            {previewLogo ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={previewLogo} alt={config[nameKey] || defaultName} className="h-full w-full object-contain p-2" />
                                                            ) : (
                                                                icon
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <input
                                                                type="text"
                                                                value={config[nameKey] || ''}
                                                                onChange={e => set(nameKey, e.target.value)}
                                                                placeholder={defaultName}
                                                                className="w-full bg-transparent border-b border-slate-600 focus:border-indigo-400 outline-none text-sm font-bold text-white pb-0.5 placeholder:text-slate-500 transition-colors"
                                                            />
                                                            {/* Editable Tagline */}
                                                            <input
                                                                type="text"
                                                                value={config[tagKey] || ''}
                                                                onChange={e => set(tagKey, e.target.value)}
                                                                placeholder={defaultTag}
                                                                className="mt-2 w-full bg-transparent border-b border-slate-700 focus:border-indigo-400/60 outline-none text-[11px] text-slate-500 pb-0.5 placeholder:text-slate-600 transition-colors"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={enabled}
                                                        onChange={e => set(key, e.target.checked ? 'true' : 'false')}
                                                    />
                                                    <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                                                </label>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    Logo URL
                                                </label>
                                                <input
                                                    type="text"
                                                    value={config[logoKey] || ''}
                                                    onChange={e => set(logoKey, e.target.value)}
                                                    placeholder="https://cdn.example.com/payment-logo.png"
                                                    className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:border-indigo-500">
                                                        {uploadingGatewayLogoKey === logoKey ? 'Uploading…' : 'Upload Logo'}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) void handleGatewayLogoUpload(logoKey, file);
                                                                e.currentTarget.value = '';
                                                            }}
                                                        />
                                                    </label>
                                                    {config[logoKey] && (
                                                        <button
                                                            type="button"
                                                            onClick={() => set(logoKey, '')}
                                                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-red-500 hover:text-red-300"
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Min deposit for this gateway */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500 shrink-0">Min ₹</span>
                                                <input
                                                    type="number"
                                                    value={config[minKey] || ''}
                                                    onChange={e => set(minKey, e.target.value)}
                                                    placeholder={defaultMin}
                                                    className="w-full bg-slate-900/60 border border-slate-700 focus:border-indigo-400 outline-none text-xs font-mono text-white rounded-lg px-2.5 py-1.5 placeholder:text-slate-600 transition-colors"
                                                />
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${enabled ? accentBadge : 'bg-slate-700 text-slate-500'}`}>
                                                    {enabled ? '● ACTIVE' : '○ DISABLED'}
                                                </span>
                                                <span className="text-[10px] text-slate-600 font-mono">{id}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* Crypto — always on */}
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-white">Crypto Gateway</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">NowPayments · Always available for all users worldwide</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-400">● ALWAYS ON</span>
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm font-bold text-white">Crypto Coin Manager</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Rename coins, upload logos, and add extra chain codes. Your overrides are stored separately and stay applied after NOWPayments sync.
                                </p>
                                <p className="text-[10px] text-slate-600 mt-1">
                                    Last NOWPayments sync: {config.NOWPAYMENTS_FULL_CURRENCIES_SYNCED_AT || 'Not synced yet'}
                                </p>
                            </div>
                            <div className="relative w-full md:w-72">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={coinSearch}
                                    onChange={(e) => setCoinSearch(e.target.value)}
                                    placeholder="Search coin or ticker"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-9 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{filteredNowPaymentsCoins.length} currencies</span>
                            <span>{pendingOverrideCount} override{pendingOverrideCount === 1 ? '' : 's'} pending save</span>
                        </div>

                        <div className="max-h-[900px] space-y-3 overflow-y-auto pr-1">
                            {filteredNowPaymentsCoins.map((coin) => {
                                const override = currencyOverrides[coin.groupKey] || {};
                                const manualNetworks = override.networks || [];
                                const previewLogo = override.logoUrl ?? coin.syncedLogoUrl;

                                return (
                                    <div key={coin.groupKey} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-lg font-bold text-indigo-300">
                                                    {previewLogo ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={previewLogo} alt={coin.label} className="h-full w-full object-cover" />
                                                    ) : (
                                                        coin.code.slice(0, 1)
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                                                            {coin.code}
                                                        </span>
                                                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                                            {coin.groupKey}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-sm font-semibold text-white">{coin.syncedLabel}</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        Synced {coin.syncedNetworks.length} chain{coin.syncedNetworks.length === 1 ? '' : 's'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid w-full gap-3 lg:max-w-xl lg:grid-cols-[minmax(0,1fr)_220px]">
                                                <div>
                                                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                        Coin Name Override
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={override.label || ''}
                                                        onChange={(e) => setCoinLabelOverride(coin.groupKey, e.target.value)}
                                                        placeholder={coin.syncedLabel}
                                                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                        Logo Upload
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:border-indigo-500">
                                                            {uploadingGroupKey === coin.groupKey ? 'Uploading…' : 'Upload Logo'}
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) void handleCoinLogoUpload(coin.groupKey, file);
                                                                    e.currentTarget.value = '';
                                                                }}
                                                            />
                                                        </label>
                                                        {override.logoUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setCoinLogoOverride(coin.groupKey, null)}
                                                                className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-red-500 hover:text-red-300"
                                                            >
                                                                Clear
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Synced Chains</p>
                                                    <span className="text-[10px] text-slate-600">{coin.syncedNetworks.length} total</span>
                                                </div>
                                                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                                                    {coin.syncedNetworks.map((network) => (
                                                        <div key={network.id} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] text-slate-300">
                                                            {network.network} · {network.code}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Manual Chains</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => addManualChain(coin.groupKey, coin.code)}
                                                        className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20"
                                                    >
                                                        Add Chain
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {manualNetworks.length === 0 ? (
                                                        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-5 text-center text-[11px] text-slate-500">
                                                            No manual chains added for this currency.
                                                        </div>
                                                    ) : (
                                                        manualNetworks.map((network, index) => (
                                                            <div key={`${coin.groupKey}-${index}`} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                                                                <input
                                                                    type="text"
                                                                    value={network.id}
                                                                    onChange={(e) => updateManualChain(coin.groupKey, index, 'id', e.target.value)}
                                                                    placeholder="NOWPayments pay currency code"
                                                                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={network.network}
                                                                    onChange={(e) => updateManualChain(coin.groupKey, index, 'network', e.target.value)}
                                                                    placeholder="Network label"
                                                                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeManualChain(coin.groupKey, index)}
                                                                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-red-500 hover:text-red-300"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── SECTION 1.5: Test Environment configuration ── */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
                    <AlertTriangle size={18} className="text-amber-400" />
                    <div>
                        <h2 className="text-white font-bold">Test Environment Routing</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Whitelist users to test UPI3 and UPI4 on the live site</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center justify-between">
                            <span>Test Usernames</span>
                            <span className="text-slate-500 font-normal">Comma-separated</span>
                        </label>
                        <textarea
                            value={config.UPI_TEST_USERNAMES || ''}
                            onChange={(e) => set('UPI_TEST_USERNAMES', e.target.value)}
                            placeholder="e.g., testuser1, admin, harsh"
                            className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none placeholder-slate-600 resize-none"
                        />
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                            <strong className="text-amber-400/80">Only these exact usernames</strong> (case-insensitive) will be able to see and use <strong>Gateway 3</strong> and <strong>Gateway 4</strong> when active.
                            Leave blank to disable Gateways 3 and 4 entirely.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── SECTION 2: Manual Gateway (shown only when no UPI gateway is active) ── */}
            {noGatewayActive ? (
                <div className="bg-slate-800 rounded-2xl border border-amber-500/40 overflow-hidden">
                    <div className="px-6 py-4 border-b border-amber-500/20 flex items-center gap-3">
                        <QrCode size={18} className="text-amber-400" />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h2 className="text-white font-bold">Manual Gateway</h2>
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">FALLBACK ACTIVE</span>
                            </div>
                            <p className="text-slate-500 text-xs mt-0.5">
                                Shown to users because all UPI gateways are disabled. Users scan a QR code and submit UTR for manual approval.
                            </p>
                        </div>
                        {/* Enable/disable toggle */}
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.MANUAL_PAYMENT_ENABLED !== 'false'}
                                onChange={e => set('MANUAL_PAYMENT_ENABLED', e.target.checked ? 'true' : 'false')}
                            />
                            <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                        </label>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: fields */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manual UPI Accounts</p>
                                        <p className="text-[10px] text-slate-600 mt-1">
                                            Users get one random account from this list each time they open Manual UPI.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addManualAccount}
                                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/15"
                                    >
                                        Add Account
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {manualAccounts.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-700 px-4 py-5 text-center text-xs text-slate-500">
                                            No manual UPI accounts added yet. Add at least one account to enable random assignment.
                                        </div>
                                    ) : (
                                        manualAccounts.map((account, index) => (
                                            <div key={account.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.24em] font-semibold">
                                                            Account {index + 1}
                                                        </p>
                                                        <div className="mt-1 inline-flex max-w-full items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                                                            <span className="truncate">
                                                                {account.upiId ? buildManualUpiAccountTag(account.upiId) : 'Manual UPI'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {manualAccounts.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeManualAccount(account.id)}
                                                            className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-400 hover:border-red-500 hover:text-red-300"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                                        UPI ID / VPA
                                                        <span className="ml-1.5 text-slate-600 text-xs font-normal normal-case">e.g. payments@yourbank</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={account.upiId}
                                                        onChange={e => updateManualAccount(account.id, 'upiId', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:border-amber-500 focus:outline-none placeholder-slate-600"
                                                        placeholder="yourname@upi"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                                        QR Image URL
                                                        <span className="ml-1.5 text-slate-600 text-xs font-normal normal-case">optional override</span>
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={account.qrImageUrl}
                                                        onChange={e => updateManualAccount(account.id, 'qrImageUrl', e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none placeholder-slate-600"
                                                        placeholder="https://example.com/qr.png"
                                                    />
                                                    <div className="mt-2 flex items-center justify-between gap-3">
                                                        <p className="text-[10px] text-slate-600">
                                                            Leave blank to auto-generate QR from this UPI ID.
                                                        </p>
                                                        <label className="shrink-0 cursor-pointer rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:border-amber-500 hover:text-amber-300">
                                                            {uploadingManualAccountId === account.id ? 'Uploading…' : 'Upload QR'}
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) void handleManualQrUpload(account.id, file);
                                                                    e.currentTarget.value = '';
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">QR Preview</p>
                                                    {account.qrImageUrl ? (
                                                        <img
                                                            src={account.qrImageUrl}
                                                            alt={`Manual UPI QR ${index + 1}`}
                                                            className="h-28 w-28 rounded-lg bg-white p-1 object-contain"
                                                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    ) : account.upiId ? (
                                                        <div className="w-28 h-28 rounded-lg bg-white text-slate-700 text-[10px] font-semibold flex items-center justify-center text-center p-2 leading-relaxed">
                                                            QR auto-generated from
                                                            <br />
                                                            {account.upiId}
                                                        </div>
                                                    ) : (
                                                        <div className="w-28 h-28 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-center text-[10px] text-slate-600 p-2 leading-relaxed">
                                                            Add a UPI ID to preview this account
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className={`rounded-xl p-3 border text-xs flex items-center gap-2 ${
                                    config.MANUAL_PAYMENT_ENABLED !== 'false'
                                        ? 'bg-amber-500/8 border-amber-500/25 text-amber-400'
                                        : 'bg-slate-900 border-slate-700 text-slate-500'
                                }`}>
                                    {config.MANUAL_PAYMENT_ENABLED !== 'false' ? (
                                        <><CheckCircle size={13} className="shrink-0" /><span><strong>Active</strong> — shown to users as the only deposit option.</span></>
                                    ) : (
                                        <><AlertTriangle size={13} className="shrink-0" /><span><strong>Disabled</strong> — no deposit option will be available to users!</span></>
                                    )}
                                </div>
                            </div>

                            {/* Right: QR preview */}
                            <div className="flex flex-col gap-4 bg-slate-900 rounded-xl border border-slate-700 p-5">
                                <div>
                                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Random Assignment</p>
                                    <p className="text-sm text-slate-300 mt-2">
                                        {manualAccounts.length > 0
                                            ? `${manualAccounts.filter(account => account.upiId.trim()).length} manual UPI account${manualAccounts.filter(account => account.upiId.trim()).length === 1 ? '' : 's'} ready for rotation.`
                                            : 'Add accounts on the left to start rotating UPI targets.'}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-slate-300 space-y-2">
                                    <p className="font-semibold text-amber-300">What users will see</p>
                                    <p>1 random manual account is picked when the manual deposit screen opens.</p>
                                    <p>The chosen account is stored with the deposit request so admins can match the UTR against the correct UPI ID.</p>
                                    <p>Support contacts are still managed in Site Settings.</p>
                                </div>

                                {manualAccounts[0]?.upiId && (
                                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Sample Tag</p>
                                        <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                                            <span className="truncate">{buildManualUpiAccountTag(manualAccounts[0].upiId)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Info banner when gateways are active */
                <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-800/50 border border-slate-700 rounded-2xl text-sm text-slate-400">
                    <Info size={16} className="shrink-0 text-slate-500" />
                    <p>
                        <strong className="text-slate-300">Manual Gateway</strong> settings are available only when all UPI gateways are disabled.
                        Disable both <strong className="text-slate-300">UPI Gateway 1</strong> and <strong className="text-slate-300">UPI Gateway 2</strong> above to configure the manual fallback.
                    </p>
                </div>
            )}

            {/* ── SECTION 3: Deposit Limits ── */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
                    <ArrowDownRight size={18} className="text-emerald-400" />
                    <div>
                        <h2 className="text-white font-bold">Deposit Limits</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Minimum and maximum deposit amounts per gateway</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { key: 'MIN_DEPOSIT', label: 'Min Deposit', sub: 'UPI Gateway 1 (INR)', placeholder: '100', color: 'emerald' },
                            { key: 'MIN_DEPOSIT_UPI2', label: 'Min Deposit', sub: 'UPI Gateway 2 (INR)', placeholder: '200', color: 'blue' },
                            { key: 'MIN_DEPOSIT_UPI3', label: 'Min Deposit', sub: 'UPI Gateway 3 (INR)', placeholder: '100', color: 'violet' },
                            { key: 'MIN_DEPOSIT_UPI4', label: 'Min Deposit', sub: 'UPI Gateway 4 (INR)', placeholder: '100', color: 'fuchsia' },
                            { key: 'MIN_DEPOSIT_UPI5', label: 'Min Deposit', sub: 'UPI Gateway 5 (INR)', placeholder: '300', color: 'rose' },
                            { key: 'MIN_DEPOSIT_UPI6', label: 'Min Deposit', sub: 'UPI Gateway 6 (INR)', placeholder: '100', color: 'teal' },
                            { key: 'MIN_DEPOSIT_UPI9', label: 'Min Deposit', sub: 'UPI Gateway 9 / UltraPay (INR)', placeholder: '100', color: 'amber' },
                            { key: 'MIN_DEPOSIT_CRYPTO', label: 'Min Deposit', sub: 'Crypto (USD)', placeholder: '10', color: 'amber' },
                        ].map(({ key, label, sub, placeholder, color }) => (
                            <div key={key} className={`bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-${color}-500/40 transition-colors`}>
                                <label className="block text-xs font-bold text-slate-400 mb-0.5">{label}</label>
                                <p className={`text-[10px] text-${color}-400/70 mb-2`}>{sub}</p>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold pointer-events-none">
                                        {key.includes('CRYPTO') ? '$' : '₹'}
                                    </span>
                                    <input
                                        type="number"
                                        value={config[key] || ''}
                                        onChange={e => set(key, e.target.value)}
                                        placeholder={placeholder}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                            <label className="block text-xs font-bold text-slate-400 mb-0.5">Max Deposit</label>
                            <p className="text-[10px] text-slate-500 mb-2">All gateways — 0 or blank = unlimited</p>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold pointer-events-none">₹</span>
                                <input
                                    type="number"
                                    value={config.MAX_DEPOSIT || ''}
                                    onChange={e => set('MAX_DEPOSIT', e.target.value)}
                                    placeholder="0 = Unlimited"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SECTION 4: Withdrawal Limits ── */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
                    <ArrowUpRight size={18} className="text-red-400" />
                    <div>
                        <h2 className="text-white font-bold">Withdrawal Limits</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Global withdrawal constraints and auto-dispatch thresholds</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { key: 'MIN_WITHDRAWAL', label: 'Min Withdrawal', sub: 'Fiat / INR', placeholder: '500', prefix: '₹' },
                            { key: 'MIN_WITHDRAWAL_CRYPTO', label: 'Min Withdrawal', sub: 'Crypto (USD)', placeholder: '10', prefix: '$' },
                            { key: 'MAX_WITHDRAWAL', label: 'Max Withdrawal', sub: 'INR — 0 = Unlimited', placeholder: '0', prefix: '₹' },
                            { key: 'AUTO_WITHDRAW_FIAT_LIMIT', label: 'Auto-Dispatch Limit', sub: 'INR — above this → admin review', placeholder: '1000', prefix: '₹' },
                        ].map(({ key, label, sub, placeholder, prefix }) => (
                            <div key={key} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                                <label className="block text-xs font-bold text-slate-400 mb-0.5">{label}</label>
                                <p className="text-[10px] text-slate-500 mb-2">{sub}</p>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold pointer-events-none">{prefix}</span>
                                    <input
                                        type="number"
                                        value={config[key] || ''}
                                        onChange={e => set(key, e.target.value)}
                                        placeholder={placeholder}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Info banner */}
            <div className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-slate-400">
                <Shield size={16} className="shrink-0 text-indigo-400" />
                <p>Changes are applied live. The Deposit and Withdraw modals on the website will reflect the new defaults within 60 seconds (or immediately on a fresh modal open).</p>
            </div>

            {/* Bottom save */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20 text-sm"
                >
                    {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save All Settings</>}
                </button>
            </div>
        </div>
    );
}
