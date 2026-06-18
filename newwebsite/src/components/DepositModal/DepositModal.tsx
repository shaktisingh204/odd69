'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/context/ModalContext';
import api from '@/services/api';
import { getCurrencySymbol } from '@/utils/currency';
import QRCode from 'react-qr-code';
import {
    X,
    Check,
    Copy,
    Loader2,
    CheckCircle2,
    Gift,
    RefreshCw,
    ArrowLeft,
    ChevronDown,
    Search,
} from 'lucide-react';
import { countries } from '@/config/countries';
import { BonusPromotion } from '@/services/promotions';
import toast from 'react-hot-toast';


interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface CryptoOption {
    id: string;
    label: string;
    network: string;
    icon: string;
    color: string;
}

interface NowPaymentsNetworkOption extends CryptoOption {
    code: string;
    logoUrl: string | null;
    enabled: boolean;
    isAvailableForPayment: boolean;
}

interface NowPaymentsCurrenciesResponse {
    success: boolean;
    coins: Array<{
        code: string;
        label: string;
        logoUrl: string | null;
        networks: NowPaymentsNetworkOption[];
    }>;
    syncedAt: string | null;
}

interface GatewayOption {
    id: string;
    label: string;
    sub: string;
    icon: string;
    logoUrl?: string | null;
    minDeposit: number;
    badge?: string;
}

const defaultCryptoOptions: CryptoOption[] = [
    { id: 'usdttrc20', label: 'USDT', network: 'TRC20', icon: '₮', color: '#26A17B' },
    { id: 'usdterc20', label: 'USDT', network: 'ERC20', icon: '₮', color: '#26A17B' },
    { id: 'btc', label: 'Bitcoin', network: 'BTC', icon: '₿', color: '#F7931A' },
    { id: 'eth', label: 'Ethereum', network: 'ERC20', icon: 'Ξ', color: '#627EEA' },
    { id: 'bnb', label: 'BNB', network: 'BEP20', icon: 'B', color: '#F3BA2F' },
    { id: 'ltc', label: 'Litecoin', network: 'LTC', icon: 'Ł', color: '#BFBBBB' },
    { id: 'xrp', label: 'XRP', network: 'XRP', icon: '✕', color: '#346AA9' },
    { id: 'trx', label: 'TRON', network: 'TRC20', icon: '◈', color: '#EF0027' },
];

const popularNowPaymentsCoinIds = new Set([
    'btc',
    'eth',
    'xrp',
    'usdt',
    'ltc',
    'bch',
    'doge',
    'xno',
    'xmr',
    'dash',
    'vet',
    'uni',
    'sol',
    'ada',
    'shib',
    'dgb',
    'trx',
    'usdttrc20',
    'usdtbsc',
    'usdterc20',
    'usdtsol',
    'usdc',
    'usdcmatic',
    'usdtmatic',
    'usdcsol',
]);

const quickAmountsFiat = ['500', '1000', '2000', '5000', '10000'];
const quickAmountsUPI2 = ['200', '500', '1000', '2000', '5000'];
const quickAmountsCrypto = ['20', '50', '100', '200', '500'];
const manualDepositBonusCodeKey = 'manualDepositBonusCode';

const parseAmountList = (value?: string) => {
    if (!value) return [];
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !Number.isNaN(Number(entry)) && Number(entry) > 0);
};

const buildQuickAmounts = (minimum: number, configuredValue?: string, fallback: string[] = []) => {
    const configured = parseAmountList(configuredValue);

    let baseAmounts: number[] = [];
    if (configured.length) {
        baseAmounts = configured.map(Number);
    } else {
        baseAmounts = minimum > 0
            ? [minimum, minimum * 2, minimum * 5, minimum * 10, minimum * 20]
            : fallback.map(Number);
    }

    if (minimum > 0) {
        baseAmounts = [minimum, ...baseAmounts.filter((val) => val !== minimum)];
    }

    return Array.from(new Set(baseAmounts.filter((value) => Number.isFinite(value) && value > 0)))
        .slice(0, 5)
        .map((value) => String(Number(value.toFixed(2))).replace(/\.0+$/, ''));
};

const parseCryptoOptionsConfig = (value?: string): CryptoOption[] => {
    if (!value) return defaultCryptoOptions;

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return defaultCryptoOptions;

        const normalized = parsed
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const option = entry as Partial<CryptoOption>;
                if (!option.id || !option.label || !option.network || !option.icon || !option.color) return null;
                return {
                    id: String(option.id),
                    label: String(option.label),
                    network: String(option.network),
                    icon: String(option.icon),
                    color: String(option.color),
                };
            })
            .filter(Boolean) as CryptoOption[];

        return normalized.length ? normalized : defaultCryptoOptions;
    } catch {
        return defaultCryptoOptions;
    }
};

const buildFallbackCryptoOption = (currencyCode: string): CryptoOption => {
    const normalizedId = currencyCode.toLowerCase();
    const upperCode = currencyCode.toUpperCase();

    const exactFallbackLabels: Record<string, { label: string; network: string }> = {
        btc: { label: 'Bitcoin', network: 'BTC' },
        eth: { label: 'Ethereum', network: 'ETH' },
        xrp: { label: 'XRP', network: 'XRP' },
        ltc: { label: 'Litecoin', network: 'LTC' },
        bch: { label: 'Bitcoin Cash', network: 'BCH' },
        doge: { label: 'Dogecoin', network: 'DOGE' },
        xmr: { label: 'Monero', network: 'XMR' },
        dash: { label: 'Dash', network: 'DASH' },
        vet: { label: 'VeChain', network: 'VET' },
        uni: { label: 'Uniswap', network: 'UNI' },
        sol: { label: 'Solana', network: 'SOL' },
        ada: { label: 'Cardano', network: 'ADA' },
        shib: { label: 'Shiba Inu', network: 'SHIB' },
        dgb: { label: 'DigiByte', network: 'DGB' },
        trx: { label: 'TRON', network: 'TRX' },
        usdttrc20: { label: 'Tether', network: 'TRC20' },
        usdtbsc: { label: 'Tether', network: 'BSC' },
        usdterc20: { label: 'Tether', network: 'ERC20' },
        usdtsol: { label: 'Tether', network: 'Solana' },
        usdtmatic: { label: 'Tether', network: 'Polygon' },
        usdc: { label: 'USD Coin', network: 'USDC' },
        usdcmatic: { label: 'USD Coin', network: 'Polygon' },
        usdcsol: { label: 'USD Coin', network: 'Solana' },
        usdt: { label: 'Tether', network: 'USDT' },
        bnbbsc: { label: 'BNB', network: 'BSC' },
    };

    const exactMatch = exactFallbackLabels[normalizedId];
    if (exactMatch) {
        return {
            id: normalizedId,
            label: exactMatch.label,
            network: exactMatch.network,
            icon: upperCode.slice(0, 1),
            color: '#F5C451',
        };
    }

    const networkPatterns: Array<{ suffix: string; network: string }> = [
        { suffix: 'TRC20', network: 'TRC20' },
        { suffix: 'ERC20', network: 'ERC20' },
        { suffix: 'BSC', network: 'BSC' },
        { suffix: 'SOL', network: 'Solana' },
        { suffix: 'MATIC', network: 'Polygon' },
        { suffix: 'ARB', network: 'Arbitrum' },
        { suffix: 'MAINNET', network: 'Mainnet' },
    ];

    for (const pattern of networkPatterns) {
        if (upperCode.endsWith(pattern.suffix) && upperCode.length > pattern.suffix.length) {
            const baseCode = upperCode.slice(0, -pattern.suffix.length);
            return {
                id: normalizedId,
                label: baseCode,
                network: pattern.network,
                icon: baseCode.slice(0, 1) || upperCode.slice(0, 1),
                color: '#F5C451',
            };
        }
    }

    return {
        id: normalizedId,
        label: upperCode,
        network: upperCode,
        icon: upperCode.slice(0, 1),
        color: '#F5C451',
    };
};

const buildCoinMonogram = (label: string, code: string) => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return code.slice(0, 2).toUpperCase();

    const parts = normalizedLabel.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }

    return normalizedLabel.slice(0, 2).toUpperCase();
};

type CryptoStep = 'configure' | 'awaiting' | 'success';
type DepositCurrency = 'INR' | 'CRYPTO';

interface PaymentData {
    paymentId: string;
    payAddress: string;
    payAmount: number;
    payCurrency: string;
    expiresAt: string | null;
    transactionDbId: number;
}

interface GatewayRetryState {
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

interface PromoValidationResult {
    valid: boolean;
    hasConflict: boolean;
    conflictBonus: { applicableTo: string; title: string } | null;
    bonus: {
        id: string;
        code: string;
        title: string;
        description?: string;
        type: string;
        applicableTo: string;
        currency: DepositCurrency | 'BOTH';
        percentage: number;
        amount: number;
        minDeposit: number;
        minDepositFiat?: number;
        minDepositCrypto?: number;
        maxBonus: number;
        wageringRequirement: number;
        depositWagerMultiplier: number;
        expiryDays: number;
        validUntil?: string | null;
        forFirstDepositOnly: boolean;
    };
    estimatedBonus: number;
    wageringRequired: number;
    depositWageringRequired: number;
    eligibility: {
        depositCurrency: DepositCurrency;
        approvedDepositCount: number;
        isFirstDeposit: boolean;
        requiresFirstDeposit: boolean;
        minDeposit: number;
        minDepositMet: boolean;
        minDepositShortfall: number;
    };
}

const sanitizeAmountInput = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const [whole, ...fractionParts] = sanitized.split('.');
    if (!fractionParts.length) return whole;
    return `${whole}.${fractionParts.join('').slice(0, 2)}`;
};

const formatAmount = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error !== null) {
        const maybeError = error as {
            response?: { data?: { message?: string } };
            message?: string;
        };
        return maybeError.response?.data?.message || maybeError.message || fallback;
    }
    return fallback;
};

export default function DepositModal({ isOpen, onClose }: DepositModalProps) {
    const { user } = useAuth();
    const { openManualDeposit, depositInitialTab, depositAllowFiatTab } = useModal();

    // STRICT: fiat is ONLY for users whose registered country is exactly 'IN'.
    // Do NOT use a fallback of 'IN' — missing/null country means NOT India.
    const isIndia = user?.country === 'IN';
    // Dynamic fiat currency symbol
    const fiatSymbol = getCurrencySymbol('USD');
    const currentCountry = countries.find((country) => country.code === user?.country) ?? countries[0];

    // Indian users default to fiat unless this modal was opened in crypto-only mode.
    const [activeTab, setActiveTab] = useState<'fiat' | 'crypto'>(isIndia ? 'fiat' : 'crypto');
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [iframeUrl, setIframeUrl] = useState<string | null>(null);
    const [publicSettings, setPublicSettings] = useState<Record<string, string>>({});
    const [gatewayRetryState, setGatewayRetryState] = useState<GatewayRetryState | null>(null);
    const [gatewayRetryStateLoading, setGatewayRetryStateLoading] = useState(false);

    // Promo code state
    const [promoCode, setPromoCode] = useState<string>('');
    const [promoValidating, setPromoValidating] = useState(false);
    const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null);
    const [promoError, setPromoError] = useState<string>('');
    const promoTimerRef = useRef<NodeJS.Timeout | null>(null);
    const promoRequestRef = useRef(0);

    const [minDeposit, setMinDeposit] = useState<number>(100);
    const [minDepositUPI2, setMinDepositUPI2] = useState<number>(200);
    const [minDepositUPI0, setMinDepositUPI0] = useState<number>(100);
    const [minDepositUPI3, setMinDepositUPI3] = useState<number>(100);
    const [minDepositUPI4, setMinDepositUPI4] = useState<number>(100);
    const [minDepositUPI5, setMinDepositUPI5] = useState<number>(100);
    const [minDepositUPI6, setMinDepositUPI6] = useState<number>(100);
    const [minDepositUPI9, setMinDepositUPI9] = useState<number>(100);
    const [minDepositCashfree, setMinDepositCashfree] = useState<number>(100);
    const [minDepositCrypto, setMinDepositCrypto] = useState<number>(10);

    // Gateway config from SystemConfig
    const [upi1Enabled, setUpi1Enabled] = useState<boolean>(true);
    const [upi2Enabled, setUpi2Enabled] = useState<boolean>(true);
    const [upi3Enabled, setUpi3Enabled] = useState<boolean>(true);
    const [upi4Enabled, setUpi4Enabled] = useState<boolean>(false);
    const [upi5Enabled, setUpi5Enabled] = useState<boolean>(true);
    const [upi6Enabled, setUpi6Enabled] = useState<boolean>(true);
    const [upi9Enabled, setUpi9Enabled] = useState<boolean>(true);
    const [cashfreeEnabled, setCashfreeEnabled] = useState<boolean>(false);
    // Gateway display names & taglines (admin-configurable)
    const [upi1Name, setUpi1Name] = useState('UPI Gateway 1');
    const [upi1Tag, setUpi1Tag] = useState('NekPay · Instant');
    const [upi1LogoUrl, setUpi1LogoUrl] = useState('');
    const [upi2Name, setUpi2Name] = useState('UPI Gateway 2');
    const [upi2Tag, setUpi2Tag] = useState('UPI / Bank · Fast');
    const [upi2LogoUrl, setUpi2LogoUrl] = useState('');
    const [upi3Name, setUpi3Name] = useState('UPI Gateway 3');
    const [upi3Tag, setUpi3Tag] = useState('iPayment · Instant');
    const [upi3LogoUrl, setUpi3LogoUrl] = useState('');
    const [upi4Name, setUpi4Name] = useState('UPI Gateway 4');
    const [upi4Tag, setUpi4Tag] = useState('Silkpay · Fast');
    const [upi4LogoUrl, setUpi4LogoUrl] = useState('');
    const [upi5Name, setUpi5Name] = useState('UPI Gateway 5');
    const [upi5Tag, setUpi5Tag] = useState('RezorPay · Fast');
    const [upi5LogoUrl, setUpi5LogoUrl] = useState('');
    const [upi6Name, setUpi6Name] = useState('Gateway 6 (A-Pay)');
    const [upi6Tag, setUpi6Tag] = useState('A-Pay · Fast');
    const [upi6LogoUrl, setUpi6LogoUrl] = useState('');
    const [upi9Name, setUpi9Name] = useState('UPI Gateway 9');
    const [upi9Tag, setUpi9Tag] = useState('UltraPay · Fast');
    const [upi9LogoUrl, setUpi9LogoUrl] = useState('');
    const [cashfreeName, setCashfreeName] = useState('Cashfree Gateway');
    const [cashfreeTag, setCashfreeTag] = useState('Secure · Fast');
    const [cashfreeLogoUrl, setCashfreeLogoUrl] = useState('');
    // Admin-controlled display order
    const [upiOrder, setUpiOrder] = useState<string[]>(['CASHFREE', 'UPI1', 'UPI2', 'UPI3', 'UPI4', 'UPI5', 'UPI6']);

    // Amount validation
    const [selectedMethodError, setSelectedMethodError] = useState<string>('');
    const [amountError, setAmountError] = useState<string>('');
    const [cryptoAmountError, setCryptoAmountError] = useState<string>('');

    // Available bonuses for visual picker (filtered by currency tab)
    const [availableBonuses, setAvailableBonuses] = useState<BonusPromotion[]>([]);
    const [selectedBonusId, setSelectedBonusId] = useState<string | null>(null);

    const [cryptoOptions, setCryptoOptions] = useState<CryptoOption[]>(defaultCryptoOptions);
    const [selectedCoinCode, setSelectedCoinCode] = useState<string | null>(null);
    const [selectedNetworkOption, setSelectedNetworkOption] = useState<NowPaymentsNetworkOption | null>(null);
    const [availableNowPaymentsCoins, setAvailableNowPaymentsCoins] = useState<NowPaymentsCurrenciesResponse['coins']>([]);
    const [cryptoOptionsLoading, setCryptoOptionsLoading] = useState(false);
    const [coinSearch, setCoinSearch] = useState('');
    const [networkSearch, setNetworkSearch] = useState('');
    const [isCoinDropdownOpen, setIsCoinDropdownOpen] = useState(false);
    const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);
    const [cryptoStep, setCryptoStep] = useState<CryptoStep>('configure');
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<string>('waiting');
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [copied, setCopied] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);


    // STRICT enforcement: whenever this modal opens, force the correct tab.
    // Non-India users MUST be on crypto; manual-only chooser mode also opens crypto-only.
    useEffect(() => {
        if (!isOpen) return;
        if (!isIndia) {
            setActiveTab('crypto');
        } else if (!depositAllowFiatTab || depositInitialTab === 'crypto') {
            setActiveTab('crypto');
        } else {
            setActiveTab('fiat');
        }
    }, [depositAllowFiatTab, depositInitialTab, isIndia, isOpen]);

    useEffect(() => {
        if (isOpen) {
            // Fetch min deposit from system config
            api.get('/settings/public')
                .then(res => {
                    const d = res.data || {};
                    setPublicSettings(d);
                    const min = parseFloat(d.MIN_DEPOSIT);
                    if (!isNaN(min) && min > 0) setMinDeposit(min);
                    const minU2 = parseFloat(d.MIN_DEPOSIT_UPI2);
                    if (!isNaN(minU2) && minU2 > 0) setMinDepositUPI2(minU2);
                    const minU0 = parseFloat(d.MIN_DEPOSIT_UPI0);
                    if (!isNaN(minU0) && minU0 > 0) setMinDepositUPI0(minU0);
                    const minU3 = parseFloat(d.MIN_DEPOSIT_UPI3);
                    if (!isNaN(minU3) && minU3 > 0) setMinDepositUPI3(minU3);
                    const minU4 = parseFloat(d.MIN_DEPOSIT_UPI4);
                    if (!isNaN(minU4) && minU4 > 0) setMinDepositUPI4(minU4);
                    const minU5 = parseFloat(d.MIN_DEPOSIT_UPI5);
                    if (!isNaN(minU5) && minU5 > 0) setMinDepositUPI5(minU5);
                    const minU6 = parseFloat(d.MIN_DEPOSIT_UPI6);
                    if (!isNaN(minU6) && minU6 > 0) setMinDepositUPI6(minU6);
                    const minU9 = parseFloat(d.MIN_DEPOSIT_UPI9);
                    if (!isNaN(minU9) && minU9 > 0) setMinDepositUPI9(minU9);
                    const minCF = parseFloat(d.MIN_DEPOSIT_CASHFREE);
                    if (!isNaN(minCF) && minCF > 0) setMinDepositCashfree(minCF);
                    const minCrypto = parseFloat(d.MIN_DEPOSIT_CRYPTO);
                    if (!isNaN(minCrypto) && minCrypto > 0) setMinDepositCrypto(minCrypto);

                    // Gateway enable/disable
                    const u1 = d.UPI1_ENABLED !== 'false';
                    const u2 = d.UPI2_ENABLED !== 'false';
                    const u3 = d.UPI3_ENABLED !== 'false';
                    const u4 = d.UPI4_ENABLED !== 'false';
                    const u5 = d.UPI5_ENABLED !== 'false';
                    const u6 = d.UPI6_ENABLED !== 'false';
                    const u9 = d.UPI9_ENABLED !== 'false';
                    setUpi1Enabled(u1);
                    setUpi2Enabled(u2);
                    setUpi3Enabled(u3);
                    setUpi4Enabled(u4);
                    setUpi5Enabled(u5);
                    setUpi6Enabled(u6);
                    setUpi9Enabled(u9);
                    // Gateway display names & taglines
                    if (d.UPI1_NAME) setUpi1Name(d.UPI1_NAME);
                    if (d.UPI1_TAGLINE) setUpi1Tag(d.UPI1_TAGLINE);
                    setUpi1LogoUrl((d.UPI1_LOGO_URL || '').trim());
                    if (d.UPI2_NAME) setUpi2Name(d.UPI2_NAME);
                    if (d.UPI2_TAGLINE) setUpi2Tag(d.UPI2_TAGLINE);
                    setUpi2LogoUrl((d.UPI2_LOGO_URL || '').trim());
                    if (d.UPI3_NAME) setUpi3Name(d.UPI3_NAME);
                    if (d.UPI3_TAGLINE) setUpi3Tag(d.UPI3_TAGLINE);
                    setUpi3LogoUrl((d.UPI3_LOGO_URL || '').trim());
                    if (d.UPI4_NAME) setUpi4Name(d.UPI4_NAME);
                    if (d.UPI4_TAGLINE) setUpi4Tag(d.UPI4_TAGLINE);
                    setUpi4LogoUrl((d.UPI4_LOGO_URL || '').trim());
                    if (d.UPI5_NAME) setUpi5Name(d.UPI5_NAME);
                    if (d.UPI5_TAGLINE) setUpi5Tag(d.UPI5_TAGLINE);
                    setUpi5LogoUrl((d.UPI5_LOGO_URL || '').trim());
                    if (d.UPI6_NAME) setUpi6Name(d.UPI6_NAME);
                    if (d.UPI6_TAGLINE) setUpi6Tag(d.UPI6_TAGLINE);
                    setUpi6LogoUrl((d.UPI6_LOGO_URL || '').trim());
                    if (d.UPI9_NAME) setUpi9Name(d.UPI9_NAME);
                    if (d.UPI9_TAGLINE) setUpi9Tag(d.UPI9_TAGLINE);
                    setUpi9LogoUrl((d.UPI9_LOGO_URL || '').trim());

                    const cf = d.CASHFREE_ENABLED !== 'false';
                    setCashfreeEnabled(cf);
                    if (d.CASHFREE_NAME) setCashfreeName(d.CASHFREE_NAME);
                    if (d.CASHFREE_TAGLINE) setCashfreeTag(d.CASHFREE_TAGLINE);
                    setCashfreeLogoUrl((d.CASHFREE_LOGO_URL || '').trim());

                    // Display order (UPI1/UPI2/UPI3/UPI4/UPI5/UPI6/CASHFREE)
                    if (d.UPI_GATEWAY_ORDER) {
                        const validIds = ['UPI1', 'UPI2', 'UPI3', 'UPI4', 'UPI5', 'UPI6', 'UPI9', 'CASHFREE'];
                        const ord = (d.UPI_GATEWAY_ORDER as string).split(',').map((s: string) => s.trim()).filter((s) => validIds.includes(s));
                        if (ord.length) setUpiOrder(ord);
                    }
                    setCryptoOptions(parseCryptoOptionsConfig(d.DEPOSIT_CRYPTO_OPTIONS));
                    // Manual payment gateway toggle (not used here — handled in ManualDepositScreen)
                })
                .catch(() => { });

            // Auto-fill bonus code from MongoDB (pending deposit bonus set during registration)
            api.get('/bonus/pending')
                .then(res => {
                    if (res.data?.bonusCode) {
                        handlePromoCodeChange(res.data.bonusCode, { immediate: true });
                    }
                })
                .catch(() => { }); // silent if not logged in / no pending bonus

            // Fetch available bonuses for visual picker
            api.get('/bonus/promotions')
                .then(res => { setAvailableBonuses(Array.isArray(res.data) ? res.data : []); })
                .catch(() => { });

        } else {
            // Clear amount error when modal closes
            setSelectedMethodError('');
            setAmountError('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        let isCancelled = false;

        const loadNowPaymentsOptions = async () => {
            if (!isOpen) return;

            setCryptoOptionsLoading(true);

            try {
                const res = await api.get<NowPaymentsCurrenciesResponse>('/nowpayments/currencies');
                const configuredById = new Map(
                    cryptoOptions.map((coin) => [coin.id.toLowerCase(), coin] as const),
                );
                const apiCoins = Array.isArray(res.data?.coins) ? res.data.coins : [];
                const nextCoins = apiCoins
                    .map((coin) => ({
                        ...coin,
                        code: coin.code?.toUpperCase?.() || coin.label.toUpperCase(),
                        logoUrl: coin.logoUrl || coin.networks.find((network) => network.logoUrl)?.logoUrl || null,
                        networks: coin.networks.map((network) => {
                            const configured = configuredById.get(network.id.toLowerCase());
                            const fallback = buildFallbackCryptoOption(network.id);

                            return {
                                ...network,
                                id: network.id.toLowerCase(),
                                code: network.code || network.id.toUpperCase(),
                                label: coin.label,
                                network: network.network || configured?.network || fallback.network,
                                logoUrl: network.logoUrl || null,
                                icon: configured?.icon || fallback.icon,
                                color: configured?.color || fallback.color,
                            };
                        }),
                    }))
                    .filter((coin) => coin.networks.length > 0)
                    .sort((a, b) => a.label.localeCompare(b.label));

                if (!isCancelled) {
                    setAvailableNowPaymentsCoins(nextCoins);
                }
            } catch {
                if (!isCancelled) {
                    const fallbackCoins = [...cryptoOptions]
                        .sort((a, b) => a.label.localeCompare(b.label))
                        .reduce<NowPaymentsCurrenciesResponse['coins']>((acc, option) => {
                            const existing = acc.find((coin) => coin.label === option.label);
                            const nextNetwork: NowPaymentsNetworkOption = {
                                id: option.id,
                                code: option.id.toUpperCase(),
                                label: option.label,
                                network: option.network,
                                logoUrl: null,
                                enabled: true,
                                isAvailableForPayment: true,
                                icon: option.icon,
                                color: option.color,
                            };

                            if (existing) {
                                existing.networks.push(nextNetwork);
                            } else {
                                acc.push({
                                    code: option.label.toUpperCase(),
                                    label: option.label,
                                    logoUrl: null,
                                    networks: [nextNetwork],
                                });
                            }

                            return acc;
                        }, []);
                    setAvailableNowPaymentsCoins(fallbackCoins);
                }
            } finally {
                if (!isCancelled) {
                    setCryptoOptionsLoading(false);
                }
            }
        };

        void loadNowPaymentsOptions();

        return () => {
            isCancelled = true;
        };
    }, [cryptoOptions, isOpen]);

    useEffect(() => {
        const selectedCoin = selectedCoinCode
            ? availableNowPaymentsCoins.find((coin) => coin.code === selectedCoinCode) ?? null
            : null;
        const networkOptions = selectedCoin?.networks ?? [];

        if (selectedNetworkOption && !networkOptions.find((coin) => coin.id === selectedNetworkOption.id)) {
            setSelectedNetworkOption(null);
        }
        if (selectedCoinCode && !availableNowPaymentsCoins.find((coin) => coin.code === selectedCoinCode)) {
            setSelectedCoinCode(null);
        }
    }, [availableNowPaymentsCoins, selectedCoinCode, selectedNetworkOption]);

    useEffect(() => {
        if (!isOpen || cryptoStep !== 'configure') {
            setIsCoinDropdownOpen(false);
            setIsNetworkDropdownOpen(false);
        }
    }, [cryptoStep, isOpen]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'ZEERO_PAY_SUCCESS') {
                onClose();
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onClose]);

    useEffect(() => {
        const enabledMethods = (currentCountry.paymentMethods || []).filter((method) => {
            if (method.id === 'UPI1' && !upi1Enabled) return false;
            if (method.id === 'UPI2' && !upi2Enabled) return false;
            if (method.id === 'UPI3' && !upi3Enabled) return false;
            if (method.id === 'UPI4' && !upi4Enabled) return false;
            if (method.id === 'UPI5' && !upi5Enabled) return false;
            if (method.id === 'UPI6' && !upi6Enabled) return false;
            if (method.id === 'UPI9' && !upi9Enabled) return false;
            if (method.id === 'CASHFREE' && !cashfreeEnabled) return false;
            if (method.id === 'UPI0') return false;
            return method.id === 'UPI1' || method.id === 'UPI2' || method.id === 'UPI3' || method.id === 'UPI4' || method.id === 'UPI5' || method.id === 'UPI6' || method.id === 'UPI9' || method.id === 'CASHFREE';
        });

        const exists = enabledMethods.find((method) => method.id === selectedMethod);
        if (!exists) {
            setSelectedMethodError('');
            setSelectedMethod('');
        }
    }, [currentCountry.paymentMethods, selectedMethod, upi1Enabled, upi2Enabled, upi3Enabled, upi4Enabled, upi5Enabled, upi6Enabled, upi9Enabled, cashfreeEnabled]);

    useEffect(() => {
        if (!isOpen) {
            stopPolling();
            stopTimer();
            resetCryptoState();
            setIframeUrl(null);
        }
    }, [isOpen]);

    const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
    const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

    const resetCryptoState = () => {
        setCryptoStep('configure'); setPaymentData(null);
        setPaymentStatus('waiting'); setTimeLeft(0); setCopied(false); setSelectedCoinCode(null); setSelectedNetworkOption(null); setCoinSearch(''); setNetworkSearch(''); setIsCoinDropdownOpen(false); setIsNetworkDropdownOpen(false);
    };

    const startTimer = (expiresAt: string | null) => {
        if (!expiresAt) return;
        const expiry = new Date(expiresAt).getTime();
        timerRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) stopTimer();
        }, 1000);
    };

    const startPolling = useCallback((paymentId: string) => {
        pollingRef.current = setInterval(async () => {
            try {
                setStatusLoading(true);
                const res = await api.get(`/nowpayments/status/${paymentId}`);
                const status = res.data?.data?.status;
                setPaymentStatus(status);
                if (status === 'finished' || status === 'confirmed') {
                    stopPolling(); stopTimer(); setCryptoStep('success');
                    toast.success('🎉 Crypto payment confirmed! Balance credited.');
                } else if (status === 'expired' || status === 'failed') {
                    stopPolling(); stopTimer();
                    toast.error(`Payment ${status}. Please try again.`);
                    resetCryptoState();
                }
            } catch { } finally { setStatusLoading(false); }
        }, 12000);
    }, []);

    const isFiatFlow = isIndia && activeTab === 'fiat';
    const depositCurrency: DepositCurrency = isFiatFlow ? 'INR' : 'CRYPTO';

    const handleManualFallback = useCallback((manualMessage?: string, allowBack = false) => {
        if (typeof window !== 'undefined') {
            if (promoCode.trim()) {
                window.sessionStorage.setItem(manualDepositBonusCodeKey, promoCode.trim().toUpperCase());
            } else {
                window.sessionStorage.removeItem(manualDepositBonusCodeKey);
            }
        }
        if (manualMessage) toast(manualMessage);
        onClose();
        openManualDeposit({ allowBack });
    }, [onClose, openManualDeposit, promoCode]);

    const fetchGatewayRetryState = useCallback(async () => {
        if (!isOpen || !isFiatFlow || !user) {
            setGatewayRetryState(null);
            setGatewayRetryStateLoading(false);
            return;
        }

        setGatewayRetryStateLoading(true);
        try {
            const res = await api.get('/manual-deposit/retry-state');
            setGatewayRetryState(res.data);
        } catch {
            setGatewayRetryState(null);
        } finally {
            setGatewayRetryStateLoading(false);
        }
    }, [isOpen, isFiatFlow, user?.id]);

    useEffect(() => {
        void fetchGatewayRetryState();
    }, [fetchGatewayRetryState]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true); toast.success('Copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    const findBonusByCode = (code: string) => availableBonuses.find((bonus) => bonus.code.toUpperCase() === code.toUpperCase());

    const validatePromoCodePreview = async (code: string) => {
        const requestId = ++promoRequestRef.current;
        setPromoValidating(true);
        try {
            const res = await api.post('/bonus/validate', {
                code: code.toUpperCase(),
                depositAmount: parseFloat(amount) || 0,
                depositCurrency,
            });
            if (requestId !== promoRequestRef.current) return;
            setPromoResult(res.data);
            setPromoError('');
        } catch (err: unknown) {
            if (requestId !== promoRequestRef.current) return;
            setPromoResult(null);
            
            const errMsg = getApiErrorMessage(err, 'Invalid promo code');
            if (errMsg === 'This bonus is only available on your first deposit') {
                setPromoCode('');
                setPromoError('');
                toast.error('Promo removed: ' + errMsg);
                return;
            }

            setPromoError(errMsg);
        } finally {
            if (requestId === promoRequestRef.current) setPromoValidating(false);
        }
    };

    const queuePromoValidation = (code: string, immediate = false) => {
        if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
        if (!code.trim()) return;
        setPromoValidating(true);
        if (immediate) {
            void validatePromoCodePreview(code);
            return;
        }
        promoTimerRef.current = setTimeout(() => {
            void validatePromoCodePreview(code);
        }, 250);
    };

    const handlePromoCodeChange = (code: string, options: { immediate?: boolean; selectedBonusId?: string | null } = {}) => {
        const normalizedCode = code.toUpperCase();
        setPromoCode(normalizedCode);
        setPromoResult(null);
        setPromoError('');
        if (options.selectedBonusId !== undefined) {
            setSelectedBonusId(options.selectedBonusId);
        } else {
            const matchedBonus = findBonusByCode(normalizedCode);
            setSelectedBonusId(matchedBonus?._id ?? null);
        }
        if (!normalizedCode.trim()) {
            if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
            promoRequestRef.current += 1;
            setPromoValidating(false);
            return;
        }
        queuePromoValidation(normalizedCode, options.immediate);
    };

    useEffect(() => {
        if (!promoCode.trim()) return;
        queuePromoValidation(promoCode);
        return () => {
            if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
        };
    }, [amount, activeTab]);

    useEffect(() => {
        if (!promoCode.trim() || selectedBonusId) return;
        const matchedBonus = findBonusByCode(promoCode);
        if (matchedBonus) setSelectedBonusId(matchedBonus._id);
    }, [availableBonuses, promoCode, selectedBonusId]);

    const selectedBonus = (selectedBonusId
        ? availableBonuses.find((bonus) => bonus._id === selectedBonusId)
        : findBonusByCode(promoCode)) ?? null;
    const parsedAmount = parseFloat(amount) || 0;
    const selectedBonusMinDeposit = depositCurrency === 'CRYPTO'
        ? (selectedBonus?.minDepositCrypto ?? selectedBonus?.minDeposit ?? 0)
        : (selectedBonus?.minDepositFiat ?? selectedBonus?.minDeposit ?? 0);
    const bonusMinDeposit = promoResult?.eligibility?.minDeposit ?? selectedBonusMinDeposit;
    const bonusMinDepositShortfall = promoResult?.eligibility?.minDepositShortfall ?? Math.max(0, bonusMinDeposit - parsedAmount);
    const bonusMinDepositMet = promoResult?.eligibility?.minDepositMet ?? parsedAmount >= bonusMinDeposit;
    const bonusRequiresFirstDeposit = promoResult?.eligibility?.requiresFirstDeposit ?? !!selectedBonus?.forFirstDepositOnly;
    const selectedBonusSymbol = depositCurrency === 'CRYPTO' ? '$' : fiatSymbol;
    const hasPromoSelection = !!promoCode.trim();
    const hasBonusQualificationIssue = hasPromoSelection && parsedAmount > 0 && bonusMinDeposit > 0 && !bonusMinDepositMet;
    const bonusQualificationMessage = hasBonusQualificationIssue
        ? `Increase your deposit by ${selectedBonusSymbol}${formatAmount(bonusMinDepositShortfall)} to unlock this bonus.`
        : '';
    const promoBlockingError = promoError || bonusQualificationMessage;

    const ensurePromoSelectionIsValid = () => {
        if (!hasPromoSelection) return true;
        if (promoValidating) {
            toast.error('Checking bonus eligibility. Please wait a moment.');
            return false;
        }
        if (promoError) {
            toast.error(promoError);
            return false;
        }
        if (hasBonusQualificationIssue) {
            toast.error(bonusQualificationMessage);
            return false;
        }
        if (!promoResult) {
            toast.error('Please wait for bonus validation to finish.');
            return false;
        }
        return true;
    };

    const handleGenerateCryptoAddress = async () => {
        const enteredAmount = parseFloat(amount);
        if (!selectedCoin) {
            const errorMessage = 'Please choose a coin first.';
            setCryptoAmountError(errorMessage);
            toast.error(errorMessage);
            return;
        }
        if (!selectedNetworkOption) {
            const errorMessage = 'Please choose a network first.';
            setCryptoAmountError(errorMessage);
            toast.error(errorMessage);
            return;
        }
        if (!amount || enteredAmount <= 0) {
            const errorMessage = 'Please enter a valid amount (USD).';
            setCryptoAmountError(errorMessage);
            toast.error(errorMessage);
            return;
        }
        if (enteredAmount < minDepositCrypto) {
            const errorMessage = `Minimum crypto deposit is $${minDepositCrypto}`;
            setCryptoAmountError(errorMessage);
            toast.error(errorMessage);
            return;
        }
        if (!ensurePromoSelectionIsValid()) return;
        setLoading(true); setMessage(null);
        try {
            const res = await api.post('/nowpayments/create', {
                amount: parseFloat(amount),
                payCurrency: selectedNetworkOption.id,
                priceCurrency: 'usd',
                bonusCode: promoCode || undefined,
            });
            const data: PaymentData = res.data.data;
            api.delete('/bonus/pending').catch(() => { });
            setPaymentData(data); setPaymentStatus('waiting');
            setCryptoStep('awaiting'); startTimer(data.expiresAt); startPolling(data.paymentId);
        } catch (error: unknown) {
            const msg = getApiErrorMessage(error, 'Failed to generate payment address');
            toast.error(msg); setMessage({ type: 'error', text: msg });
        } finally { setLoading(false); }
    };

    const handleFiatSubmit = async () => {
        setMessage(null);
        if (gatewayRetryState?.forceManual) {
            handleManualFallback(gatewayRetryState.message, false);
            return;
        }
        if (!selectedMethod) {
            const gatewayError = 'Please select a payment gateway.';
            setSelectedMethodError(gatewayError);
            toast.error(gatewayError);
            return;
        }

        setSelectedMethodError('');
        const numAmt = parseFloat(amount);
        const isUPI2 = selectedMethod === 'UPI2';
        const isUPI0 = selectedMethod === 'UPI0';
        const isUPI3 = selectedMethod === 'UPI3';
        const isUPI4 = selectedMethod === 'UPI4';
        const isUPI5 = selectedMethod === 'UPI5';
        const isUPI6 = selectedMethod === 'UPI6';
        const isUPI9 = selectedMethod === 'UPI9';
        const isCashfree = selectedMethod === 'CASHFREE';
        const minAmt = activeGatewayMinDeposit ?? (isCashfree ? minDepositCashfree : isUPI9 ? minDepositUPI9 : isUPI6 ? minDepositUPI6 : isUPI5 ? minDepositUPI5 : isUPI4 ? minDepositUPI4 : isUPI3 ? minDepositUPI3 : isUPI0 ? minDepositUPI0 : isUPI2 ? minDepositUPI2 : minDeposit);

        if (!amount || numAmt <= 0) {
            setAmountError('Please enter a valid amount.');
            toast.error('Please enter a valid amount.');
            return;
        }
        if (numAmt < minAmt) {
            setAmountError(`Minimum deposit for ${activeGatewayLabel || (isCashfree ? cashfreeName : isUPI9 ? upi9Name : isUPI6 ? upi6Name : isUPI5 ? upi5Name : isUPI4 ? upi4Name : isUPI3 ? upi3Name : isUPI0 ? 'UPI Gateway 0' : isUPI2 ? upi2Name : upi1Name)} is ${fiatSymbol}${minAmt}.`);
            toast.error(`Minimum deposit is ${fiatSymbol}${minAmt}.`);
            return;
        }
        if (!ensurePromoSelectionIsValid()) return;
        setAmountError('');
        setLoading(true);
        try {
            const now = new Date();

            if (selectedMethod === 'CASHFREE') {
                // ── Cashfree Gateway ──────────────────────────────────────
                const orderNo = `CF${now.getTime()}${Math.floor(Math.random() * 100)}`;
                const response = await api.post('/payment1/create', {
                    orderNo,
                    amount: Math.round(parseFloat(amount)).toString(),
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                    returnUrl: window.location.origin + '/profile/transactions'
                });
                const { success, payUrl, message: errMsg } = response.data;
                if (success && payUrl) {
                    api.delete('/bonus/pending').catch(() => { });
                    // Cashfree strictly enforces X-Frame-Options: DENY on its checkout
                    // We must orchestrate a full top-level redirect instead of loading in our modal's iframe.
                    window.location.href = payUrl;
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied!`);
                } else if (success) {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(errMsg || 'Cashfree gateway rejected the request');
                }
            } else if (isUPI9) {
                // ── UPI 9 / UltraPay Gateway ──────────────────────────────────────
                const orderNo = `DEP9${now.getTime()}${Math.floor(Math.random() * 100)}`;
                const response = await api.post('/payment9/create', {
                    orderNo,
                    amount: Math.round(parseFloat(amount)).toString(),
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                    payerName: user?.username || undefined,
                });
                const { success, payUrl, message: errMsg } = response.data;
                if (success && payUrl) {
                    api.delete('/bonus/pending').catch(() => { });
                    setIframeUrl(payUrl);
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied on payment confirmation!`);
                } else if (success) {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(errMsg || 'UltraPay (UPI 9) gateway rejected the request');
                }
            } else if (isUPI6) {
                // ── Gateway 6 / A-Pay Gateway ──────────────────────────────────────
                const orderNo = `DEP6${now.getTime()}${Math.floor(Math.random() * 100)}`;
                const response = await api.post('/payment6/create', {
                    orderNo,
                    amount: Math.round(parseFloat(amount)).toString(),
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                });
                const { success, payUrl, message: errMsg } = response.data;
                if (success && payUrl) {
                    api.delete('/bonus/pending').catch(() => { });
                    setIframeUrl(payUrl);
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied on payment confirmation!`);
                } else if (success) {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(errMsg || 'Gateway 6 (A-Pay) rejected the request');
                }
            } else if (isUPI5) {
                // ── UPI 5 / RezorPay Gateway ──────────────────────────────────────
                const orderNo = `DEP5${now.getTime()}${Math.floor(Math.random() * 100)}`;
                const response = await api.post('/payment5/create', {
                    orderNo,
                    amount: Math.round(parseFloat(amount)).toString(),
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                    payerName: user?.username || undefined,
                });
                const { success, payUrl, message: errMsg } = response.data;
                if (success && payUrl) {
                    api.delete('/bonus/pending').catch(() => { });
                    setIframeUrl(payUrl);
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied on payment confirmation!`);
                } else if (success) {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(errMsg || 'UPI 5 gateway rejected the request');
                }
            } else if (isUPI4) {
                // ── UPI 4 / Silkpay Gateway ──────────────────────────────────────
                const orderNo = `DEP4${now.getTime()}${Math.floor(Math.random() * 100)}`;
                const response = await api.post('/payment4/create', {
                    orderNo,
                    amount: Math.round(parseFloat(amount)).toString(),
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                    payerName: user?.username || undefined,
                });
                const { success, payUrl, message: errMsg } = response.data;
                if (success && payUrl) {
                    api.delete('/bonus/pending').catch(() => { });
                    setIframeUrl(payUrl);
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied on payment confirmation!`);
                } else if (success) {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(errMsg || 'UPI 4 gateway rejected the request');
                }
            } else if (isUPI3) {
                // ── UPI 3 / iPayment Gateway (AES+MD5 security) ─────────────
                const orderNo = `DEP3${now.getTime()}${Math.floor(Math.random() * 100)}`;
                // Gateway requires extra.email — pass real email if available,
                // otherwise generate a deterministic placeholder (never empty)
                const payEmail =
                    (typeof user === 'object' && user && 'email' in user && typeof user.email === 'string' && user.email) ||
                    `user${user?.id || 0}@${(user?.username || 'player').toLowerCase().replace(/[^a-z0-9]/g, '')}.bet`;
                const response = await api.post('/payment3/create', {
                    orderNo,
                    amount: Math.round(parseFloat(amount)).toString(),
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                    payerName: user?.username || undefined,
                    payEmail,
                });
                const { success, payUrl, message: errMsg } = response.data;
                if (success && payUrl) {
                    api.delete('/bonus/pending').catch(() => { });
                    setIframeUrl(payUrl);
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied on payment confirmation!`);
                } else if (success) {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(errMsg || 'UPI 3 gateway rejected the request');
                }
            } else if (isUPI0) {
                const orderNo = `DEP0${now.getTime()}${Math.floor(Math.random() * 100)}`;
                const response = await api.post('/payment0/create', {
                    orderNo,
                    amount: parseFloat(amount).toFixed(2),
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                    returnUrl: window.location.origin + '/profile/transactions'
                });
                const { success, payUrl, message: errMsg } = response.data;
                if (success && payUrl) {
                    api.delete('/bonus/pending').catch(() => { });
                    setIframeUrl(payUrl);
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied on payment confirmation!`);
                } else if (success) {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(errMsg || 'UPI 0 gateway rejected the request');
                }
            } else if (isUPI2) {
                // ── UPI 2 Gateway (new API format) ──────────────────────────
                const orderNo = `DEP2${now.getTime()}${Math.floor(Math.random() * 100)}`;
                const response = await api.post('/payment2/create', {
                    orderNo,
                    amount: parseFloat(amount).toFixed(2),
                    currency: 'INR',
                    payType: 'UPI',
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                });
                const { success, payUrl, message: errMsg } = response.data;
                if (success && payUrl) {
                    // Clear MongoDB pending bonus — it's been submitted with this deposit
                    api.delete('/bonus/pending').catch(() => { });
                    setIframeUrl(payUrl);
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied on payment confirmation!`);
                } else if (success) {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(errMsg || 'UPI 2 gateway rejected the request');
                }
            } else {
                // ── UPI 1 / NekPay Gateway (existing format) ────────────────
                const mch_order_no = `DEP${now.getTime()}${Math.floor(Math.random() * 100)}`;
                const order_date =
                    now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0') + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0') + ':' +
                    String(now.getSeconds()).padStart(2, '0');

                let pay_type = '105'; // UPI 1
                if (selectedMethod === 'NETBANKING') pay_type = '153';

                const orderData = {
                    page_url: window.location.origin + '/profile/transactions',
                    mch_order_no, pay_type,
                    trade_amount: parseFloat(amount).toString(),
                    order_date, goods_name: 'Wallet Deposit',
                    userId: user?.id,
                    bonusCode: promoCode || undefined,
                };

                const response = await api.post('/payment/create', orderData);
                const nekpayData = response.data?.data ?? response.data;
                const payInfo = nekpayData?.payInfo || nekpayData?.pay_info || nekpayData?.payUrl || nekpayData?.pay_url;

                if (payInfo) {
                    // Clear MongoDB pending bonus — it's been submitted with this deposit
                    api.delete('/bonus/pending').catch(() => { });
                    setIframeUrl(payInfo);
                    void fetchGatewayRetryState();
                    if (promoCode) toast.success(`🎁 Bonus code ${promoCode} will be applied on payment confirmation!`);
                } else if (nekpayData?.respCode === 'SUCCESS' || nekpayData?.tradeResult === '1') {
                    toast.success('Payment initiated!'); onClose();
                } else {
                    throw new Error(nekpayData?.tradeMsg || response.data?.message || 'Payment gateway rejected the request');
                }
            }
        } catch (error: unknown) {
            const gatewayError = error as {
                response?: {
                    data?: {
                        manualRequired?: boolean;
                        message?: string;
                        retryState?: GatewayRetryState;
                    };
                };
            };

            if (gatewayError.response?.data?.manualRequired) {
                if (gatewayError.response.data.retryState) setGatewayRetryState(gatewayError.response.data.retryState);
                handleManualFallback(gatewayError.response.data.message || gatewayError.response.data.retryState?.message, false);
                return;
            }

            const msg = getApiErrorMessage(error, 'Deposit failed. Please try again.');
            setMessage({ type: 'error', text: msg }); toast.error(msg);
        } finally { setLoading(false); }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const statusMap: Record<string, { label: string; color: string }> = {
        waiting: { label: 'Waiting for payment…', color: 'text-brand-gold' },
        confirming: { label: 'Confirming…', color: 'text-brand-gold' },
        confirmed: { label: 'Confirmed!', color: 'text-green-400' },
        sending: { label: 'Sending funds…', color: 'text-brand-gold' },
        finished: { label: 'Complete!', color: 'text-green-400' },
        partially_paid: { label: 'Partial — contact support', color: 'text-brand-gold' },
        failed: { label: 'Failed', color: 'text-danger' },
        expired: { label: 'Expired', color: 'text-danger' },
    };

    const fiatSubmitHint = gatewayRetryState?.forceManual
        ? gatewayRetryState.message || 'Please continue with Manual UPI.'
        : !selectedMethod
            ? gatewayRetryStateLoading
                ? 'Checking pending payment status...'
                : 'Choose a gateway to continue.'
        : !amount
            ? 'Enter your deposit amount.'
            : amountError
                ? amountError
                : promoValidating
                    ? 'Checking bonus eligibility...'
                    : promoBlockingError || 'Ready to continue to the secure payment page.';

    const cryptoSubmitHint = !amount
        ? 'Enter your deposit amount in USD.'
        : cryptoAmountError
            ? cryptoAmountError
            : promoValidating
                ? 'Checking bonus eligibility...'
                : promoBlockingError || 'A unique wallet address will be generated for this payment.';

    const isFiatSubmitDisabled = loading;
    const isCryptoSubmitDisabled = loading;
    const isForcedManualFlow = isFiatFlow && !!gatewayRetryState?.forceManual;

    const gatewayOptions = (() => {
        const allGateways = (currentCountry.paymentMethods || [])
            .map((method) => {
                if (method.id === 'UPI0') return null;
                if (method.id === 'UPI1' && !upi1Enabled) return null;
                if (method.id === 'UPI2' && !upi2Enabled) return null;
                if (method.id === 'UPI3' && !upi3Enabled) return null;
                if (method.id === 'UPI4' && !upi4Enabled) return null;
                if (method.id === 'UPI5' && !upi5Enabled) return null;
                if (method.id === 'UPI6' && !upi6Enabled) return null;
                if (method.id === 'UPI9' && !upi9Enabled) return null;
                if (method.id === 'CASHFREE' && !cashfreeEnabled) return null;
                if (method.id !== 'UPI1' && method.id !== 'UPI2' && method.id !== 'UPI3' && method.id !== 'UPI4' && method.id !== 'UPI5' && method.id !== 'UPI6' && method.id !== 'UPI9' && method.id !== 'CASHFREE') return null;

                const isGatewayOne = method.id === 'UPI1';
                const isGatewayThree = method.id === 'UPI3';
                const isGatewayFour = method.id === 'UPI4';
                const isGatewayFive = method.id === 'UPI5';
                const isGatewaySix = method.id === 'UPI6';
                const isGatewayNine = method.id === 'UPI9';
                const isCashfree = method.id === 'CASHFREE';

                return {
                    id: method.id,
                    label: isGatewayOne ? upi1Name : isGatewayThree ? upi3Name : isGatewayFour ? upi4Name : isGatewayFive ? upi5Name : isGatewaySix ? upi6Name : isGatewayNine ? upi9Name : isCashfree ? cashfreeName : upi2Name,
                    sub: method.subLabel || (isGatewayOne ? upi1Tag : isGatewayThree ? upi3Tag : isGatewayFour ? upi4Tag : isGatewayFive ? upi5Tag : isGatewaySix ? upi6Tag : isGatewayNine ? upi9Tag : isCashfree ? cashfreeTag : upi2Tag),
                    logoUrl: isGatewayOne ? upi1LogoUrl : isGatewayThree ? upi3LogoUrl : isGatewayFour ? upi4LogoUrl : isGatewayFive ? upi5LogoUrl : isGatewaySix ? upi6LogoUrl : isGatewayNine ? upi9LogoUrl : isCashfree ? cashfreeLogoUrl : upi2LogoUrl,
                    icon: method.icon && method.icon !== 'UPI'
                        ? method.icon
                        : isGatewayOne
                            ? '🏦'
                            : isGatewayThree
                                ? '⚡'
                                : isGatewayFour
                                    ? '🚀'
                                    : isGatewayFive
                                        ? '🛡️'
                                        : isGatewaySix
                                            ? '🔗'
                                            : isGatewayNine
                                                ? '⚡'
                                                : isCashfree
                                                    ? '💳'
                                                    : '📲',
                    minDeposit: isGatewayOne ? minDeposit : isGatewayThree ? minDepositUPI3 : isGatewayFour ? minDepositUPI4 : isGatewayFive ? minDepositUPI5 : isGatewaySix ? minDepositUPI6 : isGatewayNine ? minDepositUPI9 : isCashfree ? minDepositCashfree : minDepositUPI2,
                    badge: method.badge,
                };
            })
            .filter(Boolean) as GatewayOption[];

        const sorted = [...upiOrder]
            .map((gatewayId) => allGateways.find((gateway) => gateway.id === gatewayId))
            .filter(Boolean) as typeof allGateways;

        allGateways.forEach((gateway) => {
            if (!sorted.find((sortedGateway) => sortedGateway.id === gateway.id)) sorted.push(gateway);
        });

        return sorted;
    })();
    useEffect(() => {
        if (!isFiatFlow || gatewayRetryState?.forceManual || selectedMethod) return;
        if (!gatewayRetryState?.suggestedGatewayId) return;

        const suggestedGatewayExists = gatewayOptions.some((gateway) => gateway.id === gatewayRetryState.suggestedGatewayId);
        if (suggestedGatewayExists) {
            setSelectedMethod(gatewayRetryState.suggestedGatewayId);
        }
    }, [gatewayOptions, gatewayRetryState, isFiatFlow, selectedMethod]);
    const selectedGateway = gatewayOptions.find((gateway) => gateway.id === selectedMethod) ?? null;
    const activeGatewayLabel = selectedGateway?.label || null;
    const activeGatewayMinDeposit = selectedGateway?.minDeposit ?? null;
    const modalTitle = publicSettings.DEPOSIT_MODAL_TITLE || 'Deposit';
    const cryptoTabLabel = publicSettings.DEPOSIT_TAB_CRYPTO_LABEL || 'Crypto';
    const fiatTabLabel = publicSettings.DEPOSIT_TAB_FIAT_LABEL || 'Fiat';
    const canShowFiatTab = isIndia && depositAllowFiatTab;
    const currentQuickAmounts = isFiatFlow
        ? buildQuickAmounts(
            selectedMethod === 'CASHFREE' ? minDepositCashfree : selectedMethod === 'UPI2' ? minDepositUPI2 : selectedMethod === 'UPI3' ? minDepositUPI3 : selectedMethod === 'UPI4' ? minDepositUPI4 : selectedMethod === 'UPI5' ? minDepositUPI5 : selectedMethod === 'UPI6' ? minDepositUPI6 : selectedMethod === 'UPI9' ? minDepositUPI9 : minDeposit,
            selectedMethod === 'CASHFREE'
                ? publicSettings.DEPOSIT_QUICK_AMOUNTS_CASHFREE || publicSettings.DEPOSIT_QUICK_AMOUNTS_FIAT
                : selectedMethod === 'UPI2'
                ? publicSettings.DEPOSIT_QUICK_AMOUNTS_UPI2 || publicSettings.DEPOSIT_QUICK_AMOUNTS_FIAT
                : selectedMethod === 'UPI3'
                    ? publicSettings.DEPOSIT_QUICK_AMOUNTS_UPI3 || publicSettings.DEPOSIT_QUICK_AMOUNTS_FIAT
                    : selectedMethod === 'UPI4'
                        ? publicSettings.DEPOSIT_QUICK_AMOUNTS_UPI4 || publicSettings.DEPOSIT_QUICK_AMOUNTS_FIAT
                        : selectedMethod === 'UPI5'
                            ? publicSettings.DEPOSIT_QUICK_AMOUNTS_UPI5 || publicSettings.DEPOSIT_QUICK_AMOUNTS_FIAT
                            : selectedMethod === 'UPI6'
                                ? publicSettings.DEPOSIT_QUICK_AMOUNTS_UPI6 || publicSettings.DEPOSIT_QUICK_AMOUNTS_FIAT
                                : publicSettings.DEPOSIT_QUICK_AMOUNTS_UPI1 || publicSettings.DEPOSIT_QUICK_AMOUNTS_FIAT,
            selectedMethod === 'UPI2' ? quickAmountsUPI2 : quickAmountsFiat,
        )
        : buildQuickAmounts(
            minDepositCrypto,
            publicSettings.DEPOSIT_QUICK_AMOUNTS_CRYPTO,
            quickAmountsCrypto,
        );

    const currentAmountError = isFiatFlow ? amountError : cryptoAmountError;
    const currentSubmitDisabled = isFiatFlow
        ? isForcedManualFlow ? false : isFiatSubmitDisabled
        : isCryptoSubmitDisabled;
    const currentSubmitHint = isFiatFlow ? fiatSubmitHint : cryptoSubmitHint;
    const currentMinimumLabel = isFiatFlow
        ? activeGatewayMinDeposit
            ? `${fiatSymbol}${formatAmount(activeGatewayMinDeposit)}`
            : 'Select gateway'
        : `$${formatAmount(minDepositCrypto)}`;
    const selectedCoin = selectedCoinCode
        ? availableNowPaymentsCoins.find((coin) => coin.code === selectedCoinCode) ?? null
        : null;
    const normalizedCoinSearch = coinSearch.trim().toLowerCase();
    const normalizedNetworkSearch = networkSearch.trim().toLowerCase();
    const displayedCoinOptions = availableNowPaymentsCoins
        .filter((coin) => {
            if (!normalizedCoinSearch) return true;
            const searchableNetworks = coin.networks.map((network) => network.network).join(' ');
            return `${coin.label} ${coin.code} ${searchableNetworks}`.toLowerCase().includes(normalizedCoinSearch);
        })
        .sort((a, b) => {
            const aPopular = a.networks.some((coin) => popularNowPaymentsCoinIds.has(coin.id.toLowerCase())) ? 0 : 1;
            const bPopular = b.networks.some((coin) => popularNowPaymentsCoinIds.has(coin.id.toLowerCase())) ? 0 : 1;
            if (aPopular !== bPopular) return aPopular - bPopular;
            return a.label.localeCompare(b.label);
        });
    const availableNetworkOptions = selectedCoin
        ? selectedCoin.networks
        : [];
    const filteredNetworkOptions = availableNetworkOptions
        .filter((coin) => {
            if (!normalizedNetworkSearch) return true;
            const searchable = `${coin.network} ${coin.id} ${coin.label}`.toLowerCase();
            return searchable.includes(normalizedNetworkSearch);
        })
        .sort((a, b) => a.network.localeCompare(b.network) || a.id.localeCompare(b.id));
    const displayedNetworkOptions = filteredNetworkOptions.length
        ? filteredNetworkOptions
        : availableNetworkOptions;
    const appliedBonusTitle = promoResult?.bonus.title || selectedBonus?.title || (promoCode ? `Promo ${promoCode}` : '');
    const appliedBonusValueLabel = promoResult
        ? `${isFiatFlow ? fiatSymbol : '$'}${formatAmount(promoResult.estimatedBonus)}`
        : selectedBonus
            ? selectedBonus.percentage > 0
                ? `${selectedBonus.percentage}% match`
                : `${isFiatFlow ? fiatSymbol : '$'}${formatAmount(selectedBonus.amount)} flat`
            : '';
    const appliedBonusMeta = promoBlockingError
        ? promoBlockingError
        : promoValidating
            ? 'Checking bonus eligibility for this deposit.'
            : promoResult?.valid
                ? `Estimated bonus ${appliedBonusValueLabel}${bonusRequiresFirstDeposit ? ' · First deposit only' : ''}`
                : promoCode
                    ? 'This bonus will stay attached to your deposit request.'
                    : '';
    const lightFieldClass = 'rounded-[18px] border border-white/[0.06] bg-bg-elevated px-4 py-3';
    const lightCardClass = 'rounded-[20px] border border-white/[0.06] bg-bg-card shadow-soft';

    const renderGatewayLogo = (
        gateway: GatewayOption,
        wrapperClass: string,
        fallbackClass: string,
        imageClass = 'h-full w-full object-contain p-2',
    ) => (
        <div className={wrapperClass}>
            {gateway.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={gateway.logoUrl} alt={gateway.label} className={imageClass} style={{ width: 'auto', maxWidth: 'fit-content' }} />
            ) : (
                <span className={fallbackClass}>{gateway.icon}</span>
            )}
        </div>
    );

    const renderBodyTabs = () => (
        <div className="grid grid-cols-2 gap-1 rounded-[18px] border border-white/[0.06] bg-bg-elevated p-1">
            <button
                onClick={() => {
                    setActiveTab('fiat');
                    resetCryptoState();
                    setMessage(null);
                    setIframeUrl(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold transition-all ${activeTab === 'fiat'
                    ? 'border border-brand-gold/20 bg-bg-card text-text-primary shadow-soft'
                    : 'text-text-muted hover:text-text-primary'
                    }`}
            >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brown-accent text-[10px] font-bold text-text-primary">
                    {fiatSymbol}
                </span>
                {fiatTabLabel}
            </button>
            <button
                onClick={() => {
                    setActiveTab('crypto');
                    setMessage(null);
                    setSelectedMethod('');
                }}
                className={`flex items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold transition-all ${activeTab === 'crypto'
                    ? 'border border-brand-gold/20 bg-bg-card text-text-primary shadow-soft'
                    : 'text-text-muted hover:text-text-primary'
                    }`}
            >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-text-inverse">
                    B
                </span>
                {cryptoTabLabel}
            </button>
        </div>
    );

    const renderConfigureView = () => {
        const showFiatAmountStep = isFiatFlow && (!!selectedMethod || isForcedManualFlow);
        const showFooterAction = showFiatAmountStep || (!isFiatFlow && !!selectedNetworkOption);

        return (
            <div className="flex min-h-0 flex-1 flex-col bg-bg-card">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
                    <div className="mx-auto w-full max-w-md space-y-4 sm:max-w-lg">
                        {canShowFiatTab && renderBodyTabs()}

                        {!canShowFiatTab && (
                            <div className="rounded-[18px] border border-white/[0.06] bg-bg-elevated px-4 py-3 text-center text-sm font-semibold text-text-primary">
                                {cryptoTabLabel}
                            </div>
                        )}

                        {isFiatFlow ? (
                            showFiatAmountStep ? (
                                <>
                                    {!isForcedManualFlow && (
                                        <button
                                            onClick={() => {
                                                setSelectedMethod('');
                                                setAmountError('');
                                                setMessage(null);
                                            }}
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                            Back
                                        </button>
                                    )}

                                    {!isForcedManualFlow && selectedGateway && (
                                        <div className="px-1">
                                            <div className="flex items-center gap-3">
                                                {renderGatewayLogo(selectedGateway, 'flex h-14 w-14 items-center justify-center overflow-hidden text-text-primary', 'text-2xl')}
                                                <div>
                                                    <p className="text-2xl font-adx-bold tracking-tight text-text-primary">
                                                        {selectedGateway.label}
                                                    </p>
                                                    <p className="mt-1 text-sm text-text-muted">{selectedGateway.sub}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {isForcedManualFlow && gatewayRetryState && (
                                        <div className="rounded-[20px] border border-brand-gold/20 bg-brand-gold/10 px-4 py-3">
                                            <p className="text-sm font-semibold text-text-primary">{gatewayRetryState.message}</p>
                                            <p className="mt-1 text-xs text-text-muted">
                                                Ref {gatewayRetryState.pendingTransaction?.utr || 'Pending'} · {fiatSymbol}{formatAmount(gatewayRetryState.pendingTransaction?.amount || 0)}
                                            </p>
                                        </div>
                                    )}

                                    <div className={lightFieldClass}>
                                        <p className="text-xs text-text-muted">Amount</p>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            pattern="[0-9]*"
                                            value={amount}
                                            onChange={(e) => {
                                                const value = sanitizeAmountInput(e.target.value);
                                                setAmount(value);
                                                setMessage(null);
                                                const numericValue = parseFloat(value);
                                                if (value && activeGatewayMinDeposit && numericValue < activeGatewayMinDeposit) {
                                                    setAmountError(`Minimum deposit is ${fiatSymbol}${activeGatewayMinDeposit}`);
                                                } else {
                                                    setAmountError('');
                                                }
                                            }}
                                            placeholder={`${fiatSymbol}0`}
                                            className="mt-1 w-full bg-transparent text-[2rem] font-adx-bold tracking-tight text-text-primary placeholder:text-text-muted focus:outline-none"
                                        />
                                    </div>

                                    <p className="px-1 text-sm text-text-secondary">
                                        Minimum deposit {currentMinimumLabel}.
                                    </p>

                                    <div className="flex flex-wrap gap-2">
                                        {currentQuickAmounts.map((value) => (
                                            <button
                                                key={value}
                                                onClick={() => {
                                                    setAmount(value);
                                                    setMessage(null);
                                                    if (activeGatewayMinDeposit && parseFloat(value) < activeGatewayMinDeposit) {
                                                        setAmountError(`Minimum deposit is ${fiatSymbol}${activeGatewayMinDeposit}`);
                                                    } else {
                                                        setAmountError('');
                                                    }
                                                }}
                                                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${amount === value
                                                    ? 'bg-brand-gold text-text-inverse shadow-glow-gold'
                                                    : 'bg-bg-elevated text-text-primary hover:bg-bg-hover'
                                                    }`}
                                            >
                                                {fiatSymbol}{value}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={`${lightFieldClass} flex items-center justify-between`}>
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brown-accent text-[11px] font-bold text-text-primary">
                                                {fiatSymbol}
                                            </span>
                                            <span className="text-base font-medium text-text-primary">
                                                US Dollar
                                            </span>
                                        </div>
                                        <ChevronDown className="h-5 w-5 text-text-muted" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {gatewayOptions.map((gateway) => (
                                            <button
                                                key={gateway.id}
                                                onClick={() => {
                                                    setSelectedMethod(gateway.id);
                                                    setSelectedMethodError('');
                                                    setAmountError('');
                                                    setMessage(null);
                                                }}
                                                className="rounded-[20px] border border-white/[0.06] bg-bg-elevated p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-bg-hover"
                                            >
                                                {renderGatewayLogo(
                                                    gateway,
                                                    'flex h-12 w-full items-center overflow-hidden text-text-primary',
                                                    'text-2xl',
                                                    'h-full w-full object-contain object-left py-1',
                                                )}
                                                <p className="mt-2 text-base font-semibold text-text-primary">{gateway.label}</p>
                                                <p className="mt-1 text-sm text-text-muted">{gateway.sub || `${fiatSymbol}${formatAmount(gateway.minDeposit)} min`}</p>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )
                        ) : (
                            <>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (cryptoStep !== 'configure' || cryptoOptionsLoading) return;
                                            setIsCoinDropdownOpen((open) => !open);
                                            setIsNetworkDropdownOpen(false);
                                        }}
                                        disabled={cryptoStep !== 'configure' || cryptoOptionsLoading}
                                        className={`${lightFieldClass} flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60`}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-bold text-brand-gold">
                                                {selectedCoin ? buildCoinMonogram(selectedCoin.label, selectedCoin.code).slice(0, 1) : 'C'}
                                            </span>
                                            <span className="truncate text-base font-medium text-text-primary">
                                                {selectedCoin?.label || 'Select coin'}
                                            </span>
                                        </div>
                                        <ChevronDown className={`h-5 w-5 text-text-muted transition-transform ${isCoinDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isCoinDropdownOpen && (
                                        <div className={`relative mt-2 z-10 ${lightCardClass}`}>
                                            <div className="p-4">
                                                <div className="flex items-center gap-2 rounded-[16px] border border-white/[0.06] bg-bg-elevated px-3 py-3">
                                                    <Search className="h-4 w-4 shrink-0 text-text-muted" />
                                                    <input
                                                        type="text"
                                                        value={coinSearch}
                                                        onChange={(e) => setCoinSearch(e.target.value)}
                                                        placeholder="Search"
                                                        className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="max-h-72 overflow-y-auto px-3 pb-3">
                                                {displayedCoinOptions.map((coin) => (
                                                    <button
                                                        key={coin.code}
                                                        type="button"
                                                        onClick={() => {
                                                            if (cryptoStep !== 'configure') return;
                                                            setSelectedCoinCode(coin.code);
                                                            setSelectedNetworkOption(null);
                                                            setNetworkSearch('');
                                                            setIsCoinDropdownOpen(false);
                                                        }}
                                                        className="flex w-full items-center gap-3 border-b border-white/[0.06] px-2 py-3 text-left last:border-b-0"
                                                    >
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-bold text-brand-gold">
                                                            {buildCoinMonogram(coin.label, coin.code).slice(0, 1)}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-base font-medium text-text-primary">{coin.label}</p>
                                                            <p className="mt-0.5 text-sm text-text-muted">{coin.code}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {selectedCoin && (
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (cryptoStep !== 'configure' || cryptoOptionsLoading || !selectedCoin) return;
                                                setIsNetworkDropdownOpen((open) => !open);
                                                setIsCoinDropdownOpen(false);
                                            }}
                                            disabled={cryptoStep !== 'configure' || cryptoOptionsLoading || !selectedCoin}
                                            className={`${lightFieldClass} flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                            <span className="truncate text-base font-medium text-text-primary">
                                                {selectedNetworkOption?.network || 'Select network'}
                                            </span>
                                            <ChevronDown className={`h-5 w-5 text-text-muted transition-transform ${isNetworkDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isNetworkDropdownOpen && (
                                            <div className={`relative mt-2 z-10 ${lightCardClass}`}>
                                                <div className="max-h-72 overflow-y-auto px-3 py-2">
                                                    {displayedNetworkOptions.map((coin) => (
                                                        <button
                                                            key={coin.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (cryptoStep !== 'configure') return;
                                                                setSelectedNetworkOption(coin);
                                                                setIsNetworkDropdownOpen(false);
                                                            }}
                                                            className="flex w-full items-start justify-between gap-3 border-b border-white/[0.06] px-2 py-3 text-left last:border-b-0"
                                                        >
                                                            <div>
                                                                <p className="text-base font-medium text-text-primary">{coin.network}</p>
                                                                <p className="mt-0.5 text-sm text-text-muted">
                                                                    Crediting time ≈ {coin.network.toLowerCase().includes('erc') ? '10' : '5'} minutes
                                                                </p>
                                                            </div>
                                                            {selectedNetworkOption?.id === coin.id && (
                                                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedNetworkOption && (
                                    <>
                                        <div className={lightFieldClass}>
                                            <p className="text-xs text-text-muted">Amount</p>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                pattern="[0-9]*"
                                                value={amount}
                                                onChange={(e) => {
                                                    const value = sanitizeAmountInput(e.target.value);
                                                    setAmount(value);
                                                    setMessage(null);
                                                    const numericValue = parseFloat(value);
                                                    if (value && numericValue < minDepositCrypto) {
                                                        setCryptoAmountError(`Minimum crypto deposit is $${minDepositCrypto}`);
                                                    } else {
                                                        setCryptoAmountError('');
                                                    }
                                                }}
                                                placeholder={`$${minDepositCrypto}`}
                                                className="mt-1 w-full bg-transparent text-[2rem] font-adx-bold tracking-tight text-text-primary placeholder:text-text-muted focus:outline-none"
                                            />
                                        </div>

                                        <p className="text-center text-sm leading-relaxed text-text-secondary">
                                            Minimum <span className="font-semibold text-text-primary">USD {formatAmount(minDepositCrypto)}</span>
                                            <br />
                                            Amounts below this will not be credited.
                                        </p>
                                    </>
                                )}
                            </>
                        )}

                        {(promoCode || message) && (
                            <div className="space-y-3">
                                {promoCode && (
                                    <div className={`rounded-[18px] border px-4 py-3 text-sm ${promoBlockingError
                                        ? 'border-danger/30 bg-danger-soft text-danger'
                                        : 'border-brand-gold/20 bg-brand-gold/10 text-text-secondary'
                                        }`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-text-primary">{appliedBonusTitle}</p>
                                                <p className="mt-1 leading-relaxed">{appliedBonusMeta}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {promoValidating ? (
                                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-gold" />
                                                ) : (
                                                    <Gift className="h-4 w-4 shrink-0 text-brand-gold" />
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setPromoCode('');
                                                        setSelectedBonusId(null);
                                                        setPromoError('');
                                                        window.sessionStorage.removeItem(manualDepositBonusCodeKey);
                                                        api.delete('/bonus/pending').catch(() => {});
                                                        toast.success('Bonus removed');
                                                    }}
                                                    type="button"
                                                    className="rounded hover:bg-white/[0.08] p-1 text-slate-400 hover:text-white transition-colors"
                                                    title="Remove Bonus"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {message && (
                                    <div className={`rounded-[18px] border px-4 py-3 text-sm ${message.type === 'error'
                                        ? 'border-danger/30 bg-danger-soft text-danger'
                                        : 'border-brand-gold/20 bg-brand-gold/10 text-text-secondary'
                                        }`}>
                                        {message.text}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {showFooterAction && (
                    <div className="shrink-0 border-t border-white/[0.06] bg-bg-card px-4 py-4 sm:px-5">
                        <div className="mx-auto flex max-w-md flex-col gap-3 sm:max-w-lg">
                            {!isForcedManualFlow && (
                                <p className={`text-sm ${promoBlockingError || currentAmountError || selectedMethodError ? 'text-danger' : 'text-text-muted'}`}>
                                    {currentSubmitHint}
                                </p>
                            )}

                            <button
                                onClick={isFiatFlow
                                    ? isForcedManualFlow
                                        ? () => handleManualFallback(gatewayRetryState?.message, false)
                                        : handleFiatSubmit
                                    : handleGenerateCryptoAddress}
                                disabled={currentSubmitDisabled}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-brand-gold px-6 py-3.5 text-sm font-semibold text-text-inverse shadow-glow-gold transition-all hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing…
                                    </>
                                ) : (
                                    isForcedManualFlow ? 'Continue to Manual UPI' : isFiatFlow ? 'Deposit' : 'Generate Address'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
        try {
            const iframeWindow = e.currentTarget.contentWindow;
            if (!iframeWindow) return;
            // This will throw a DOMException if on a cross-origin payment gateway
            const href = iframeWindow.location.href;
            if (href && (href.includes('zeero.bet') || href.includes(window.location.host))) {
                onClose();
            }
        } catch {
            // Expected catch: iframe is currently on an external payment provider
        }
    };

    const renderIframeView = () => (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-card">
            <div className="shrink-0 flex items-center justify-end border-b border-white/[0.06] bg-bg-card px-4 py-3 sm:px-5">
                <button
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full border border-white/[0.06] bg-bg-elevated px-6 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                >
                    Close
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-bg-card">
                <iframe
                    src={iframeUrl || undefined}
                    onLoad={handleIframeLoad}
                    className="block h-full min-h-0 w-full border-0 bg-bg-card"
                    title="Secure Payment"
                    allow="payment"
                />
            </div>
        </div>
    );

    const renderAwaitingView = () => (
        <div className="flex min-h-0 flex-1 flex-col bg-bg-card">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
                <div className="mx-auto w-full max-w-md space-y-4 sm:max-w-lg">
                    {canShowFiatTab && renderBodyTabs()}

                    <div className={`${lightFieldClass} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-bold text-brand-gold">
                                {selectedCoin ? buildCoinMonogram(selectedCoin.label, selectedCoin.code).slice(0, 1) : 'C'}
                            </span>
                            <span className="text-base font-medium text-text-primary">{selectedCoin?.label || paymentData?.payCurrency}</span>
                        </div>
                        <ChevronDown className="h-5 w-5 text-text-muted" />
                    </div>

                    <div className={`${lightFieldClass} flex items-center justify-between`}>
                        <span className="text-base font-medium text-text-primary">{selectedNetworkOption?.network}</span>
                        <ChevronDown className="h-5 w-5 text-text-muted" />
                    </div>

                    <p className="text-center text-sm leading-relaxed text-text-secondary">
                        Minimum <span className="font-semibold text-text-primary">USD {formatAmount(minDepositCrypto)}</span>
                        <br />
                        Amounts below this will not be credited.
                    </p>

                    {paymentData && (
                        <div className="rounded-[22px] border border-white/[0.06] bg-bg-elevated p-4 shadow-soft">
                            {/* Exact crypto amount to send — calculated by NOWPayments
                                for the USD amount the user entered. Without this the
                                user has no way of knowing how many coins to transfer. */}
                            {paymentData.payAmount > 0 && (
                                <div className="mb-4 rounded-[16px] border border-brand-gold/30 bg-brand-gold/10 px-4 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
                                        Send exactly
                                    </p>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                        <p className="break-all text-lg font-adx-bold tracking-tight text-text-primary sm:text-xl">
                                            {paymentData.payAmount} {String(paymentData.payCurrency || selectedCoin?.code || '').toUpperCase()}
                                        </p>
                                        <button
                                            onClick={() => handleCopy(String(paymentData.payAmount))}
                                            className="shrink-0 inline-flex items-center gap-1 rounded-[10px] border border-brand-gold/40 bg-brand-gold/10 px-2.5 py-1.5 text-[11px] font-semibold text-brand-gold transition-colors hover:bg-brand-gold/20"
                                        >
                                            <Copy className="h-3 w-3" />
                                            Copy
                                        </button>
                                    </div>
                                    <p className="mt-1 text-[11px] text-text-muted">
                                        ≈ ${amount} USD · sending less will not be credited
                                    </p>
                                </div>
                            )}

                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex justify-center sm:block">
                                    <div className="inline-flex rounded-[16px] bg-white p-2">
                                        <QRCode value={paymentData.payAddress} size={120} bgColor="#FFFFFF" fgColor="#07111b" />
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1 text-center sm:text-left">
                                    <p className="text-[1.75rem] font-adx-bold tracking-tight text-text-primary">Deposit address</p>
                                    <p className="mt-2 break-all text-sm font-semibold text-text-secondary">
                                        {paymentData.payAddress}
                                    </p>
                                    <button
                                        onClick={() => handleCopy(paymentData.payAddress)}
                                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-[12px] bg-brand-gold px-5 py-2.5 text-sm font-semibold text-text-inverse shadow-glow-gold transition-colors hover:bg-brand-gold-hover"
                                    >
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between rounded-[18px] border border-white/[0.06] bg-bg-elevated px-4 py-3 text-sm text-text-muted">
                        <span>{statusMap[paymentStatus]?.label || paymentStatus}</span>
                        {timeLeft > 0 ? <span>{formatTime(timeLeft)}</span> : <RefreshCw className={`h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />}
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-t border-white/[0.06] bg-bg-card px-4 py-4 sm:px-5">
                <div className="mx-auto flex max-w-md items-center justify-between gap-3 sm:max-w-lg">
                    <button
                        onClick={() => { stopPolling(); stopTimer(); resetCryptoState(); }}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <p className="text-right text-xs text-text-muted">
                        Waiting for confirmation on the network.
                    </p>
                </div>
            </div>
        </div>
    );

    const renderSuccessView = () => (
        <div className="flex flex-1 items-center justify-center bg-bg-card px-4 py-8 sm:px-6">
            <div className="w-full max-w-md rounded-[28px] border border-white/[0.06] bg-bg-elevated p-6 text-center shadow-soft">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-gold/10">
                    <CheckCircle2 className="h-10 w-10 text-brand-gold" />
                </div>
                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-gold">Transfer Complete</p>
                <h3 className="mt-3 text-3xl font-adx-bold tracking-tight text-text-primary">Deposit Confirmed</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
                    Your crypto deposit of <span className="font-semibold text-text-primary">${amount} USD</span> has been confirmed and credited to your balance.
                </p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-white/[0.06] bg-bg-base p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Amount</p>
                        <p className="mt-2 text-sm font-semibold text-text-primary">${amount}</p>
                    </div>
                    <div className="rounded-[18px] border border-white/[0.06] bg-bg-base p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Route</p>
                        <p className="mt-2 text-sm font-semibold text-text-primary">{selectedNetworkOption?.network || selectedCoin?.label || 'Crypto'}</p>
                    </div>
                </div>

                <button
                    onClick={() => { resetCryptoState(); onClose(); }}
                    className="mt-7 inline-flex items-center justify-center rounded-[16px] bg-brand-gold px-8 py-3 text-sm font-semibold text-text-inverse shadow-glow-gold transition-all hover:bg-brand-gold-hover"
                >
                    Done
                </button>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.08),transparent_28%),rgba(0,0,0,0.85)] backdrop-blur-md"
                onClick={onClose}
            />

            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5">
                <div className="pointer-events-auto relative flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden overscroll-contain bg-bg-card text-text-primary shadow-hard sm:h-[85vh] sm:min-h-[85vh] sm:max-h-[85vh] sm:max-w-[430px] sm:rounded-[28px]">
                    <div className="relative flex min-h-0 flex-1 flex-col">
                        <div className="shrink-0 border-b border-white/[0.06] bg-bg-card px-5 pb-4 pt-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-adx-bold tracking-tight text-text-primary">
                                    {modalTitle}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {!isIndia && (
                            <div className="shrink-0 border-b border-brand-gold/20 bg-brand-gold/10 px-4 py-3 text-sm text-text-secondary">
                                UPI and fiat routes are available for India registrations only. This account stays in crypto mode here.
                            </div>
                        )}

                        {iframeUrl
                            ? renderIframeView()
                            : (isFiatFlow || cryptoStep === 'configure')
                                ? renderConfigureView()
                                : cryptoStep === 'awaiting' && paymentData
                                    ? renderAwaitingView()
                                    : renderSuccessView()}
                    </div>
                </div>
            </div>
        </>
    );
}
