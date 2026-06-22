'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Clock, RefreshCw, ArrowRight, Headphones, Copy, Check, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/context/ModalContext';
import api from '@/services/api';

const STORAGE_KEY = 'pendingDepositWidget:v1';
const HIDDEN_KEY = 'pendingDepositWidget:hiddenTxnId';
const MARGIN = 16;
const POLL_INTERVAL = 30_000; // 30s auto-refresh

type Saved = { x: number; y: number; collapsed: boolean };

interface PendingTransaction {
    id: number;
    utr: string | null;
    amount: number;
    paymentMethod: string | null;
    createdAt: string;
}

const fmtAmount = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, '') + 'Cr';
    if (abs >= 1_00_000) return (n / 1_00_000).toFixed(2).replace(/\.?0+$/, '') + 'L';
    if (abs >= 1_000) return (n / 1_000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n));
};

const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

export default function PendingDepositWidget() {
    const { token } = useAuth();
    const { openUPIDeposit } = useModal();
    const router = useRouter();

    const ref = useRef<HTMLDivElement>(null);
    const [x, setX] = useState<number>(0);
    const [y, setY] = useState<number>(0);
    const [isMobile, setIsMobile] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [ready, setReady] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hiddenTxnId, setHiddenTxnId] = useState<number | null>(null);
    const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number; moved: boolean } | null>(null);

    const [pendingTxn, setPendingTxn] = useState<PendingTransaction | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showMore, setShowMore] = useState(false);
    const [utrInput, setUtrInput] = useState('');
    const [submittingUtr, setSubmittingUtr] = useState(false);

    // Load persisted state + detect mobile
    useEffect(() => {
        const mobile = window.innerWidth < 640;
        setIsMobile(mobile);
        try {
            const savedHidden = localStorage.getItem(HIDDEN_KEY);
            if (savedHidden) setHiddenTxnId(Number(savedHidden));
        } catch {}
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const s: Saved = JSON.parse(raw);
                if (typeof s.x === 'number') setX(s.x);
                if (typeof s.y === 'number') setY(s.y);
                if (typeof s.collapsed === 'boolean') setCollapsed(s.collapsed);
            } else {
                setX(window.innerWidth - (mobile ? 110 : 150) - MARGIN);
                setY(Math.max(MARGIN, Math.round(window.innerHeight * 0.35)));
            }
        } catch {}
        setReady(true);
        requestAnimationFrame(() => setMounted(true));
    }, []);

    const persist = useCallback(
        (next: Partial<Saved>) => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                const cur: Saved = raw ? JSON.parse(raw) : { x, y, collapsed };
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...next }));
            } catch {}
        },
        [x, y, collapsed],
    );

    // Fetch pending deposit state
    const fetchState = useCallback(async (showSpinner = false) => {
        if (!token) return;
        if (showSpinner) setRefreshing(true);
        try {
            const res = await api.get('/transactions/pending-deposit');
            const data = res.data;
            if (data.pending && data.transaction) {
                setPendingTxn(data.transaction);
                // If a new txn appears (different from hidden one), show it again
                const savedHidden = localStorage.getItem(HIDDEN_KEY);
                if (savedHidden && Number(savedHidden) !== data.transaction.id) {
                    setHiddenTxnId(null);
                    localStorage.removeItem(HIDDEN_KEY);
                }
            } else {
                setPendingTxn(null);
            }
        } catch {
            setPendingTxn(null);
        } finally {
            if (showSpinner) setRefreshing(false);
        }
    }, [token]);

    const hideWidget = useCallback(() => {
        if (!pendingTxn) return;
        setHiddenTxnId(pendingTxn.id);
        localStorage.setItem(HIDDEN_KEY, String(pendingTxn.id));
    }, [pendingTxn]);

    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    }, []);

    const submitUtr = useCallback(async () => {
        if (!utrInput.trim() || !pendingTxn) return;
        setSubmittingUtr(true);
        try {
            await api.post('/transactions/verify-utr', {
                transactionId: pendingTxn.id,
                utr: utrInput.trim(),
            });
            setUtrInput('');
            fetchState(true);
        } catch {}
        setSubmittingUtr(false);
    }, [utrInput, pendingTxn, fetchState]);

    // Initial fetch + polling
    useEffect(() => {
        if (!token) return;
        fetchState();
        const interval = setInterval(() => fetchState(), POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchState, token]);

    // Clamp on resize + detect mobile
    useEffect(() => {
        const onResize = () => {
            const el = ref.current;
            if (!el) return;
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            const maxX = window.innerWidth - w - MARGIN;
            const maxY = window.innerHeight - h - MARGIN;
            setX((prev) => Math.min(Math.max(MARGIN, prev), Math.max(MARGIN, maxX)));
            setY((prev) => Math.min(Math.max(MARGIN, prev), Math.max(MARGIN, maxY)));
            setIsMobile(window.innerWidth < 640);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Drag handlers (X + Y)
    const onPointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
        const el = ref.current;
        if (!el) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { startX: e.clientX, startY: e.clientY, startLeft: x, startTop: y, moved: false };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
        const el = ref.current;
        if (!el) return;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const maxX = window.innerWidth - w - MARGIN;
        const maxY = window.innerHeight - h - MARGIN;
        setX(Math.min(Math.max(MARGIN, d.startLeft + dx), Math.max(MARGIN, maxX)));
        setY(Math.min(Math.max(MARGIN, d.startTop + dy), Math.max(MARGIN, maxY)));
    };

    const onPointerUp = (e: React.PointerEvent) => {
        const d = dragRef.current;
        dragRef.current = null;
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
        if (d) persist({ x, y });
        if (d && !d.moved && collapsed) {
            // Clamp position for the larger expanded card
            const expandedW = isMobile ? 280 : 320;
            const expandedH = 400; // approximate max height
            const clampedX = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - expandedW - MARGIN));
            const clampedY = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - expandedH - MARGIN));
            setX(clampedX);
            setY(clampedY);
            setCollapsed(false);
            persist({ x: clampedX, y: clampedY, collapsed: false });
        }
    };

    if (!ready || !token || !pendingTxn) return null;
    if (hiddenTxnId === pendingTxn.id) return null;

    const txn = pendingTxn;

    return (
        <>
            <style jsx>{`
                @keyframes pendingSlideIn {
                    from { opacity: 0; transform: translateX(40px) scale(0.96); }
                    to { opacity: 1; transform: translateX(0) scale(1); }
                }
                @keyframes pendingPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
                    50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
                }
                @keyframes pendingFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                }
                @keyframes pendingIconGlow {
                    0%, 100% {
                        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.45), 0 0 0 0 rgba(34, 197, 94, 0.35);
                    }
                    50% {
                        box-shadow: 0 4px 16px rgba(34, 197, 94, 0.65), 0 0 0 5px rgba(34, 197, 94, 0);
                    }
                }
                @keyframes spinRefresh {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .pending-root {
                    animation: pendingSlideIn 0.45s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
                }
                .pending-card {
                    animation: pendingFloat 4.5s ease-in-out infinite;
                }
                .pending-icon {
                    animation: pendingIconGlow 2.4s ease-in-out infinite;
                }
                .pending-dot {
                    animation: pendingPulse 1.8s ease-out infinite;
                }
                .pending-close:hover {
                    transform: rotate(90deg);
                }
                .spin-refresh {
                    animation: spinRefresh 0.8s linear infinite;
                }
            `}</style>

            <div
                ref={ref}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                    position: 'fixed',
                    top: y,
                    left: x,
                    zIndex: 59,
                    touchAction: 'none',
                    userSelect: 'none',
                    cursor: dragRef.current?.moved ? 'grabbing' : 'grab',
                    opacity: mounted ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                }}
                className="pending-root select-none"
            >
                {collapsed ? (
                    isMobile ? (
                        /* Mobile collapsed: compact 50px circle */
                        <div
                            className="pending-card relative flex items-center justify-center rounded-full transition-transform hover:scale-105"
                            style={{
                                width: 50,
                                height: 50,
                                background: 'rgba(255, 255, 255, 0.10)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                boxShadow:
                                    '0 6px 20px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                            }}
                            title="Pending Deposit"
                        >
                            <div
                                className="pending-icon flex items-center justify-center rounded-full"
                                style={{
                                    width: 30,
                                    height: 30,
                                    background: 'linear-gradient(135deg, #34d399, #22c55e)',
                                    boxShadow: '0 3px 10px rgba(34, 197, 94, 0.4)',
                                }}
                            >
                                <Clock size={14} className="text-white" />
                            </div>
                            <span
                                className="pending-dot absolute rounded-full"
                                style={{ top: 2, right: 2, width: 6, height: 6, background: '#22c55e' }}
                            />
                        </div>
                    ) : (
                        /* Desktop collapsed */
                        <div
                            className="pending-card relative flex flex-col items-center justify-center rounded-2xl transition-transform hover:scale-[1.03]"
                            style={{
                                width: 104,
                                padding: '16px 12px 14px',
                                gap: 8,
                                background: 'rgba(255, 255, 255, 0.10)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                boxShadow:
                                    '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                            }}
                            title="Pending Deposit"
                        >
                            <div
                                className="pending-icon flex items-center justify-center rounded-full"
                                style={{
                                    width: 36,
                                    height: 36,
                                    background: 'linear-gradient(135deg, #34d399, #22c55e)',
                                    boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
                                }}
                            >
                                <Clock size={18} className="text-white" />
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[11px] font-semibold text-white/90 leading-tight">
                                    Deposit
                                </span>
                                <span className="text-[11px] font-semibold text-white/90 leading-tight">
                                    In progress
                                </span>
                            </div>
                            <span
                                className="pending-dot absolute rounded-full"
                                style={{ top: 6, right: 6, width: 6, height: 6, background: '#22c55e' }}
                            />
                        </div>
                    )
                ) : (
                    <div
                        className="relative rounded-2xl overflow-hidden"
                        style={{
                            width: isMobile ? Math.min(280, window.innerWidth - MARGIN * 2) : 320,
                            maxHeight: 'calc(100vh - 80px)',
                            overflowY: 'auto',
                            background: 'rgba(20, 25, 30, 0.98)',
                            border: '1px solid rgba(255, 255, 255, 0.10)',
                            boxShadow: '0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                        }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-4 py-3"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        >
                            <span className="text-[13px] font-bold text-white/90">
                                Transaction Details
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    data-nodrag
                                    onClick={() => fetchState(true)}
                                    disabled={refreshing}
                                    aria-label="Refresh"
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-50"
                                >
                                    <RefreshCw size={13} className={refreshing ? 'spin-refresh' : ''} />
                                </button>
                                <button
                                    data-nodrag
                                    onClick={() => {
                                        setCollapsed(true);
                                        persist({ collapsed: true });
                                    }}
                                    aria-label="Minimize"
                                    className="pending-close w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Amount hero */}
                        <div className={`flex flex-col items-center gap-1.5 ${isMobile ? 'pt-3 pb-2 px-3' : 'pt-5 pb-4 px-4'}`}>
                            <div
                                className={`pending-icon ${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-full flex items-center justify-center`}
                                style={{
                                    background: 'linear-gradient(135deg, #ff7a1a, #e85f00)',
                                    boxShadow: '0 4px 16px rgba(255, 122, 26, 0.35)',
                                }}
                            >
                                <span className={`text-white ${isMobile ? 'text-[15px]' : 'text-[18px]'} font-bold`}>$</span>
                            </div>
                            <span className={`${isMobile ? 'text-[20px]' : 'text-[24px]'} font-extrabold text-white tabular-nums leading-tight mt-1`}>
                                +${txn.amount.toLocaleString('en-US')} USD
                            </span>
                            <button
                                data-nodrag
                                onClick={() => copyToClipboard(
                                    `Amount: $${txn.amount}\nOrder ID: ${txn.id}\nStatus: Processing\nDate: ${new Date(txn.createdAt).toLocaleString()}`,
                                    'all'
                                )}
                                className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors mt-0.5"
                            >
                                {copiedField === 'all' ? <Check size={11} /> : <Copy size={11} />}
                                {copiedField === 'all' ? 'Copied!' : 'Copy all details'}
                            </button>
                        </div>

                        {/* Detail rows */}
                        <div
                            className="mx-4 rounded-xl overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                            {/* Status */}
                            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="text-[11px] text-white/40">Status</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="pending-dot w-1.5 h-1.5 rounded-full" style={{ background: '#ff7a1a' }} />
                                    <span className="text-[11px] font-semibold text-amber-400">Processing</span>
                                </div>
                            </div>

                            {/* Order ID */}
                            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="text-[11px] text-white/40">Order ID</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-mono text-white/70">#{txn.id}</span>
                                    <button
                                        data-nodrag
                                        onClick={() => copyToClipboard(String(txn.id), 'id')}
                                        className="text-white/30 hover:text-white/70 transition-colors"
                                    >
                                        {copiedField === 'id' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                    </button>
                                </div>
                            </div>

                            {/* Order Amount */}
                            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="text-[11px] text-white/40">Order Amount</span>
                                <span className="text-[11px] font-semibold text-white/80">${txn.amount.toLocaleString('en-US')} USD</span>
                            </div>

                            {/* Credited Amount */}
                            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="text-[11px] text-white/40">Credited Amount</span>
                                <span className="text-[11px] font-semibold text-white/50">0 USD</span>
                            </div>

                            {/* UTR / Ref */}
                            {txn.utr && (
                                <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span className="text-[11px] text-white/40">Txid</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-mono text-white/70 max-w-[140px] truncate">
                                            {txn.utr}
                                        </span>
                                        <button
                                            data-nodrag
                                            onClick={() => copyToClipboard(txn.utr!, 'utr')}
                                            className="text-white/30 hover:text-white/70 transition-colors"
                                        >
                                            {copiedField === 'utr' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Created date */}
                            <div className="flex items-center justify-between px-3 py-2.5">
                                <span className="text-[11px] text-white/40">Created on</span>
                                <span className="text-[11px] text-white/70">
                                    {new Date(txn.createdAt).toLocaleString('en-US', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        </div>

                        {/* View more toggle */}
                        {txn.paymentMethod && (
                            <button
                                data-nodrag
                                onClick={() => setShowMore(!showMore)}
                                className="flex items-center justify-center gap-1 w-full py-2 text-[11px] font-medium text-white/40 hover:text-white/60 transition-colors"
                            >
                                {showMore ? 'View less' : 'View more'}
                                {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                        )}
                        {showMore && txn.paymentMethod && (
                            <div className="mx-4 mb-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-white/40">Payment Method</span>
                                    <span className="text-[11px] text-white/70">{txn.paymentMethod}</span>
                                </div>
                            </div>
                        )}

                        {/* UTR verify section — only if no UTR yet */}
                        {!txn.utr && (
                            <div className="mx-4 mt-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-[11px] font-semibold text-white/70">Already Paid?</span>
                                    <span className="text-[10px] text-white/35">UTR/Reference No.</span>
                                </div>
                                <div
                                    className="flex items-center gap-2 rounded-lg px-3 py-2"
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                                >
                                    <input
                                        data-nodrag
                                        type="text"
                                        value={utrInput}
                                        onChange={(e) => setUtrInput(e.target.value)}
                                        placeholder="Enter UTR number to verify"
                                        className="flex-1 bg-transparent text-[11px] text-white/80 placeholder:text-white/25 outline-none"
                                    />
                                    <Lock size={12} className="text-white/20 shrink-0" />
                                </div>
                                <button
                                    data-nodrag
                                    onClick={submitUtr}
                                    disabled={!utrInput.trim() || submittingUtr}
                                    className="w-full mt-2 py-2 rounded-lg text-[12px] font-bold text-white transition-colors disabled:opacity-40"
                                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                                >
                                    {submittingUtr ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        )}

                        {/* Bottom action buttons */}
                        <div className="flex gap-2 px-4 pt-3 pb-1.5">
                            <button
                                data-nodrag
                                onClick={() => router.push('/support')}
                                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-semibold transition-colors text-white/70 hover:text-white"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                                <Headphones size={13} />
                                Contact Support
                            </button>
                            <button
                                data-nodrag
                                onClick={() => openUPIDeposit()}
                                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold transition-colors text-white"
                                style={{ background: 'linear-gradient(135deg, #ff7a1a, #e85f00)' }}
                            >
                                Retry <ArrowRight size={12} />
                            </button>
                        </div>

                        {/* Hide button */}
                        <button
                            data-nodrag
                            onClick={hideWidget}
                            className="w-full py-2 text-[10px] font-medium text-white/30 hover:text-white/60 transition-colors text-center"
                        >
                            Hide
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
