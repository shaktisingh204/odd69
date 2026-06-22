'use client';
import { useState } from 'react';
import { Bitcoin, RefreshCw, Wallet, ShieldAlert, Gift, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { useModal } from '@/context/ModalContext';
import WageringCard from './WageringCard';

export default function WalletOverview() {
    const { openDeposit, openWithdraw } = useModal();
    const {
        selectedWallet,
        setSelectedWallet,
        fiatBalance,
        fiatCurrency,
        cryptoBalance,
        exposure,
        fiatBonus,
        cryptoBonus,
        casinoBonus,
        sportsBonus,
        activeSymbol,
        refreshWallet,
        loading,
        cryptoOnly,
    } = useWallet();


    const formatINR = (amount: number) =>
        new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(amount);

    const formatUSD = (amount: number) =>
        new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

    return (
        <div className="space-y-3">

            {/* ── Wallet switcher label ── */}
            <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-white/20 uppercase tracking-wider">{cryptoOnly ? 'My Wallet' : 'My Wallets'}</h2>
                <button
                    onClick={refreshWallet}
                    className={`p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors ${loading ? 'animate-spin' : ''}`}
                    title="Refresh balances"
                >
                    <RefreshCw size={13} className="text-brand-gold" />
                </button>
            </div>

            {/* ── Fiat Wallet Card ── */}
            {!cryptoOnly && (
            <button
                onClick={() => setSelectedWallet('fiat')}
                className={`w-full text-left bg-gradient-to-br from-[#1a1d21] to-[#252830] rounded-xl p-5 border relative overflow-hidden transition-all ${selectedWallet === 'fiat'
                    ? 'border-brand-gold/50 shadow-[0_0_20px_rgba(212,175,55,0.03)]'
                    : 'border-white/[0.06] hover:border-brand-gold/20'
                    }`}
            >
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-success-vivid/5 blur-2xl" />

                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-white/40 text-xs font-semibold uppercase tracking-wider">
                        <Wallet size={13} />
                        Fiat Wallet
                    </div>
                    {selectedWallet === 'fiat' ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-brand-gold bg-brand-gold/10 border border-brand-gold/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> Active
                        </span>
                    ) : (
                        <span className="text-[10px] text-white/20 px-2 py-0.5 rounded-full border border-white/[0.04]">
                            Click to use
                        </span>
                    )}
                </div>

                <div className="text-3xl font-black text-white mb-0.5">
                    {activeSymbol}{formatINR(fiatBalance)}
                </div>
                <span className="text-xs text-white/30 font-medium">{fiatCurrency} · Fiat deposits &amp; winnings</span>

                {/* Casino Bonus chip */}
                {casinoBonus > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-accent-purple-alpha border border-accent-purple/20 text-accent-purple text-[10px] font-bold px-2 py-0.5 rounded-full mr-1.5">
                        <Gift size={10} />
                        {activeSymbol}{formatINR(casinoBonus)} Casino Bonus
                    </div>
                )}
                {/* Sports Bonus chip */}
                {sportsBonus > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-success-alpha-10 border border-success-primary/20 text-success-bright text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <Gift size={10} />
                        {activeSymbol}{formatINR(sportsBonus)} Sports Bonus
                    </div>
                )}
                {/* Legacy fiatBonus fallback (BOTH type bonuses) */}
                {fiatBonus > 0 && casinoBonus === 0 && sportsBonus === 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-warning-alpha-08 border border-amber-500/20 text-warning-bright text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <Gift size={10} />
                        {activeSymbol}{formatINR(fiatBonus)} Fiat Bonus
                    </div>
                )}

                {/* Action buttons — only show if active */}
                {selectedWallet === 'fiat' && (
                    <div className="space-y-2 mt-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2">
                            <button
                                onClick={openDeposit}
                                className="flex-1 flex items-center justify-center gap-2 bg-brand-gold hover:bg-brand-gold-hover text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
                            >
                                <ArrowDownToLine size={14} />
                                Deposit
                            </button>
                            <button
                                onClick={openWithdraw}
                                className="flex-1 flex items-center justify-center gap-2 bg-bg-surface hover:bg-bg-elevated text-white border border-white/[0.06] font-bold py-2.5 rounded-lg transition-colors text-sm"
                            >
                                <ArrowUpFromLine size={14} />
                                Withdraw
                            </button>
                        </div>
                    </div>
                )}
            </button>
            )}

            {/* ── Crypto Wallet Card ── */}
            <button
                onClick={() => setSelectedWallet('crypto')}
                className={`w-full text-left bg-gradient-to-br from-[#1a1221] to-[#1e1528] rounded-xl p-5 border relative overflow-hidden transition-all ${selectedWallet === 'crypto'
                    ? 'border-orange-500/50 shadow-[0_0_20px_rgba(255, 122, 26,0.12)]'
                    : 'border-orange-500/15 hover:border-orange-500/30'
                    }`}
            >
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent-purple-alpha blur-2xl" />

                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-accent-purple/70 text-xs font-semibold uppercase tracking-wider">
                        <Bitcoin size={13} className="text-accent-purple" />
                        Crypto Wallet
                    </div>
                    {selectedWallet === 'crypto' ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-accent-purple bg-accent-purple-alpha border border-accent-purple/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> Active
                        </span>
                    ) : (
                        <span className="text-[10px] text-white/20 px-2 py-0.5 rounded-full border border-white/[0.04]">
                            Click to use
                        </span>
                    )}
                </div>

                <div className="text-3xl font-black text-white mb-0.5">
                    ${formatUSD(cryptoBalance)}
                </div>
                <span className="text-xs text-orange-300/40 font-medium">USD · Funded by NOWPayments crypto deposits</span>

                {/* Crypto Bonus mini-chip */}
                {cryptoBonus > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-accent-purple-alpha border border-accent-purple/20 text-accent-purple text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <Gift size={10} />
                        ${formatUSD(cryptoBonus)} Crypto Bonus
                    </div>
                )}

                {/* Action buttons — only show if active */}
                {selectedWallet === 'crypto' && (
                    <div className="space-y-2 mt-4" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={openDeposit}
                            className="w-full flex items-center justify-center gap-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 font-bold py-2.5 rounded-lg transition-colors text-sm"
                        >
                            <Bitcoin size={14} />
                            Add Crypto
                        </button>
                    </div>
                )}
            </button>

            {/* ── Stats row ── */}
            <div className="bg-bg-modal rounded-xl p-4 border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-2">
                    <ShieldAlert size={12} className="text-danger" />
                    Exposure
                </div>
                <div className="text-lg font-bold text-white">
                    {activeSymbol}{formatINR(exposure || 0)}
                </div>
            </div>

            {/* ── Wagering progress (dual bars) ── */}
            <WageringCard />

            {/* Hint */}
            <p className="text-[10px] text-white/15 text-center px-2">
                Active wallet is used for bets &amp; charges across the entire platform
            </p>

        </div>
    );
}
