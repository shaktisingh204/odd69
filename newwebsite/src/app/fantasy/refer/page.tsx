"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Gift, Loader2, Share2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import api from "@/services/api";

const HOW_IT_WORKS = [
  { step: "1", title: "Share your code", desc: "Invite friends with your unique referral code via WhatsApp, SMS or link." },
  { step: "2", title: "Friend joins & plays", desc: "They sign up with your code and enter their first paid contest." },
  { step: "3", title: "Earn $100 + 25% lifetime", desc: "Get $100 instantly plus 25% lifetime commission on their fees." },
];

export default function ReferEarnPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralStats, setReferralStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) router.replace("/"); }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    try {
      const profileRes = await api.get("/auth/profile");
      if (profileRes.data) setReferralCode(profileRes.data.referralCode || profileRes.data.username || "");
      const statsRes = await api.get("/referral/stats").catch(() => null);
      if (statsRes?.data) setReferralStats(statsRes.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading && user) fetchData(); }, [authLoading, user, fetchData]);

  const code = referralCode || user?.username || "ZEERO";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Zeero Fantasy",
          text: `Join me on Zeero Fantasy! Use code ${code} for $100 bonus.`,
          url: "https://zeero.bet/fantasy",
        });
        return;
      } catch { /* fall through */ }
    }
    await copyCode();
  };

  if (authLoading || !user) return <div className="h-screen flex items-center justify-center bg-[#f5f6f8] text-gray-400 text-sm">Loading...</div>;

  const invites = referralStats?.totalReferrals || 0;
  const joined = referralStats?.successfulReferrals || 0;
  const pending = invites - joined;
  const earned = referralStats?.totalEarned || 0;

  return (
    <FantasyShell title="Refer & Earn" subtitle="Invite friends and earn real cash" backHref="/fantasy">
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-[#d13239]" /></div>
      ) : (
        <>
          {/* Hero — Dream11 red gradient */}
          <div className="bg-gradient-to-br from-[#d13239] via-[#c41f2a] to-[#8f1520] rounded-2xl p-6 md:p-8 mb-4 shadow-xl shadow-[#d13239]/25 text-white relative overflow-hidden">
            <Gift size={200} className="absolute -right-8 -bottom-10 text-white/5" strokeWidth={1.5} />
            <div className="relative flex flex-col md:flex-row md:items-center gap-5">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 mx-auto md:mx-0">
                <Gift size={42} className="text-amber-300" strokeWidth={2} />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="font-extrabold text-2xl md:text-3xl leading-tight mb-2 tracking-tight">
                  Refer & Earn <span className="text-amber-300">$100</span>
                </h2>
                <p className="text-white/80 text-xs md:text-sm font-semibold leading-relaxed mb-4 max-w-md mx-auto md:mx-0">
                  Plus earn 25% lifetime commission on every contest fee your friends pay.
                </p>

                {/* Code box */}
                <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm p-3 flex items-center gap-3 max-w-sm mx-auto md:mx-0">
                  <div className="flex-1">
                    <p className="text-[9px] font-extrabold uppercase text-white/60 mb-0.5 tracking-widest">Your code</p>
                    <p className="font-extrabold text-xl tracking-[0.2em]">{code.toUpperCase()}</p>
                  </div>
                  <button onClick={copyCode} className="w-10 h-10 rounded-lg bg-white text-[#d13239] flex items-center justify-center hover:bg-amber-50 transition-all shadow-md" aria-label="Copy">
                    {copied ? <Check size={17} strokeWidth={3} /> : <Copy size={17} strokeWidth={2.5} />}
                  </button>
                  <button onClick={share} className="w-10 h-10 rounded-lg bg-white/15 border border-white/20 text-white flex items-center justify-center hover:bg-white/25 transition-all" aria-label="Share">
                    <Share2 size={17} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h3 className="text-gray-900 font-extrabold text-sm mb-3 tracking-tight">Your Invites</h3>
            <div className="grid grid-cols-4 gap-2">
              <StatBlock label="Invites" value={String(invites)} />
              <StatBlock label="Joined" value={String(joined)} />
              <StatBlock label="Pending" value={String(Math.max(0, pending))} />
              <StatBlock label="Earned" value={`$${earned}`} color="text-green-600" />
            </div>
          </div>

          <button onClick={share} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#d13239] hover:bg-[#a31923] text-white py-4 font-extrabold text-sm transition-all shadow-lg shadow-[#d13239]/25 mb-6 uppercase tracking-wide">
            <Share2 size={17} strokeWidth={2.75} /> Refer a Friend
          </button>

          {/* How it works */}
          <h3 className="text-gray-900 font-extrabold text-lg mb-3 tracking-tight">How does it work?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#d13239]/40 transition-all">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#fff4f4] to-red-100 border border-red-200 flex items-center justify-center mb-2.5">
                  <span className="text-[#d13239] font-extrabold text-sm">{s.step}</span>
                </div>
                <p className="text-gray-900 font-extrabold text-sm mb-0.5 tracking-tight">{s.title}</p>
                <p className="text-gray-500 text-[11px] font-semibold leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </FantasyShell>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
      <p className={`font-extrabold text-base tracking-tight ${color || "text-gray-900"}`}>{value}</p>
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
