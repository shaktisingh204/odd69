"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import Footer from '@/components/layout/Footer';
import PromotionCard from '@/components/promotions/PromotionCard';
import BonusConditionCard from '@/components/promotions/BonusConditionCard';
import PromoTeamCard from '@/components/promotions/PromoTeamCard';
import { promotionApi, Promotion, BonusPromotion, PromoTeamDeal } from '@/services/promotions';
import { Zap, Trophy, Gamepad2, Radio, Crown, LayoutGrid, ShieldCheck, Search, Gift, Sparkles, TrendingUp, Star, Clock, Users } from 'lucide-react';

const CATEGORIES = [
    { id: 'ALL', label: 'All Promos', icon: LayoutGrid },
    { id: 'CASINO', label: 'Casino', icon: Gamepad2 },
    { id: 'SPORTS', label: 'Sports', icon: Zap },
    { id: 'LIVE', label: 'Live', icon: Radio },
    { id: 'VIP', label: 'VIP', icon: Crown },
];

function PromotionsContent() {
    const [promos, setPromos] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [bonusConditions, setBonusConditions] = useState<BonusPromotion[]>([]);
    const [bonusLoading, setBonusLoading] = useState(true);
    const [promoDeals, setPromoDeals] = useState<PromoTeamDeal[]>([]);
    const [promoDealsLoading, setPromoDealsLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            promotionApi.getAll().then(setPromos).catch(() => {}),
            promotionApi.getBonusConditions().then(setBonusConditions).catch(() => {}),
            promotionApi.getPromoTeamDeals().then(setPromoDeals).catch(() => {}),
        ]).finally(() => {
            setLoading(false);
            setBonusLoading(false);
            setPromoDealsLoading(false);
        });
    }, []);

    const featured = promos.filter(p => p.isFeatured);

    const filtered = promos.filter(p => {
        const matchCat = activeCategory === 'ALL' || (p.category || 'ALL') === activeCategory;
        const matchSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase())
            || p.promoCode?.toLowerCase().includes(searchQuery.toLowerCase())
            || p.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    const filteredPromoDeals = activeCategory === 'ALL' || activeCategory === 'SPORTS' ? promoDeals : [];
    const filteredBonus = activeCategory === 'ALL'
        ? bonusConditions
        : bonusConditions.filter(b => b.applicableTo === activeCategory || b.applicableTo === 'BOTH');

    const hasAnyContent = filtered.length > 0 || filteredPromoDeals.length > 0 || filteredBonus.length > 0;

    // Stats
    const totalActive = promos.length;
    const expiringCount = promos.filter(p => {
        if (!p.expiryDate) return false;
        const d = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
        return d > 0 && d <= 7;
    }).length;

    return (
        <div className="h-screen overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)] flex flex-col">
            <Header />

            <div className="flex flex-1 overflow-hidden pt-[100px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
                <LeftSidebar />

                <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto overflow-x-hidden w-full xl:max-w-[calc(100%-240px)] flex flex-col">

                    {/* Hero */}
                    <div className="relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255, 122, 26,0.025),_transparent_60%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(123,92,214,0.08),_transparent_60%)]" />
                        <div className="absolute -right-20 top-10 w-60 h-60 rounded-full bg-brand-gold/5 blur-3xl pointer-events-none" />

                        <div className="relative px-4 md:px-6 lg:px-8 pt-4 pb-4 md:pt-6 md:pb-6">
                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                                <div>
                                    <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/30 rounded-full px-3 py-1 mb-3 backdrop-blur-md">
                                        <Gift size={12} className="text-brand-gold" />
                                        <span className="text-brand-gold text-[10px] font-bold uppercase tracking-widest">Offers & Rewards</span>
                                    </div>
                                    <h1 className="text-3xl md:text-4xl font-black text-text-primary leading-tight">Promotions</h1>
                                    <p className="text-text-secondary text-sm mt-1 max-w-lg">Discover exclusive bonuses, cashback offers, and VIP rewards tailored for you.</p>
                                </div>

                                {/* Quick stats */}
                                <div className="flex gap-3">
                                    <div className="bg-bg-elevated/60 backdrop-blur-md border border-white/[0.04] rounded-xl px-4 py-2.5 text-center"
                                        style={{ boxShadow: '0 4px 16px -4px rgba(0,0,0,0.2)' }}>
                                        <div className="text-lg font-black text-brand-gold">{totalActive}</div>
                                        <div className="text-[10px] text-text-muted font-bold">Active Offers</div>
                                    </div>
                                    {expiringCount > 0 && (
                                        <div className="bg-danger-alpha-10 backdrop-blur-md border border-danger/10 rounded-xl px-4 py-2.5 text-center">
                                            <div className="text-lg font-black text-danger">{expiringCount}</div>
                                            <div className="text-[10px] text-danger/60 font-bold">Expiring Soon</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-4 md:px-6 lg:px-8 flex-1 space-y-6 pb-6">

                        {/* Search + Category Tabs */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search promotions or codes..."
                                    className="w-full bg-bg-elevated border border-white/[0.04] rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-brand-gold/30 outline-none transition-colors" />
                            </div>

                            <div className="flex gap-1.5 flex-wrap">
                                {CATEGORIES.map(cat => {
                                    const Icon = cat.icon;
                                    const count = cat.id === 'ALL' ? promos.length : promos.filter(p => (p.category || 'ALL') === cat.id).length;
                                    if (count === 0 && cat.id !== 'ALL') return null;
                                    return (
                                        <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition-all duration-200 border ${activeCategory === cat.id
                                                ? 'bg-brand-gold text-text-inverse border-brand-gold'
                                                : 'bg-bg-elevated text-text-muted border-white/[0.04] hover:border-white/[0.1] hover:text-text-secondary'
                                            }`}
                                            style={activeCategory === cat.id ? { boxShadow: '0 4px 12px -2px rgba(255, 122, 26,0.05)' } : undefined}>
                                            <Icon size={13} />
                                            {cat.label}
                                            {count > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${activeCategory === cat.id ? 'bg-black/20' : 'bg-white/[0.04]'}`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Featured */}
                        {!loading && featured.length > 0 && activeCategory === 'ALL' && !searchQuery && (
                            <div>
                                <h2 className="text-xs uppercase tracking-widest text-brand-gold font-bold mb-3 flex items-center gap-2">
                                    <Star size={12} /> Featured Offers
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {featured.map((promo, i) => (
                                        <PromotionCard key={promo._id || i} promo={promo} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Main Grid */}
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="animate-pulse rounded-2xl bg-bg-elevated h-[400px] w-full border border-white/[0.04]" />
                                ))}
                            </div>
                        ) : filtered.length > 0 ? (
                            <div>
                                {activeCategory === 'ALL' && !searchQuery && (
                                    <h2 className="text-xs uppercase tracking-widest text-text-muted font-bold mb-3 flex items-center gap-2">
                                        <TrendingUp size={12} /> All Promotions
                                    </h2>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filtered.map((promo, index) => (
                                        <PromotionCard key={promo._id || index} promo={promo} />
                                    ))}
                                </div>
                            </div>
                        ) : !hasAnyContent ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-elevated rounded-2xl border border-white/[0.04]"
                                style={{ boxShadow: '0 4px 24px -8px rgba(0,0,0,0.15)' }}>
                                <div className="w-16 h-16 rounded-2xl bg-brand-gold/5 border border-brand-gold/20 flex items-center justify-center mb-4">
                                    <Trophy size={28} className="text-brand-gold opacity-40" />
                                </div>
                                <h3 className="text-xl font-bold text-text-primary mb-2">No Promotions Found</h3>
                                <p className="text-text-secondary text-sm max-w-md mx-auto">
                                    {searchQuery
                                        ? `No results for "${searchQuery}". Try a different search term.`
                                        : activeCategory !== 'ALL'
                                            ? `No ${activeCategory.toLowerCase()} promotions active right now.`
                                            : 'Check back later for new bonuses and rewards.'}
                                </p>
                                {(activeCategory !== 'ALL' || searchQuery) && (
                                    <button onClick={() => { setActiveCategory('ALL'); setSearchQuery(''); }}
                                        className="mt-4 px-6 py-2 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-xl font-bold text-sm transition-colors border border-brand-gold/30">
                                        View All Promotions
                                    </button>
                                )}
                            </div>
                        ) : null}

                        {/* Sports Promo Deals */}
                        {(promoDealsLoading || filteredPromoDeals.length > 0) && (activeCategory === 'ALL' || activeCategory === 'SPORTS') && (
                            <div>
                                <div className="mb-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-success-alpha-10 border border-success-primary/20 flex items-center justify-center flex-shrink-0"
                                        style={{ boxShadow: '0 4px 12px -2px rgba(16,185,129,0.1)' }}>
                                        <Trophy size={15} className="text-success-bright" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black text-text-primary uppercase tracking-wider">Sports Promo Deals</h2>
                                        <p className="text-[11px] text-text-muted mt-0.5">Match cashback, bad beat refunds, and early payout offers.</p>
                                    </div>
                                </div>

                                {promoDealsLoading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {[1, 2].map(i => (
                                            <div key={i} className="animate-pulse rounded-2xl bg-bg-elevated h-[340px] border border-white/[0.04]" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredPromoDeals.map((deal) => (
                                            <PromoTeamCard key={deal._id} deal={deal} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Bonus Conditions */}
                        {(bonusLoading || filteredBonus.length > 0) && (
                            <div>
                                <div className="mb-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center flex-shrink-0"
                                        style={{ boxShadow: '0 4px 12px -2px rgba(255, 122, 26,0.02)' }}>
                                        <ShieldCheck size={15} className="text-brand-gold" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black text-text-primary uppercase tracking-wider">Bonus Conditions</h2>
                                        <p className="text-[11px] text-text-muted mt-0.5">Full terms, wagering requirements, and eligibility for each active bonus.</p>
                                    </div>
                                </div>

                                {bonusLoading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="animate-pulse rounded-2xl bg-bg-elevated h-[420px] border border-white/[0.04]" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredBonus.map((bonus) => (
                                            <BonusConditionCard key={bonus._id} bonus={bonus} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <Footer />
                </main>
            </div>
        </div>
    );
}

export default function PromotionsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-bg-base flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
            </div>
        }>
            <PromotionsContent />
        </Suspense>
    );
}
