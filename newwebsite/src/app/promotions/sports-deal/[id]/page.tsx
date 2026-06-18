"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import Footer from '@/components/layout/Footer';
import { promotionApi, PromoTeamDeal } from '@/services/promotions';
import {
    ArrowLeft, Trophy, Calendar, ShieldCheck, Radio, ArrowRight,
    Zap, Target, Clock, Wallet, AlertTriangle, CheckCircle2,
} from 'lucide-react';

function DetailRow({ icon: Icon, label, value, accent }: {
    icon: React.ElementType; label: string; value: React.ReactNode; accent?: string;
}) {
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-white/[0.04] last:border-0">
            <div className="flex items-center gap-2.5 text-white/50">
                <Icon size={14} />
                <span className="text-[13px]">{label}</span>
            </div>
            <div className={`text-[13px] font-bold ${accent || 'text-white'}`}>{value}</div>
        </div>
    );
}

export default function SportsDealDetailPage() {
    const params = useParams();
    const router = useRouter();
    const dealId = params.id as string;

    const [deal, setDeal] = useState<PromoTeamDeal | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        promotionApi.getPromoTeamDeals().then((all) => {
            const found = all.find(d => d._id === dealId);
            setDeal(found || null);
        }).catch(() => {}).finally(() => setLoading(false));
    }, [dealId]);

    if (loading) {
        return (
            <div className="h-screen overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)] flex flex-col">
                <Header />
                <div className="flex flex-1 overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
                    <LeftSidebar />
                    <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto flex items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/[0.06] border-t-brand-gold" />
                    </main>
                </div>
            </div>
        );
    }

    if (!deal) {
        return (
            <div className="h-screen overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)] flex flex-col">
                <Header />
                <div className="flex flex-1 overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
                    <LeftSidebar />
                    <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto flex flex-col items-center justify-center gap-4">
                        <p className="text-text-muted text-lg">Deal not found</p>
                        <button onClick={() => router.push('/promotions')}
                            className="px-6 py-2.5 bg-brand-gold text-white rounded-xl font-bold text-sm">
                            Back to Promotions
                        </button>
                    </main>
                </div>
            </div>
        );
    }

    const isTriggerPromo = deal.promotionType === 'FIRST_OVER_SIX_CASHBACK';
    const isPayoutPromo = deal.benefitType === 'PAYOUT_AS_WIN';
    const sportUrl = `/sports/match/${deal.eventId}`;

    const gradient = deal.cardGradient ||
        'linear-gradient(135deg, rgba(16,185,129,0.7), rgba(6,78,59,0.3))';

    const title = deal.cardTitle ||
        (deal.promotionType === 'FIRST_OVER_SIX_CASHBACK'
            ? `${deal.refundPercentage}% back if your pre-match team hits a 6 in first ${deal.triggerConfig?.oversWindow || 1} over`
            : deal.promotionType === 'LEAD_MARGIN_PAYOUT'
                ? `Paid as winner if your team leads big`
                : deal.promotionType === 'LATE_LEAD_REFUND'
                    ? `Bad Beat refund if your team leads late`
                    : deal.promotionType === 'PERIOD_LEAD_PAYOUT'
                        ? `Paid as winner if your team leads at the break`
                        : `Get ${deal.refundPercentage}% Back on Any Loss`);

    const description = deal.cardDescription ||
        (deal.promotionType === 'FIRST_OVER_SIX_CASHBACK'
            ? `Place a pre-match Match Odds bet on ${deal.eventName}. If your selected team hits a six in the first ${deal.triggerConfig?.oversWindow || 1} over but still loses, get ${deal.refundPercentage}% refunded to the ${deal.walletTarget === 'bonus_wallet' ? 'bonus' : deal.walletTarget === 'crypto' ? 'crypto' : 'main'} wallet.`
            : deal.promotionType === 'LEAD_MARGIN_PAYOUT'
                ? `If your selected team goes ${deal.triggerConfig?.leadThreshold || 2}+ ahead but still fails to win, the bet can still be paid like a winner.`
                : deal.promotionType === 'LATE_LEAD_REFUND'
                    ? `If your selected team is still leading at ${deal.triggerConfig?.minuteThreshold || 80}' but does not win, the losing bet can be refunded.`
                    : deal.promotionType === 'PERIOD_LEAD_PAYOUT'
                        ? `If your selected team leads at ${(deal.triggerConfig?.periodLabel || 'HALF_TIME').toLowerCase().replace(/_/g, ' ')} but does not win, the bet can still be paid like a winner.`
                        : `Bet on ${deal.eventName} and get ${deal.refundPercentage}% of your stake refunded if you lose. Offer applies to all teams.`);

    const badge = deal.cardBadge || (
        deal.promotionType === 'FIRST_OVER_SIX_CASHBACK' ? 'TRIGGER PROMO'
            : deal.promotionType === 'LEAD_MARGIN_PAYOUT' ? 'EARLY PAYOUT'
                : deal.promotionType === 'LATE_LEAD_REFUND' ? 'BAD BEAT'
                    : deal.promotionType === 'PERIOD_LEAD_PAYOUT' ? 'PERIOD PAYOUT'
                        : 'SPORTS PROMO');

    const matchDate = deal.matchDate
        ? new Date(deal.matchDate).toLocaleString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit',
        })
        : null;

    const walletLabel = deal.walletTarget === 'bonus_wallet' ? 'Bonus wallet'
        : deal.walletTarget === 'crypto' ? 'Crypto wallet'
            : 'Main wallet';

    const conditionText = deal.conditionSummary ||
        (isTriggerPromo
            ? `If your selected pre-match Match Odds team hits a six in the first ${deal.triggerConfig?.oversWindow || 1} over but still loses, the losing bet qualifies for cashback.`
            : deal.promotionType === 'LEAD_MARGIN_PAYOUT'
                ? `If your team leads by ${deal.triggerConfig?.leadThreshold || 2}+ goals/runs but still doesn't win, the bet qualifies.`
                : deal.promotionType === 'LATE_LEAD_REFUND'
                    ? `If your team is leading at ${deal.triggerConfig?.minuteThreshold || 80}' but doesn't win, the bet qualifies for refund.`
                    : deal.promotionType === 'PERIOD_LEAD_PAYOUT'
                        ? `If your team leads at ${(deal.triggerConfig?.periodLabel || 'HALF_TIME').toLowerCase().replace(/_/g, ' ')} but doesn't win, the bet qualifies.`
                        : 'Your losing bet qualifies for cashback based on the promo conditions.');

    const triggerLabel = isTriggerPromo
        ? deal.triggerConfig?.isTriggered
            ? `Triggered for ${(deal.triggerConfig?.qualifyingSelections || []).join(', ')}`
            : `Waiting for selected pre-match team to hit a 6 in first ${deal.triggerConfig?.oversWindow || 1} over${(deal.triggerConfig?.oversWindow || 1) > 1 ? 's' : ''}`
        : deal.promotionType === 'LEAD_MARGIN_PAYOUT'
            ? deal.triggerConfig?.isTriggered
                ? `Triggered for ${(deal.triggerConfig?.qualifyingSelections || []).join(', ')}`
                : `Waiting for ${deal.triggerConfig?.leadThreshold || 2}+ lead trigger`
            : deal.promotionType === 'LATE_LEAD_REFUND'
                ? deal.triggerConfig?.isTriggered
                    ? `Triggered for ${(deal.triggerConfig?.qualifyingSelections || []).join(', ')}`
                    : `Waiting for ${deal.triggerConfig?.minuteThreshold || 80}' lead trigger`
                : deal.promotionType === 'PERIOD_LEAD_PAYOUT'
                    ? deal.triggerConfig?.isTriggered
                        ? `Triggered for ${(deal.triggerConfig?.qualifyingSelections || []).join(', ')}`
                        : `Waiting for ${(deal.triggerConfig?.periodLabel || 'HALF_TIME').toLowerCase().replace(/_/g, ' ')} lead`
                    : null;

    return (
        <div className="h-screen overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)] flex flex-col">
            <Header />
            <div className="flex flex-1 overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
                <LeftSidebar />
                <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto overflow-x-hidden">
                    <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 space-y-6">
                        {/* Back */}
                        <button onClick={() => router.back()}
                            className="flex items-center gap-2 text-text-muted hover:text-white text-sm transition-colors">
                            <ArrowLeft size={16} /> Back to Promotions
                        </button>

                        {/* Hero Banner */}
                        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] h-[200px] md:h-[260px]"
                            style={{ background: gradient }}>
                            {deal.cardBgImage && (
                                <img src={deal.cardBgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                            {/* Top badges */}
                            <div className="absolute top-4 left-4 flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-wider border border-white/10">
                                    {badge}
                                </span>
                            </div>

                            {/* Refund percentage */}
                            <div className="absolute top-4 right-4 text-right">
                                <div className="text-5xl md:text-6xl font-black text-white/90 drop-shadow-lg leading-none">
                                    {deal.refundPercentage}%
                                </div>
                                <div className="text-xs text-white/60 font-semibold mt-1">
                                    {isPayoutPromo ? 'winner credit' : 'refund'}
                                </div>
                            </div>

                            {/* Bottom title */}
                            <div className="absolute bottom-4 left-4 right-4">
                                <h1 className="text-xl md:text-2xl font-black text-white leading-tight drop-shadow-md">
                                    {title}
                                </h1>
                            </div>
                        </div>

                        {/* Match Info Card */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
                            <div className="flex items-center gap-2.5">
                                <Trophy size={16} className="text-warning-bright" />
                                <span className="text-sm font-bold text-white">{deal.eventName}</span>
                            </div>

                            {matchDate && (
                                <div className="flex items-center gap-2.5 text-text-muted text-sm">
                                    <Calendar size={14} />
                                    <span>{matchDate}</span>
                                </div>
                            )}

                            {/* Teams */}
                            {deal.teams && deal.teams.length > 0 && (
                                <div className="flex flex-col sm:flex-row items-center gap-3 py-4">
                                    {deal.teams.map((team, i) => (
                                        <React.Fragment key={i}>
                                            {i > 0 && (
                                                <span className="text-xs font-bold text-text-muted uppercase">vs</span>
                                            )}
                                            <div className="flex-1 w-full sm:w-auto">
                                                <div className="bg-bg-elevated border border-white/[0.06] rounded-xl px-4 py-3 text-center">
                                                    <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-2">
                                                        <Trophy size={16} className="text-brand-gold" />
                                                    </div>
                                                    <span className="text-sm font-bold text-white">{team}</span>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Zap size={14} className="text-brand-gold" /> How It Works
                            </h3>
                            <p className="text-[14px] text-white/60 leading-relaxed">{description}</p>
                        </div>

                        {/* Condition Summary */}
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5 space-y-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <AlertTriangle size={14} className="text-warning-bright" /> Qualifying Condition
                            </h3>
                            <p className="text-[13px] text-amber-100/80 leading-relaxed">{conditionText}</p>
                        </div>

                        {/* Trigger Status */}
                        {triggerLabel && (
                            <div className={`rounded-xl border p-5 flex items-center gap-3 ${deal.triggerConfig?.isTriggered
                                ? 'border-success-primary/20 bg-success-alpha-10'
                                : 'border-sky-500/20 bg-sky-500/[0.04]'
                                }`}>
                                {deal.triggerConfig?.isTriggered
                                    ? <CheckCircle2 size={18} className="text-success-bright flex-shrink-0" />
                                    : <Radio size={18} className="text-sky-400 flex-shrink-0 animate-pulse" />
                                }
                                <div>
                                    <div className={`text-sm font-bold ${deal.triggerConfig?.isTriggered ? 'text-success-bright' : 'text-sky-300'}`}>
                                        {deal.triggerConfig?.isTriggered ? 'Trigger Activated' : 'Trigger Pending'}
                                    </div>
                                    <div className={`text-xs mt-0.5 ${deal.triggerConfig?.isTriggered ? 'text-success-bright/70' : 'text-sky-300/70'}`}>
                                        {triggerLabel}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Offer Details Grid */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                            <div className="px-5 py-3 border-b border-white/[0.06]">
                                <h3 className="text-sm font-bold text-white">Offer Details</h3>
                            </div>
                            <div className="px-5">
                                <DetailRow
                                    icon={Target}
                                    label="Promo Type"
                                    value={badge}
                                    accent="text-success-bright"
                                />
                                <DetailRow
                                    icon={Zap}
                                    label="Refund / Payout"
                                    value={`${deal.refundPercentage}% ${isPayoutPromo ? 'winner payout' : 'stake back'}`}
                                    accent="text-brand-gold"
                                />
                                <DetailRow
                                    icon={Wallet}
                                    label="Credit To"
                                    value={walletLabel}
                                    accent={deal.walletTarget === 'bonus_wallet' ? 'text-accent-purple' : deal.walletTarget === 'crypto' ? 'text-warning-bright' : 'text-brand-gold'}
                                />
                                {matchDate && (
                                    <DetailRow
                                        icon={Clock}
                                        label="Match Time"
                                        value={matchDate}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Refund Guarantee */}
                        <div className="rounded-xl border border-success-primary/20 bg-success-alpha-10 p-5 flex items-start gap-3">
                            <ShieldCheck size={20} className="text-success-bright flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="text-sm font-bold text-success-bright">
                                    {isPayoutPromo
                                        ? `${deal.refundPercentage}% winner payout when trigger hits and the bet still loses`
                                        : `${deal.refundPercentage}% stake back ${isTriggerPromo ? 'when trigger hits and bet loses' : 'on any losing bet'}`}
                                </div>
                                <div className="text-xs text-text-muted mt-1">
                                    Credited to your <span className={`font-semibold ${deal.walletTarget === 'bonus_wallet' ? 'text-accent-purple' : deal.walletTarget === 'crypto' ? 'text-warning-bright' : 'text-brand-gold'}`}>{walletLabel}</span>
                                </div>
                            </div>
                        </div>

                        {/* CTA */}
                        <Link href={sportUrl}
                            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-black text-base text-white uppercase tracking-wider transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
                            style={{ background: gradient, boxShadow: '0 8px 32px -8px rgba(16,185,129,0.3)' }}>
                            <span>Bet Now</span>
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                    <Footer />
                </main>
            </div>
        </div>
    );
}

