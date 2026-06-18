"use client";

import React from 'react';
import Link from 'next/link';
import { Clock, Gift, ArrowRight, Percent, Star } from 'lucide-react';
import { Promotion } from '@/services/promotions';

interface PromotionCardProps {
    promo: Promotion;
}

const CATEGORY_STYLE: Record<string, { color: string; bg: string }> = {
    CASINO: { color: 'text-purple-300', bg: 'bg-purple-500/15' },
    SPORTS: { color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
    LIVE: { color: 'text-red-300', bg: 'bg-red-500/15' },
    VIP: { color: 'text-amber-300', bg: 'bg-amber-500/15' },
    ALL: { color: 'text-white/70', bg: 'bg-white/[0.06]' },
};

export default function PromotionCard({ promo }: PromotionCardProps) {
    const cat = CATEGORY_STYLE[promo.category || 'ALL'] || CATEGORY_STYLE.ALL;

    const daysLeft = promo.expiryDate
        ? Math.max(0, Math.ceil((new Date(promo.expiryDate).getTime() - Date.now()) / 86400000))
        : null;
    const isExpired = daysLeft !== null && daysLeft <= 0;

    const claimProgress = promo.claimLimit
        ? Math.min(100, Math.round(((promo.claimCount || 0) / promo.claimLimit) * 100))
        : null;

    return (
        <Link
            href={`/promotions/${promo._id}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1d22] transition-all duration-200 hover:border-brand-gold/25 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] active:scale-[0.99]"
        >
            {/* Banner */}
            <div className="relative h-[160px] overflow-hidden">
                {promo.bgImage ? (
                    <img
                        src={promo.bgImage}
                        alt={promo.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div
                        className="h-full w-full"
                        style={{ background: promo.gradient || 'linear-gradient(135deg, #1f2330 0%, #2a2030 50%, #1a1520 100%)' }}
                    />
                )}

                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1d22] via-black/20 to-transparent" />

                {/* Top-left badges */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    {promo.category && (
                        <span className={`px-2.5 py-1 rounded-full ${cat.bg} ${cat.color} text-[10px] font-bold uppercase backdrop-blur-md`}>
                            {promo.category}
                        </span>
                    )}
                    {promo.badgeLabel && (
                        <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-bold border border-white/[0.08]">
                            {promo.badgeLabel}
                        </span>
                    )}
                </div>

                {/* Featured star */}
                {promo.isFeatured && (
                    <div className="absolute top-3 right-3">
                        <Star size={14} className="text-brand-gold fill-brand-gold drop-shadow-lg" />
                    </div>
                )}

                {/* Bonus overlay */}
                {promo.bonusPercentage && promo.bonusPercentage > 0 && (
                    <div className="absolute bottom-3 left-3">
                        <span className="text-4xl font-black text-white/90 drop-shadow-lg leading-none">
                            +{promo.bonusPercentage}%
                        </span>
                    </div>
                )}

                {/* Character image */}
                {promo.charImage && (
                    <img
                        src={promo.charImage}
                        alt=""
                        className="absolute bottom-0 right-2 h-[85%] object-contain pointer-events-none opacity-90"
                    />
                )}
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 p-4 gap-3">
                {/* Title + subtitle */}
                <div>
                    <h3 className="text-[15px] font-bold text-white leading-snug line-clamp-2 group-hover:text-brand-gold transition-colors">
                        {promo.title}
                    </h3>
                    {promo.subtitle && (
                        <p className="text-[12px] text-white/40 mt-1 line-clamp-1">{promo.subtitle}</p>
                    )}
                </div>

                {/* Quick info chips */}
                <div className="flex flex-wrap gap-1.5">
                    {promo.maxBonus && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-white/60">
                            <Gift size={10} className="text-brand-gold" />
                            Up to ${promo.maxBonus.toLocaleString()}
                        </span>
                    )}
                    {promo.wageringMultiplier && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-white/60">
                            <Percent size={10} className="text-white/40" />
                            {promo.wageringMultiplier}× wager
                        </span>
                    )}
                </div>

                {/* Claim progress */}
                {claimProgress !== null && promo.claimLimit && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="text-white/30">Claims</span>
                            <span className="text-white/50 font-bold">{promo.claimCount || 0}/{promo.claimLimit}</span>
                        </div>
                        <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                            <div className="h-full bg-brand-gold rounded-full" style={{ width: `${claimProgress}%` }} />
                        </div>
                    </div>
                )}

                {/* Bottom row: expiry + CTA */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/[0.04]">
                    {daysLeft !== null ? (
                        <span className={`flex items-center gap-1 text-[11px] font-semibold ${isExpired ? 'text-danger' : daysLeft <= 3 ? 'text-amber-400' : 'text-white/40'}`}>
                            <Clock size={11} />
                            {isExpired ? 'Expired' : `${daysLeft}d left`}
                        </span>
                    ) : (
                        <span className="text-[11px] text-white/30">No expiry</span>
                    )}

                    <span className="flex items-center gap-1 text-[11px] font-bold text-brand-gold group-hover:gap-2 transition-all">
                        View Details <ArrowRight size={12} />
                    </span>
                </div>
            </div>
        </Link>
    );
}
