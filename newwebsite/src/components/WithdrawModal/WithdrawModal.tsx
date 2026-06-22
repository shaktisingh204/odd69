'use client';

import React, { useState, useEffect } from 'react';
import {
    X, ArrowDownLeft, ShieldCheck, AlertCircle, Loader2,
    Check, CheckCircle2, Bitcoin,
    Landmark, User, Hash, Code, Smartphone, Wallet, Lock, Zap,
} from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import { getCurrencySymbol } from '@/utils/currency';
// ─── Types ─────────────────────────────────────────────────────────────────

type WithdrawMethod = 'bank' | 'crypto';

interface WithdrawModalProps {
    onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const quickAmounts = ['500', '1000', '2000', '5000', '10000'];
const quickAmountsCrypto = ['20', '50', '100', '200', '500'];

const cryptoOptions = [
    { id: 'usdttrc20', label: 'USDT', network: 'TRC20', icon: '₮', color: '#26A17B' },
    { id: 'usdterc20', label: 'USDT', network: 'ERC20', icon: '₮', color: '#26A17B' },
    { id: 'btc', label: 'Bitcoin', network: 'BTC', icon: '₿', color: '#F7931A' },
    { id: 'eth', label: 'Ethereum', network: 'ERC20', icon: 'Ξ', color: '#627EEA' },
    { id: 'bnb', label: 'BNB', network: 'BEP20', icon: 'B', color: '#F3BA2F' },
    { id: 'ltc', label: 'Litecoin', network: 'LTC', icon: 'Ł', color: '#BFBBBB' },
    { id: 'xrp', label: 'XRP', network: 'XRP', icon: '✕', color: '#346AA9' },
    { id: 'trx', label: 'TRON', network: 'TRC20', icon: '◈', color: '#EF0027' },
];

// Shared field style
const fieldCls =
    'w-full bg-white/[0.04] border border-white/[0.06] hover:border-[#ff7a1a]/30 focus:border-[#ff7a1a]/50 rounded-xl py-3 px-4 text-sm text-text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ff7a1a]/40 transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]';
const labelCls = 'text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block';
const iconFieldCls = `${fieldCls} pl-10`;

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

// ─── Component ──────────────────────────────────────────────────────────────

const WithdrawModal: React.FC<WithdrawModalProps> = ({ onClose }) => {
    const { user } = useAuth();
    const {
        fiatBalance,
        casinoBonus,
        sportsBonus,
        cryptoBonus,
        cryptoBalance,
        activeCasinoBonus,
        activeSportsBonus,
        depositWageringRequired,
        depositWageringDone,
        refreshWallet,
    } = useWallet();

    // Total active fiat bonuses (casino + sports)
    const totalFiatBonus = (casinoBonus ?? 0) + (sportsBonus ?? 0);
    const hasFiatBonus = totalFiatBonus > 0;
    const hasCryptoBonus = (cryptoBonus ?? 0) > 0;
    const hasAnyBonus = hasFiatBonus || hasCryptoBonus;
    const [bonusForfeitConfirmed, setBonusForfeitConfirmed] = useState(false);

    // Only show crypto option if user has a crypto balance
    const hasCryptoBalance = (cryptoBalance ?? 0) > 0;

    // STRICT: fiat only for users whose registered country is exactly 'IN'.
    const isIndia = user?.country === 'IN';
    // Dynamic fiat currency symbol based on user's registered currency
    const fiatSymbol = getCurrencySymbol('USD');

    // Determine available methods
    const availableMethods: WithdrawMethod[] = isIndia
        ? ['bank', ...(hasCryptoBalance ? ['crypto' as WithdrawMethod] : [])]
        : hasCryptoBalance ? ['crypto'] : [];

    // Always start on first available method
    const [method, setMethod] = useState<WithdrawMethod>(availableMethods[0] ?? 'bank');

    // Shared
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // ── Min withdrawal settings ────────────────────────────────────────────
    const [minWithdrawal, setMinWithdrawal] = useState<number>(500);
    const [minWithdrawalCrypto, setMinWithdrawalCrypto] = useState<number>(10);

    const isProfileIncomplete = user && (
        !user.firstName?.trim() || 
        !user.lastName?.trim() || 
        !user.country?.trim() || 
        !user.city?.trim() ||
        !user.email?.trim() ||
        !user.phoneNumber?.trim()
    );

    useEffect(() => {
        // Update method if available methods change (e.g. wallet loaded)
        if (!availableMethods.includes(method)) {
            setMethod(availableMethods[0] ?? 'bank');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isIndia, hasCryptoBalance]);

    useEffect(() => {
        api.get('/settings/public')
            .then(res => {
                const d = res.data || {};
                const min = parseFloat(d.MIN_WITHDRAWAL);
                if (!isNaN(min) && min > 0) setMinWithdrawal(min);
                const minCrypto = parseFloat(d.MIN_WITHDRAWAL_CRYPTO);
                if (!isNaN(minCrypto) && minCrypto > 0) setMinWithdrawalCrypto(minCrypto);
            })
            .catch(() => { });
    }, []);

    // ── Saved withdrawal details (localStorage) ─────────────────────────
    const savedBank = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('withdraw_bank') || 'null') : null;
    const savedCrypto = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('withdraw_crypto') || 'null') : null;

    // ── UPI fields ─────────────────────────────────────────────────────────
    const [upiHolderName, setUpiHolderName] = useState('');
    const [upiId, setUpiId] = useState('');

    // ── Bank fields ────────────────────────────────────────────────────────
    const [bankHolderName, setBankHolderName] = useState(savedBank?.holderName || '');
    const [bankAccountNo, setBankAccountNo] = useState(savedBank?.accountNo || '');
    const [bankIfsc, setBankIfsc] = useState(savedBank?.ifsc || '');
    const [bankName, setBankName] = useState(savedBank?.bankName || '');

    // ── Crypto fields ──────────────────────────────────────────────────────
    const [selectedCoin, setSelectedCoin] = useState(
        (savedCrypto?.coinId && cryptoOptions.find(c => c.id === savedCrypto.coinId)) || cryptoOptions[0],
    );
    const [walletAddress, setWalletAddress] = useState(savedCrypto?.address || '');

    const resetMessage = () => setMessage(null);

    // ── Real-time validation ─────────────────────────────────────────────
    const isCrypto = method === 'crypto';
    const amountNum = parseFloat(amount) || 0;
    const walletBalance = fiatBalance ?? 0;

    const exceedsBalance = !isCrypto && amountNum > 0 && amountNum > walletBalance;
    const activeMin = isCrypto ? minWithdrawalCrypto : minWithdrawal;
    const belowMinimum = amountNum > 0 && amountNum < activeMin;
    const hasValidationError = exceedsBalance || belowMinimum;

    // ── Wagering / turnover gating ────────────────────────────────────────
    const wageringRequired = depositWageringRequired ?? 0;
    const wageringDone = depositWageringDone ?? 0;
    const wageringBlocked = wageringRequired > 0 && wageringDone < wageringRequired;
    const wageringPct = wageringRequired > 0 ? Math.min(100, Math.round((wageringDone / wageringRequired) * 100)) : 100;
    const wageringRemaining = Math.max(0, wageringRequired - wageringDone);

    const getBonusWageringRemaining = (
        bonus: { wageringRemaining?: number; wageringRequired?: number; wageringDone?: number } | null | undefined,
    ) => {
        if (!bonus) return 0;
        const explicitRemaining = Number(bonus.wageringRemaining ?? 0);
        if (explicitRemaining > 0) return explicitRemaining;
        return Math.max(0, Number(bonus.wageringRequired ?? 0) - Number(bonus.wageringDone ?? 0));
    };

    const bonusActionItems = [
        { type: 'CASINO' as const, label: 'Casino Bonus', balance: casinoBonus ?? 0, bonus: activeCasinoBonus },
        { type: 'SPORTS' as const, label: 'Sports Bonus', balance: sportsBonus ?? 0, bonus: activeSportsBonus },
    ].map((item) => ({
        ...item,
        wageringRemaining: getBonusWageringRemaining(item.bonus),
        isPendingConversion: item.bonus?.status === 'PENDING_CONVERSION',
    }));

    const actionableBonusActions = bonusActionItems.filter((item) => item.balance > 0 && !item.bonus?.isSynthetic);
    // Awaiting admin action — wagering done but status is PENDING_CONVERSION
    const pendingApprovalBonusActions = actionableBonusActions.filter((item) => item.isPendingConversion);
    const lockedBonusActions = actionableBonusActions.filter((item) => !item.isPendingConversion && item.wageringRemaining > 0);

    // ── Forfeit bonuses before submitting withdrawal ─────────────────────
    const forfeitBonusesAndSubmit = async (submitFn: () => Promise<void>) => {
        if (hasAnyBonus && !bonusForfeitConfirmed) return;
        if (hasAnyBonus) {
            try {
                if ((casinoBonus ?? 0) > 0) await api.post('/bonus/forfeit', { type: 'CASINO' }).catch(() => { });
                if ((sportsBonus ?? 0) > 0) await api.post('/bonus/forfeit', { type: 'SPORTS' }).catch(() => { });
                await refreshWallet();
            } catch { /* non-fatal */ }
        }
        await submitFn();
    };

    // ── Generic manual withdrawal submit ─────────────────────────────────
    const submitWithdrawal = async (paymentDetails: Record<string, unknown>) => {
        setLoading(true);
        try {
            const res = await api.post('/transactions/withdraw', {
                userId: user?.id,
                amount: parseFloat(amount),
                paymentDetails,
            });
            if (res.data) {
                toast.success('Withdrawal request submitted!');
                setMessage({ type: 'success', text: 'Your withdrawal request has been submitted and is pending admin approval. Processing within 24 hours.' });
                setTimeout(onClose, 2500);
            }
        } catch (err: unknown) {
            const maybeAxiosError = err as { response?: { data?: { message?: string } }; message?: string };
            const msg = maybeAxiosError.response?.data?.message || maybeAxiosError.message || 'Failed to submit request.';
            setMessage({ type: 'error', text: msg });
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // ── Submit: UPI ───────────────────────────────────────────────────────
    const handleUpiSubmit = async () => {
        resetMessage();
        if (!amount || !upiHolderName || !upiId) {
            toast.error('Please fill in all required fields.'); return;
        }
        if (parseFloat(amount) <= 0) { toast.error('Enter a valid amount.'); return; }
        await submitWithdrawal({
            method: 'UPI',
            holderName: upiHolderName,
            upiId,
            currency: 'USD',
        });
    };

    // ── Submit: Bank Transfer ─────────────────────────────────────────────
    const handleBankSubmit = async () => {
        resetMessage();
        if (!amount || !bankHolderName || !bankAccountNo || !bankIfsc) {
            toast.error('Please fill in all required fields.'); return;
        }
        if (parseFloat(amount) <= 0) { toast.error('Enter a valid amount.'); return; }
        await submitWithdrawal({
            method: 'BANK',
            holderName: bankHolderName,
            accountNo: bankAccountNo,
            ifsc: bankIfsc,
            bankName,
            currency: 'USD',
        });
        // Save bank details for future auto-fill
        localStorage.setItem('withdraw_bank', JSON.stringify({
            holderName: bankHolderName, accountNo: bankAccountNo, ifsc: bankIfsc, bankName,
        }));
    };

    // ── Submit: Crypto ────────────────────────────────────────────────────
    const handleCryptoSubmit = async () => {
        resetMessage();
        if (!amount || !walletAddress) {
            toast.error('Please enter amount and wallet address.'); return;
        }
        if (parseFloat(amount) <= 0) { toast.error('Enter a valid amount.'); return; }
        await submitWithdrawal({
            method: 'CRYPTO',
            coin: selectedCoin.id,
            coinLabel: selectedCoin.label,
            network: selectedCoin.network,
            address: walletAddress,
            currency: 'USD',
        });
        // Save crypto details for future auto-fill
        localStorage.setItem('withdraw_crypto', JSON.stringify({
            coinId: selectedCoin.id, address: walletAddress,
        }));
    };

    const handleSubmit = () => {
        const submitFn =
            method === 'bank' ? handleBankSubmit :
            handleCryptoSubmit;
        forfeitBonusesAndSubmit(submitFn);
    };

    const quickList = isCrypto ? quickAmountsCrypto : quickAmounts;
    const amountPrefix = isCrypto ? '$' : fiatSymbol;

    // Method card config
    const allMethodCards: { id: WithdrawMethod; label: string; sub: string; icon: React.ReactNode }[] = [
        { id: 'bank' as WithdrawMethod, label: 'Bank Transfer', sub: 'NEFT / IMPS', icon: <Landmark className="w-5 h-5 text-brand-gold" /> },
        { id: 'crypto' as WithdrawMethod, label: 'Crypto', sub: 'On-chain · Secure', icon: <Bitcoin className="w-5 h-5 text-warning" /> },
    ];
    const methodCards = allMethodCards.filter(m => availableMethods.includes(m.id));

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-lg" onClick={onClose} />

            {/* Modal — bottom sheet on mobile, centered on desktop */}
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
                <div
                    className="pointer-events-auto w-full sm:max-w-5xl max-h-[95dvh] sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-xl border border-white/[0.05] relative"
                    style={{ background: 'linear-gradient(155deg, var(--bg-odd69-2) 0%, var(--bg-deep-3) 60%, #100d0a 100%)' }}
                >
                    {/* Ambient glow accents */}
                    <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, var(--brand-gold) 0%, transparent 70%)' }} />
                    <div className="pointer-events-none absolute -bottom-32 -left-24 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: 'radial-gradient(circle, var(--action-primary) 0%, transparent 70%)' }} />

                    {/* Drag handle (mobile) */}
                    <div className="sm:hidden absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-white/20" />

                    {/* ═══ HEADER ═══ */}
                    <div className="relative flex items-center justify-between px-5 sm:px-7 pt-6 pb-4 border-b border-white/[0.04] shrink-0">
                        <div className="flex items-center gap-3.5">
                            <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg, var(--warning-alpha-12) 0%, rgba(249,115,22,0.08) 100%)', boxShadow: 'inset 0 0 0 1px rgba(251,146,60,0.25)' }}>
                                <ArrowDownLeft className="w-5 h-5 text-warning" />
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-warning ring-2 ring-[var(--bg-odd69-2)]" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-extrabold text-white leading-tight tracking-tight">Withdraw Funds</h2>
                                <p className="text-[11px] text-gray-500 mt-0.5">Secure · Manual review · 24h processing</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                            {!isCrypto && user && (
                                <div className="hidden sm:flex flex-col items-end px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Balance</span>
                                    <span className="text-sm font-extrabold text-warning-bright leading-tight">{fiatSymbol}{fmt(walletBalance)}</span>
                                </div>
                            )}
                            <button onClick={onClose} className="p-2.5 rounded-xl text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* ═══ BODY ═══ */}
                    <div className="relative flex flex-col flex-1 min-h-0 overflow-y-auto">

                        {isProfileIncomplete ? (
                            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full min-h-[420px]">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 rounded-full blur-2xl opacity-40 bg-success-vivid" />
                                    <div className="relative w-20 h-20 rounded-full bg-success-alpha-16 border border-success-primary/30 flex items-center justify-center">
                                        <User className="w-10 h-10 text-success-vivid" />
                                    </div>
                                </div>
                                <h3 className="text-2xl font-extrabold text-white mb-2 tracking-tight">Complete Your Profile</h3>
                                <p className="text-sm text-gray-400 max-w-sm mb-8 leading-relaxed">
                                    For security and verification purposes, you must complete your Personal Information (Name, Country, City) and bind both your Email and Mobile Number before requesting a withdrawal.
                                </p>
                                <a
                                    href="/settings"
                                    onClick={onClose}
                                    className="px-8 py-3.5 rounded-full text-white font-bold transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 shadow-[0_8px_24px_-8px_rgba(255,106,0,0.7)] flex items-center gap-2"
                                    style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
                                >
                                    <User className="w-5 h-5" />
                                    Go to Settings
                                </a>
                            </div>
                        ) : (
                            <div className="flex flex-col lg:flex-row lg:gap-0">
                                {/* ═══ LEFT PANEL — Method + Info (desktop sidebar) ═══ */}
                                <aside className="lg:w-[280px] lg:shrink-0 lg:border-r border-white/[0.04] p-4 sm:p-6 lg:p-6 space-y-5">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 block">Choose Method</label>

                                        {availableMethods.length === 0 ? (
                                            <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-warning-alpha-08 border border-warning/20 text-xs text-warning-bright/80">
                                                <span className="text-base leading-none shrink-0 mt-0.5">🌍</span>
                                                <span>No withdrawal method available. UPI / Bank are only for 🇮🇳 India users. Crypto withdrawals require a crypto balance.</span>
                                            </div>
                                        ) : (
                                            <div className="flex lg:flex-col gap-2">
                                                {methodCards.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => { setMethod(m.id); resetMessage(); }}
                                                        className={`group relative flex-1 lg:flex-none flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl ring-1 text-left transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${method === m.id
                                                            ? 'bg-[#ff7a1a]/15 ring-[#ff7a1a]/50'
                                                            : 'bg-white/[0.04] ring-white/[0.06] hover:bg-white/[0.06]'
                                                            }`}
                                                    >
                                                        <span className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0 transition-colors duration-200 ${method === m.id ? 'bg-[#ff7a1a]/15' : 'bg-white/[0.04]'}`}>
                                                            {m.icon}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-white leading-tight">{m.label}</div>
                                                            <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{m.sub}</div>
                                                        </div>
                                                        {method === m.id && (
                                                            <div className="w-4 h-4 rounded-full bg-[#ff7a1a] flex items-center justify-center shrink-0">
                                                                <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Non-India notice */}
                                        {!isIndia && hasCryptoBalance && (
                                            <div className="flex items-start gap-2.5 mt-3 px-3 py-2.5 rounded-xl bg-warning-alpha-08 border border-warning/20 text-xs text-warning-bright/80">
                                                <span className="text-base leading-none shrink-0 mt-0.5">🌍</span>
                                                <span>Bank Transfer is only available for 🇮🇳 India. Withdraw via <strong className="text-warning-bright">Crypto</strong> — more options coming soon for your region.</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Balance card (mobile) */}
                                    {!isCrypto && user && (
                                        <div className="lg:hidden flex items-center justify-between px-4 py-3 rounded-2xl bg-white/4 border border-white/[0.05]">
                                            <div className="flex items-center gap-2">
                                                <Wallet className="w-4 h-4 text-warning" />
                                                <span className="text-xs text-gray-400 font-semibold">Available Balance</span>
                                            </div>
                                            <span className="text-base font-extrabold text-warning-bright">{fiatSymbol}{fmt(walletBalance)}</span>
                                        </div>
                                    )}

                                    {/* Security note — desktop sidebar */}
                                    <div className="hidden lg:flex items-start gap-2.5 p-3 bg-success-soft/15 border border-success-primary/20 rounded-xl">
                                        <ShieldCheck className="w-4 h-4 text-success-bright shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[11px] font-bold text-success-bright leading-tight">Secure Withdrawal</p>
                                            <p className="text-[10px] text-success-bright/70 mt-1 leading-relaxed">Processed manually by admin within 24 hours. 256-bit SSL encrypted.</p>
                                        </div>
                                    </div>
                                </aside>

                                {/* ═══ RIGHT PANEL — Form ═══ */}
                                <div className="flex-1 min-w-0">
                                    <div className="p-4 sm:p-6 flex flex-col gap-5">

                                {/* Amount */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className={labelCls.replace('mb-1.5 block', '')}>
                                            Withdrawal Amount {isCrypto ? '(USD)' : `(${'USD'})`}
                                        </label>
                                        {!isCrypto && user && (
                                            <span className="text-[10px] font-bold text-warning flex items-center gap-1">
                                                <Wallet className="w-3 h-3" />
                                                Balance: {fiatSymbol}{fmt(walletBalance)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">
                                            {amountPrefix}
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                            placeholder="0"
                                            className={`${fieldCls} pl-10 text-2xl font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${hasValidationError ? 'border-red-500/50 focus:border-red-500/70 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]' : ''}`}
                                        />
                                        {amount && (
                                            <button onClick={() => setAmount('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Real-time validation banners */}
                                    {exceedsBalance && (
                                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-danger-alpha-08 border border-danger/20 rounded-lg">
                                            <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />
                                            <p className="text-[11px] font-medium text-danger">
                                                Amount exceeds your wallet balance ({fiatSymbol}{fmt(walletBalance)})
                                            </p>
                                        </div>
                                    )}
                                    {belowMinimum && !exceedsBalance && (
                                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-danger-alpha-08 border border-danger/20 rounded-lg">
                                            <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />
                                            <p className="text-[11px] font-medium text-danger">
                                                Minimum withdrawal is {isCrypto ? '$' : fiatSymbol}{fmt(activeMin)}
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-hide">
                                        {quickList.map((val) => (
                                            <button
                                                key={val}
                                                onClick={() => setAmount(val)}
                                                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ring-1 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${amount === val
                                                    ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] ring-[#ff7a1a]/50'
                                                    : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white ring-white/[0.06]'
                                                    }`}
                                            >
                                                {isCrypto ? `$${val}` : `+${val}`}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Pending Admin Approval (cannot self-convert) ── */}
                                {pendingApprovalBonusActions.length > 0 && (
                                    <div className="space-y-2.5 rounded-xl border border-brand-gold/25 bg-brand-alpha-10/50 p-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-brand-alpha-10/50 flex items-center justify-center shrink-0">
                                                <Lock className="w-3.5 h-3.5 text-brand-gold" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-brand-gold">Bonus Pending Admin Approval</p>
                                                <p className="text-[10px] text-brand-gold/80/70">Wagering complete! Your bonus is awaiting admin review before it's credited to your main wallet.</p>
                                            </div>
                                        </div>

                                        {pendingApprovalBonusActions.map((bonusAction) => (
                                            <div
                                                key={bonusAction.type}
                                                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold text-white">{bonusAction.label}</p>
                                                    <p className="text-[10px] text-white/35">
                                                        {fiatSymbol}{fmt(bonusAction.balance)} pending conversion
                                                    </p>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1.5 rounded-lg border border-brand-gold/25 bg-brand-alpha-10 px-3 py-1.5">
                                                    <Loader2 className="w-3 h-3 text-brand-gold animate-spin" />
                                                    <span className="text-[10px] font-bold text-brand-gold/80">Awaiting Approval</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}



                                {lockedBonusActions.length > 0 && (
                                    <div className="space-y-2.5 rounded-xl border border-warning/25 bg-warning-alpha-08 p-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-warning-alpha-12 flex items-center justify-center shrink-0">
                                                <Lock className="w-3.5 h-3.5 text-warning-bright" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-warning-bright">Bonus Wallet Rules</p>
                                                <p className="text-[10px] text-warning/70">
                                                    Bets placed from bonus funds settle back into that bonus wallet until wagering is complete.
                                                </p>
                                            </div>
                                        </div>

                                        {lockedBonusActions.map((bonusAction) => (
                                            <div
                                                key={bonusAction.type}
                                                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold text-white">{bonusAction.label}</p>
                                                    <p className="text-[10px] text-white/35">
                                                        {fiatSymbol}{fmt(bonusAction.balance)} in bonus wallet
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-warning-bright">
                                                        {fiatSymbol}{fmt(bonusAction.wageringRemaining)} wagering left
                                                    </p>
                                                    <p className="text-[9px] text-white/30">Move to main once unlocked</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}



                                {/* ══ Bank Transfer fields ══ */}
                                {method === 'bank' && (
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                                            <Landmark className="w-3.5 h-3.5 text-brand-gold" />
                                            Bank Account Details
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>Account Holder Name</label>
                                                <div className="relative">
                                                    <User className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    <input type="text" value={bankHolderName} onChange={(e) => setBankHolderName(e.target.value)}
                                                        placeholder="Full Name" className={iconFieldCls} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Bank Name</label>
                                                <div className="relative">
                                                    <Landmark className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
                                                        placeholder="e.g. HDFC Bank" className={iconFieldCls} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Account Number</label>
                                                <div className="relative">
                                                    <Hash className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    <input type="text" value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)}
                                                        placeholder="Account Number" className={iconFieldCls} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelCls}>IFSC Code</label>
                                                <div className="relative">
                                                    <Code className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    <input type="text" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                                                        placeholder="e.g. HDFC0001234" className={`${iconFieldCls} uppercase`} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-brand-gold/8 border border-brand-gold/25 text-[10px] text-brand-gold/80">
                                            <span className="text-sm leading-none shrink-0 mt-0.5">🏦</span>
                                            <span>Bank transfers processed within 1–24 hours after admin approval.</span>
                                        </div>
                                    </div>
                                )}

                                {/* ══ Crypto fields ══ */}
                                {method === 'crypto' && (
                                    <div className="space-y-4">
                                        {/* Coin selector */}
                                        <div>
                                            <label className={labelCls}>Select Coin &amp; Network</label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {cryptoOptions.map((coin) => (
                                                    <button
                                                        key={coin.id}
                                                        onClick={() => setSelectedCoin(coin)}
                                                        className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl ring-1 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${selectedCoin.id === coin.id
                                                            ? 'ring-[#ff7a1a]/50 bg-[#ff7a1a]/15'
                                                            : 'ring-white/[0.06] bg-white/[0.04] hover:bg-white/[0.08]'
                                                            }`}
                                                    >
                                                        <span className="text-lg font-bold" style={{ color: coin.color }}>{coin.icon}</span>
                                                        <span className="text-[10px] font-bold text-white">{coin.label}</span>
                                                        <span className="text-[8px] text-gray-500 bg-white/[0.04] px-1 rounded">{coin.network}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Wallet address */}
                                        <div>
                                            <label className={labelCls}>{selectedCoin.label} Wallet Address ({selectedCoin.network})</label>
                                            <input
                                                type="text"
                                                value={walletAddress}
                                                onChange={(e) => setWalletAddress(e.target.value)}
                                                placeholder={`Enter your ${selectedCoin.label} address`}
                                                className={`${fieldCls} font-mono text-xs`}
                                            />
                                        </div>

                                        {/* Warning */}
                                        <div className="flex items-start gap-2.5 p-3 bg-warning-alpha-08 border border-orange-500/20 rounded-xl">
                                            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-warning/70 leading-relaxed">
                                                Double-check the address and network. Sending to a wrong address results in
                                                <span className="font-bold text-warning text-xs"> permanent loss</span>. Withdrawals are processed manually within 1–24 hrs.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Error / Success message */}
                                {message && (
                                    <div className={`flex items-start gap-2.5 p-3 rounded-xl text-xs border ${message.type === 'error'
                                        ? 'bg-danger-alpha-08 border-danger/20 text-danger'
                                        : 'bg-success-alpha-10 border-success-primary/20 text-success-bright'
                                        }`}>
                                        {message.type === 'error'
                                            ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                            : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                        }
                                        <span>{message.text}</span>
                                    </div>
                                )}

                                {/* ── Active Bonus Forfeiture Warning ──────────── */}
                                {hasAnyBonus && (
                                    <div className="space-y-2.5 p-3.5 bg-danger-alpha-08 border border-danger/30 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-danger-alpha-10 flex items-center justify-center shrink-0">
                                                <AlertCircle className="w-3.5 h-3.5 text-danger" />
                                            </div>
                                            <p className="text-xs font-bold text-danger">⚠️ Withdrawing will forfeit your active bonuses</p>
                                        </div>
                                        <div className="space-y-1">
                                            {hasFiatBonus && (
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-white/50">🎰 Casino Bonus + ⚽ Sports Bonus</span>
                                                    <span className="font-bold text-danger">
                                                        {fiatSymbol}{fmt(casinoBonus ?? 0)} + {fiatSymbol}{fmt(sportsBonus ?? 0)}
                                                    </span>
                                                </div>
                                            )}
                                            {hasCryptoBonus && (
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-white/50">₿ Crypto Bonus</span>
                                                    <span className="font-bold text-danger">${fmt(cryptoBonus ?? 0)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-danger/60 leading-relaxed">
                                            Once you withdraw, all active casino, sports, and crypto bonuses and wagering progress will be permanently cleared.
                                        </p>
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={bonusForfeitConfirmed}
                                                onChange={e => setBonusForfeitConfirmed(e.target.checked)}
                                                className="w-4 h-4 accent-danger-primary rounded"
                                            />
                                            <span className="text-[11px] font-semibold text-danger">
                                                I understand I will lose all my bonuses
                                            </span>
                                        </label>
                                    </div>
                                )}

                                {/* ── Wagering block banner ─────────────────────────── */}
                                {wageringBlocked && (
                                    <div className="space-y-2.5 p-3.5 bg-warning-alpha-08 border border-warning/25 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-warning-alpha-12 flex items-center justify-center shrink-0">
                                                <Lock className="w-3.5 h-3.5 text-warning-bright" />
                                            </div>
                                            <p className="text-xs font-bold text-warning-bright">Withdrawal Locked — Complete Wagering</p>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="space-y-1">
                                            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: `${wageringPct}%`, background: 'linear-gradient(90deg, #ff7a1a, #f97316)' }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[9px] text-white/25">
                                                <span>{fiatSymbol}{fmt(wageringDone)} wagered</span>
                                                <span>{wageringPct}% — {fiatSymbol}{fmt(wageringRequired)} required</span>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-1.5">
                                            <Zap className="w-3 h-3 text-warning-bright shrink-0 mt-0.5" />
                                            <p className="text-[11px] text-warning-bright/70">
                                                Bet <span className="font-bold text-warning-bright">{fiatSymbol}{fmt(wageringRemaining)}</span> more on Sports or Casino to unlock.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* CTA */}
                                {availableMethods.length > 0 && (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading || !amount || hasValidationError || wageringBlocked || (hasAnyBonus && !bonusForfeitConfirmed)}
                                        className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                                        style={{
                                            background: loading || !amount || hasValidationError || wageringBlocked || (hasAnyBonus && !bonusForfeitConfirmed)
                                                ? 'var(--brand-alpha-40)'
                                                : 'linear-gradient(135deg,#ff9a3d,#ff6a00)',
                                            boxShadow: loading || !amount || hasValidationError || wageringBlocked || (hasAnyBonus && !bonusForfeitConfirmed) ? 'none' : '0 8px 24px -8px rgba(255,106,0,0.7)',
                                        }}
                                    >
                                        {loading
                                            ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                                            : wageringBlocked
                                                ? <><Lock className="w-4 h-4" />Complete Wagering to Withdraw</>
                                                : hasAnyBonus && !bonusForfeitConfirmed
                                                    ? <><AlertCircle className="w-4 h-4" />Confirm Bonus Forfeiture Above</>
                                                    : <><ArrowDownLeft className="w-4 h-4" />Request Withdrawal</>
                                        }
                                    </button>
                                )}

                                <p className="text-[9px] text-gray-600 text-center">
                                    By withdrawing you agree to our Terms of Service &amp; Withdrawal Policy.
                                    Minimum withdrawal {isCrypto ? '$' : fiatSymbol}{fmt(activeMin)}.
                                </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default WithdrawModal;
