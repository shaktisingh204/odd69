'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onChooseDeposit: () => void;
    onChooseCrypto: () => void;
    onChooseManual: () => void;
}

export default function DepositChooserSheet({ isOpen, onClose, onChooseDeposit, onChooseCrypto, onChooseManual }: Props) {
    const { user } = useAuth();
    const [checking, setChecking] = useState(true);
    const [manualOnlyMode, setManualOnlyMode] = useState(false);
    const [allDisabled, setAllDisabled] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        // Fetch admin config to decide routing
        api.get('/settings/public')
            .then(res => {
                const d = res.data || {};
                const upi1Active = d.UPI1_ENABLED !== 'false';
                const upi2Active = d.UPI2_ENABLED !== 'false';
                const upi5Active = d.UPI5_ENABLED !== 'false';
                const cashfreeActive = d.CASHFREE_ENABLED !== 'false';
                
                const testUsernames = (d.UPI_TEST_USERNAMES || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                const isTestUser = !!user?.username && testUsernames.includes(user.username.toLowerCase());

                const upi3Active = d.UPI3_ENABLED !== 'false' && isTestUser;
                const upi4Active = d.UPI4_ENABLED !== 'false' && isTestUser;
                const upi9Active = d.UPI9_ENABLED !== 'false';
                const anyGatewayActive = upi1Active || upi2Active || upi3Active || upi4Active || upi5Active || upi9Active || cashfreeActive;
                const manualEnabled = d.MANUAL_PAYMENT_ENABLED !== 'false';

                if (anyGatewayActive) {
                    setChecking(false);
                    onChooseDeposit();
                } else if (manualEnabled) {
                    setManualOnlyMode(true);
                    setAllDisabled(false);
                    setChecking(false);
                } else {
                    // ⚠️ Everything disabled — show a friendly "unavailable" message
                    setManualOnlyMode(false);
                    setAllDisabled(true);
                    setChecking(false);
                }
            })
            .catch(() => {
                // On network error, default to UPI gateway (safest fallback)
                setChecking(false);
                onChooseDeposit();
            });
    }, [isOpen, onChooseDeposit]);

    if (!isOpen || checking) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md" onClick={onClose} />

            {/* Bottom sheet */}
            <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
                <div
                    className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.5)] border border-white/[0.05]"
                    style={{ background: 'linear-gradient(160deg, #0F1016 0%, #0C0D12 60%, #0F1016 100%)' }}
                >
                    {/* Drag handle (mobile only) */}
                    <div className="sm:hidden flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 rounded-full bg-white/15" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-3">
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {allDisabled ? 'Deposits Unavailable' : 'Add Funds'}
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {allDisabled
                                    ? 'No payment methods are currently active'
                                    : manualOnlyMode
                                        ? 'Choose crypto or manual UPI'
                                        : 'Choose how you want to deposit'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="px-5 pb-7 pt-2">
                        {manualOnlyMode ? (
                            <div className="space-y-3">
                                <button
                                    onClick={onChooseCrypto}
                                    className="w-full rounded-2xl border p-4 text-left transition-all hover:border-brand-gold/40 hover:bg-white/[0.05]"
                                    style={{
                                        background: 'rgba(245, 197, 81, 0.06)',
                                        borderColor: 'rgba(245, 197, 81, 0.18)',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">Crypto Deposit</p>
                                            <p className="mt-1 text-xs text-gray-400">
                                                Deposit with USDT, BTC, ETH, and more.
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold">
                                            Crypto
                                        </span>
                                    </div>
                                </button>

                                <button
                                    onClick={onChooseManual}
                                    className="w-full rounded-2xl border p-4 text-left transition-all hover:border-orange-400/40 hover:bg-white/[0.05]"
                                    style={{
                                        background: 'rgba(249, 115, 22, 0.06)',
                                        borderColor: 'rgba(249, 115, 22, 0.18)',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">Manual UPI</p>
                                            <p className="mt-1 text-xs text-gray-400">
                                                Scan the QR, pay manually, then submit your UTR.
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-orange-300/25 bg-warning-alpha-08 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-warning-bright">
                                            Manual
                                        </span>
                                    </div>
                                </button>
                            </div>
                        ) : (
                            <div
                                className="rounded-2xl border p-5 text-center"
                                style={{
                                    background: 'rgba(239,68,68,0.07)',
                                    borderColor: 'rgba(239,68,68,0.25)',
                                }}
                            >
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    All UPI gateways and manual deposit are currently disabled.
                                    Please check back later or contact support.
                                </p>
                            </div>
                        )}

                        <p className="text-center text-[10px] text-gray-700 mt-4">
                            All deposits are encrypted and secure.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
