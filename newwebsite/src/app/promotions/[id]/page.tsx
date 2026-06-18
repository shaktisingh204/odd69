"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import Footer from '@/components/layout/Footer';
import { promotionApi, Promotion } from '@/services/promotions';
import {
  ArrowLeft, Gift, Clock, Percent, Wallet, Shield, Calendar,
  Users, Copy, CheckCircle, Tag, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2.5 text-white/50">
        <Icon size={14} />
        <span className="text-[13px]">{label}</span>
      </div>
      <span className="text-[13px] font-bold text-white">{value}</span>
    </div>
  );
}

export default function PromotionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const promoId = params.id as string;

  const [promo, setPromo] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tcOpen, setTcOpen] = useState(false);

  useEffect(() => {
    promotionApi.getAll().then((all) => {
      const found = all.find(p => p._id === promoId);
      setPromo(found || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [promoId]);

  const copyCode = () => {
    if (!promo?.promoCode) return;
    navigator.clipboard.writeText(promo.promoCode);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const daysLeft = promo?.expiryDate
    ? Math.max(0, Math.ceil((new Date(promo.expiryDate).getTime() - Date.now()) / 86400000))
    : null;

  const claimProgress = promo?.claimLimit
    ? Math.min(100, Math.round(((promo.claimCount || 0) / promo.claimLimit) * 100))
    : null;

  return (
    <div className="h-screen overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)] flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden pt-[60px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar />
        <main className="flex-1 min-w-0 bg-bg-base overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/[0.06] border-t-brand-gold" />
            </div>
          ) : !promo ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
              <p className="text-text-muted text-lg">Promotion not found</p>
              <button onClick={() => router.push('/promotions')}
                className="px-6 py-2.5 bg-brand-gold text-white rounded-xl font-bold text-sm">
                Back to Promotions
              </button>
            </div>
          ) : (
            <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 space-y-6">
              {/* Back */}
              <button onClick={() => router.back()}
                className="flex items-center gap-2 text-text-muted hover:text-white text-sm transition-colors">
                <ArrowLeft size={16} /> Back to Promotions
              </button>

              {/* Hero banner */}
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] h-[200px] md:h-[260px]">
                {promo.bgImage ? (
                  <img src={promo.bgImage} alt={promo.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: promo.gradient || 'linear-gradient(135deg, #1a1d22 0%, #2a2030 100%)' }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {/* Character image */}
                {promo.charImage && (
                  <img src={promo.charImage} alt="" className="absolute bottom-0 right-4 h-[80%] object-contain pointer-events-none" />
                )}

                {/* Category + bonus */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  {promo.category && (
                    <span className="px-3 py-1 rounded-full bg-brand-gold/90 text-white text-[11px] font-bold uppercase">
                      {promo.category}
                    </span>
                  )}
                  {promo.badgeLabel && (
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-[11px] font-bold border border-white/[0.1]">
                      {promo.badgeLabel}
                    </span>
                  )}
                </div>

                {/* Bonus percentage */}
                {promo.bonusPercentage && promo.bonusPercentage > 0 && (
                  <div className="absolute bottom-4 left-4">
                    <span className="text-5xl md:text-6xl font-black text-white/90 drop-shadow-lg leading-none">
                      +{promo.bonusPercentage}%
                    </span>
                  </div>
                )}
              </div>

              {/* Title + description */}
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">{promo.title}</h1>
                {promo.subtitle && <p className="text-brand-gold font-bold text-sm">{promo.subtitle}</p>}
                {promo.description && (
                  <p className="text-white/60 text-[14px] leading-relaxed">{promo.description}</p>
                )}
              </div>

              {/* Promo code */}
              {promo.promoCode && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-gold/[0.06] border border-brand-gold/20">
                  <Tag size={16} className="text-brand-gold shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-brand-gold/60 uppercase font-bold">Promo Code</p>
                    <p className="text-lg font-black text-brand-gold tracking-widest">{promo.promoCode}</p>
                  </div>
                  <button onClick={copyCode}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-gold/15 hover:bg-brand-gold/25 rounded-lg text-brand-gold font-bold text-xs transition-colors border border-brand-gold/20">
                    {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Details card */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <h3 className="text-sm font-bold text-white">Offer Details</h3>
                </div>
                <div className="px-4">
                  <InfoRow icon={Percent} label="Bonus Percentage" value={promo.bonusPercentage ? `${promo.bonusPercentage}%` : undefined} />
                  <InfoRow icon={Gift} label="Max Bonus" value={promo.maxBonus ? `$${promo.maxBonus.toLocaleString()}` : undefined} />
                  <InfoRow icon={Wallet} label="Min Deposit" value={promo.minDeposit ? `$${promo.minDeposit.toLocaleString()}` : undefined} />
                  <InfoRow icon={Shield} label="Wagering Requirement" value={promo.wageringMultiplier ? `${promo.wageringMultiplier}×` : undefined} />
                  <InfoRow icon={Calendar} label="Validity" value={promo.validityDays ? `${promo.validityDays} days` : undefined} />
                  <InfoRow icon={Users} label="Target Audience" value={promo.targetAudience} />
                  <InfoRow icon={Clock} label="Expires" value={daysLeft !== null ? (daysLeft === 0 ? 'Today' : `${daysLeft} days left`) : undefined} />
                </div>
              </div>

              {/* Claim progress */}
              {claimProgress !== null && promo.claimLimit && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-white/50">Claims Used</span>
                    <span className="font-bold text-white">{promo.claimCount || 0} / {promo.claimLimit}</span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${claimProgress}%` }} />
                  </div>
                </div>
              )}

              {/* T&C */}
              {promo.termsAndConditions && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <button onClick={() => setTcOpen(!tcOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-white/40" />
                      <span className="text-sm font-bold text-white">Terms & Conditions</span>
                    </div>
                    {tcOpen ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
                  </button>
                  {tcOpen && (
                    <div className="px-4 pb-4 border-t border-white/[0.04]">
                      <p className="text-[12px] text-white/40 leading-relaxed whitespace-pre-line pt-3">{promo.termsAndConditions}</p>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="flex gap-3">
                {promo.buttonLink && (
                  <a href={promo.buttonLink} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-white font-black text-sm uppercase tracking-wider transition-all active:scale-[0.98]">
                    <Gift size={16} />
                    {promo.buttonText || 'Claim Now'}
                  </a>
                )}
              </div>
            </div>
          )}
          <Footer />
        </main>
      </div>
    </div>
  );
}
