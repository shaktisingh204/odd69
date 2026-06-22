'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { getCurrencySymbol } from '@/utils/currency';
import QRCode from 'react-qr-code';
import {
    X,
    Check,
    Copy,
    Loader2,
    CheckCircle2,
    MessageCircle,
    Send,
    ShieldCheck,
    AlertCircle,
    ArrowLeft,
    Wallet,
    Sparkles,
    Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ManualConfig {
    accountId: string;
    accountTag: string;
    accountCount: number;
    upiId: string;
    qrImageUrl: string;
    whatsappNumber: string;
    telegramHandle: string;
    telegramLink: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Called when user wants to go back to UPI gateways */
    onBackToGateway: () => void;
    /** Whether to show the back button (first attempt → can go back; second+ → cannot) */
    allowBack: boolean;
}

const QUICK_AMOUNTS = ['300', '500', '1000', '2000', '5000', '10000'];
const manualDepositBonusCodeKey = 'manualDepositBonusCode';

export default function ManualDepositScreen({ isOpen, onClose, onBackToGateway, allowBack }: Props) {
    const { user } = useAuth();
    const fiatSymbol = getCurrencySymbol('USD');
    const qrRef = useRef<HTMLDivElement>(null);

    const [config, setConfig] = useState<ManualConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);

    const [amount, setAmount] = useState('');
    const [utr, setUtr] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [upiCopied, setUpiCopied] = useState(false);
    const [error, setError] = useState('');
    const [bonusCode, setBonusCode] = useState('');

    // Fetch config on mount
    useEffect(() => {
        if (!isOpen) return;
        setConfigLoading(true);
        api.get('/manual-deposit/config')
            .then(r => setConfig(r.data))
            .catch(() => {})
            .finally(() => setConfigLoading(false));

        const sessionBonus =
            typeof window !== 'undefined'
                ? window.sessionStorage.getItem(manualDepositBonusCodeKey) || ''
                : '';

        if (sessionBonus) {
            setBonusCode(sessionBonus.toUpperCase());
        } else {
            api.get('/bonus/pending')
                .then(res => setBonusCode((res.data?.bonusCode || '').toUpperCase()))
                .catch(() => setBonusCode(''));
        }
    }, [isOpen]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setAmount('');
            setUtr('');
            setSuccess(false);
            setError('');
            setUpiCopied(false);
            setBonusCode('');
            if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem(manualDepositBonusCodeKey);
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSaveQr = async () => {
        if (!config) return;
        if (config.qrImageUrl) {
            // Fetch the image and download it
            try {
                const res = await fetch(config.qrImageUrl);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'upi-qr.png';
                a.click();
                URL.revokeObjectURL(url);
            } catch {
                toast.error('Could not save QR image.');
            }
        } else {
            // SVG-based QR → canvas → PNG
            const svgEl = qrRef.current?.querySelector('svg');
            if (!svgEl) return;
            const svgData = new XMLSerializer().serializeToString(svgEl);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width || 120;
                canvas.height = img.height || 120;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = 'upi-qr.png';
                a.click();
            };
            img.src = url;
        }
        toast.success('QR saved!');
    };

    const handleCopyUpi = () => {
        if (!config?.upiId) return;
        navigator.clipboard.writeText(config.upiId);
        setUpiCopied(true);
        toast.success('UPI ID copied!');
        setTimeout(() => setUpiCopied(false), 2000);
    };

    const handleSubmit = async () => {
        setError('');
        const numAmt = parseFloat(amount);
        if (!amount || numAmt <= 0) { setError('Please enter the amount you paid.'); return; }
        if (!utr.trim()) { setError('Please enter your UTR / Transaction ID.'); return; }
        setSubmitting(true);
        try {
            await api.post('/manual-deposit/submit', {
                amount: numAmt,
                utr: utr.trim().toUpperCase(),
                accountId: config?.accountId || undefined,
                upiId: config?.upiId || undefined,
                accountTag: config?.accountTag || undefined,
                bonusCode: bonusCode || undefined,
            });
            if (bonusCode) {
                api.delete('/bonus/pending').catch(() => {});
            }
            // Pre-refresh retry state so DepositModal knows the gateway flow is unlocked
            // on the NEXT deposit attempt (backend auto-cancelled stale PENDING gateway txns)
            api.get('/manual-deposit/retry-state').catch(() => {});
            setSuccess(true);
            toast.success('Payment submitted! Approval usually within 5–15 minutes.');
        } catch (error: unknown) {
            const msg =
                typeof error === 'object' &&
                error !== null &&
                'response' in error &&
                typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
                    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Submission failed'
                    : error instanceof Error
                        ? error.message
                        : 'Submission failed';
            setError(msg);
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const waLink = config?.whatsappNumber
        ? `https://wa.me/${config.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I made a manual UPI payment of $${amount || '?'}. My UTR is: ${utr || 'PENDING'}`)}`
        : null;
    const tgLink = config?.telegramLink || (config?.telegramHandle ? `https://t.me/${config.telegramHandle}` : null);

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md" onClick={onClose} />

            {/* Sheet */}
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
                <div
                    className="pointer-events-auto w-full sm:max-w-lg flex flex-col overflow-hidden shadow-xl max-h-[95dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl"
                    style={{ background: 'linear-gradient(160deg, #0C0D12 0%, #0F1016 60%, #12141C 100%)' }}
                >
                    {/* ── HEADER ── */}
                    <div className="relative flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                        {/* Drag handle */}
                        <div className="sm:hidden absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-white/20" />

                        {allowBack ? (
                            <button
                                onClick={onBackToGateway}
                                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" /> Back
                            </button>
                        ) : (
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg,#f97316,#e85f00)' }}>
                                    <Wallet className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white leading-tight">Manual UPI Deposit</h2>
                                    <p className="text-[10px] text-gray-500">Scan · Pay · Submit UTR</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            {/* Manual badge */}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                style={{ background: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.35)', color: '#ff7a1a' }}>
                                Manual UPI
                            </span>
                            <button onClick={onClose} className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/[0.06] transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* ── BODY ── */}
                    <div className="flex-1 overflow-y-auto px-5 pb-6">
                        {success ? (
                            /* ══ SUCCESS ══ */
                            <div className="flex flex-col items-center gap-5 py-8 text-center">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full flex items-center justify-center"
                                        style={{ background: 'radial-gradient(circle,rgba(16,185,129,0.25) 0%,transparent 70%)' }}>
                                        <CheckCircle2 className="w-10 h-10 text-success-bright" />
                                    </div>
                                    <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                                        style={{ background: 'rgba(16,185,129,0.4)' }} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">Payment Submitted!</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        We&apos;ll verify your payment and credit <span className="text-white font-semibold">{fiatSymbol}{amount}</span> to your balance within 5–15 minutes.
                                    </p>
                                </div>

                                {/* Support CTA */}
                                <div className="w-full p-4 rounded-2xl border space-y-3"
                                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                                    <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest">Need faster approval?</p>
                                    <div className="flex gap-2.5">
                                        {waLink && (
                                            <a href={waLink} target="_blank" rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                                                style={{ background: 'linear-gradient(135deg,#25D366,#1aad52)', color: '#fff' }}>
                                                <MessageCircle className="w-4 h-4" /> WhatsApp
                                            </a>
                                        )}
                                        {tgLink && (
                                            <a href={tgLink} target="_blank" rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                                                style={{ background: 'linear-gradient(135deg,#229ED9,#1177aa)', color: '#fff' }}>
                                                <Send className="w-4 h-4" /> Telegram
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <button onClick={onClose}
                                    className="w-full py-3 rounded-xl text-sm font-semibold text-gray-400 hover:text-white border border-white/[0.05] hover:border-white/[0.12] transition-all">
                                    Close
                                </button>

                                <button
                                    onClick={() => {
                                        setSuccess(false);
                                        setAmount('');
                                        setUtr('');
                                        onBackToGateway();
                                    }}
                                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all border"
                                    style={{
                                        background: 'rgba(245,196,81,0.08)',
                                        borderColor: 'rgba(245,196,81,0.25)',
                                        color: '#f5c451',
                                    }}
                                >
                                    ⚡ Make Another Deposit
                                </button>
                            </div>
                        ) : (
                            /* ══ FORM ══ */
                            <div className="flex flex-col gap-5">

                                {/* ── QR + UPI section ── */}
                                <div className="rounded-2xl overflow-hidden border"
                                    style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.06) 0%,rgba(255,255,255,0.02) 100%)', borderColor: 'rgba(249,115,22,0.18)' }}>
                                    {configLoading ? (
                                        <div className="flex items-center justify-center h-40">
                                            <Loader2 className="w-6 h-6 text-warning/50 animate-spin" />
                                        </div>
                                    ) : config?.upiId ? (
                                        <div className="flex flex-col sm:flex-row items-center gap-4 p-4">
                                            {/* QR */}
                                            <div className="shrink-0 flex flex-col items-center gap-2" ref={qrRef}>
                                                <div className="p-2.5 bg-white rounded-2xl shadow-[0_0_40px_rgba(249,115,22,0.2)]">
                                                    {config.qrImageUrl ? (
                                                        <img
                                                            src={config.qrImageUrl}
                                                            alt="UPI QR Code"
                                                            width={120}
                                                            height={120}
                                                            className="rounded-xl object-contain"
                                                            style={{ width: 120, height: 120 }}
                                                        />
                                                    ) : (
                                                        <QRCode value={config.upiId} size={120} bgColor="#FFFFFF" fgColor="#0C0D12" />
                                                    )}
                                                </div>
                                                <p className="text-[9px] text-gray-500">Scan with any UPI app</p>
                                                <button
                                                    onClick={handleSaveQr}
                                                    className="flex items-center gap-1 text-[10px] font-semibold text-warning hover:text-warning-bright transition-colors px-2 py-1 rounded-lg hover:bg-warning-alpha-08"
                                                >
                                                    <Download className="w-3 h-3" /> Save QR
                                                </button>
                                            </div>

                                            {/* Divider */}
                                            <div className="hidden sm:block w-px self-stretch bg-white/[0.06]" />
                                            <div className="sm:hidden w-full h-px bg-white/[0.06]" />

                                            {/* UPI details */}
                                            <div className="flex-1 w-full flex flex-col gap-3">
                                                <div>
                                                    {config.accountTag && (
                                                        <div className="mb-2 inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                                                            style={{ background: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.35)', color: '#ff7a1a' }}>
                                                            <span className="truncate">{config.accountTag}</span>
                                                        </div>
                                                    )}
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Pay to UPI ID</p>
                                                    <div className="flex items-center gap-2 p-2.5 rounded-xl"
                                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                        <span className="flex-1 text-sm font-mono font-bold text-white truncate">{config.upiId}</span>
                                                        <button onClick={handleCopyUpi}
                                                            className="shrink-0 p-1.5 rounded-lg transition-all"
                                                            style={{ background: upiCopied ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.15)' }}>
                                                            {upiCopied
                                                                ? <Check className="w-3.5 h-3.5 text-success-bright" />
                                                                : <Copy className="w-3.5 h-3.5 text-warning" />}
                                                        </button>
                                                    </div>
                                                    {config.accountCount > 1 && (
                                                        <p className="mt-2 text-[10px] text-gray-500">
                                                            Randomly selected from {config.accountCount} configured manual UPI accounts.
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Steps */}
                                                <div className="space-y-1.5">
                                                    {[
                                                        'Open any UPI app (GPay, PhonePe, Paytm…)',
                                                        'Scan QR or enter UPI ID',
                                                        'Pay the exact amount',
                                                        'Copy UTR and submit below',
                                                    ].map((step, i) => (
                                                        <div key={i} className="flex items-start gap-2">
                                                            <span className="shrink-0 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center mt-0.5"
                                                                style={{ background: 'rgba(249,115,22,0.2)', color: '#ff7a1a' }}>{i + 1}</span>
                                                            <span className="text-[10px] text-gray-400 leading-tight">{step}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-24">
                                            <p className="text-xs text-gray-600">UPI not configured. Contact support.</p>
                                        </div>
                                    )}
                                </div>

                                {/* ── Amount input ── */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Amount You Paid</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-400 pointer-events-none">{fiatSymbol}</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                            placeholder="0"
                                            className="w-full rounded-xl py-3.5 pl-14 pr-4 text-2xl font-bold text-white placeholder-gray-700 focus:outline-none transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                            }}
                                            onFocus={e => (e.target.style.borderColor = 'rgba(249,115,22,0.6)')}
                                            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                                        />
                                    </div>
                                    {/* Quick amounts */}
                                    <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-hide">
                                        {QUICK_AMOUNTS.map(v => (
                                            <button key={v} onClick={() => setAmount(v)}
                                                className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 border"
                                                style={{
                                                    background: amount === v ? 'linear-gradient(135deg,#f97316,#e85f00)' : 'rgba(255,255,255,0.04)',
                                                    borderColor: amount === v ? 'transparent' : 'rgba(255,255,255,0.08)',
                                                    color: amount === v ? '#fff' : '#9ca3af',
                                                    boxShadow: amount === v ? '0 0 12px rgba(249,115,22,0.4)' : 'none',
                                                }}>
                                                +{v}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── UTR input ── */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                                        UTR / Transaction ID
                                    </label>
                                    <input
                                        type="text"
                                        value={utr}
                                        onChange={e => setUtr(e.target.value)}
                                        placeholder="e.g. 123456789012"
                                        className="w-full rounded-xl py-3 px-4 text-sm font-mono text-white placeholder-gray-600 focus:outline-none transition-all"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                        }}
                                        onFocus={e => (e.target.style.borderColor = 'rgba(249,115,22,0.6)')}
                                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                                    />
                                    <p className="text-[9px] text-gray-600 mt-1">Find this in your UPI app under payment history</p>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="flex items-start gap-2.5 p-3 rounded-xl text-xs border"
                                        style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }}>
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Security badge */}
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                    style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                    <ShieldCheck className="w-3.5 h-3.5 text-success-bright shrink-0" />
                                    <p className="text-[10px] text-success-bright/80">SSL encrypted · Admin-verified · Credited within 15 min</p>
                                </div>

                                {/* ── Submit ── */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || !utr.trim() || !amount}
                                    className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{
                                        background: submitting || !utr.trim() || !amount
                                            ? 'rgba(249,115,22,0.35)'
                                            : 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                                        boxShadow: submitting || !utr.trim() || !amount ? 'none' : '0 0 30px rgba(249,115,22,0.5)',
                                    }}
                                >
                                    {submitting
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                                        : <><Sparkles className="w-4 h-4" /> Submit Payment</>}
                                </button>

                                {/* ── Support buttons ── */}
                                <div className="flex flex-col gap-2.5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                                        <p className="text-[10px] text-gray-600 shrink-0">Instant approval? Contact support</p>
                                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {waLink ? (
                                            <a href={waLink} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                                                style={{ background: 'linear-gradient(135deg,rgba(37,211,102,0.18),rgba(37,211,102,0.08))', border: '1px solid rgba(37,211,102,0.3)', color: '#4ade80' }}>
                                                <MessageCircle className="w-4 h-4" /> WhatsApp
                                            </a>
                                        ) : (
                                            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold opacity-30 cursor-not-allowed"
                                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                                                <MessageCircle className="w-4 h-4" /> WhatsApp
                                            </div>
                                        )}
                                        {tgLink ? (
                                            <a href={tgLink} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                                                style={{ background: 'linear-gradient(135deg,rgba(34,158,217,0.18),rgba(34,158,217,0.08))', border: '1px solid rgba(34,158,217,0.3)', color: '#60a5fa' }}>
                                                <Send className="w-4 h-4" /> Telegram
                                            </a>
                                        ) : (
                                            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold opacity-30 cursor-not-allowed"
                                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                                                <Send className="w-4 h-4" /> Telegram
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
