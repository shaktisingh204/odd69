"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Gift, Loader2, Plus, Timer } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import api from "@/services/api";

interface Txn { id: number; type: string; amount: number; status: string; remarks: string; createdAt: string; paymentMethod: string; }

export default function FantasyWalletPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [balance, setBalance] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [fantasyWinnings, setFantasyWinnings] = useState(0);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) router.replace("/"); }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, statsRes] = await Promise.all([api.get("/auth/profile"), api.get("/fantasy/stats").catch(() => null)]);
      if (profileRes.data) { setBalance(parseFloat(profileRes.data.balance || 0)); setTotalDeposited(parseFloat(profileRes.data.totalDeposited || 0)); }
      if (statsRes?.data) setFantasyWinnings(statsRes.data.totalWinnings || 0);
      const txnRes = await api.get("/transactions/my", { params: { limit: 20 } }).catch(() => null);
      if (txnRes?.data) {
        const all = Array.isArray(txnRes.data) ? txnRes.data : txnRes.data.transactions || [];
        setTransactions(all.filter((t: any) => t.type?.includes('FANTASY') || t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL' || t.type === 'ADMIN_DEPOSIT' || t.type === 'BONUS').slice(0, 10));
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading && user) fetchData(); }, [authLoading, user, fetchData]);

  if (authLoading || !user) return <div className="h-screen flex items-center justify-center bg-[#f5f6f8] text-gray-400 text-sm">Loading...</div>;

  return (
    <FantasyShell title="Fantasy Wallet" subtitle="Your main Zeero wallet powers fantasy" backHref="/fantasy">
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-[#d13239]" /></div>
      ) : (
        <>
          {/* Balance card — Dream11 red */}
          <div className="bg-gradient-to-br from-[#d13239] via-[#c41f2a] to-[#8f1520] rounded-2xl p-5 md:p-7 mb-4 shadow-xl shadow-[#d13239]/25 text-white relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(120deg, transparent 0 20px, rgba(255,255,255,0.9) 20px 21px)",
              }}
            />
            <div className="relative">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70 mb-1">Total Balance</p>
              <p className="text-3xl md:text-4xl font-extrabold mb-5 tracking-tight">
                ${Math.floor(balance).toLocaleString("en-US")}
                <span className="text-lg text-white/60 font-bold">.{((balance % 1) * 100).toFixed(0).padStart(2, "0")}</span>
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-3">
                  <p className="text-[9px] font-extrabold uppercase text-white/60 tracking-widest">Deposited</p>
                  <p className="text-white font-extrabold text-base mt-0.5 tracking-tight">${totalDeposited.toLocaleString("en-US")}</p>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-3">
                  <p className="text-[9px] font-extrabold uppercase text-white/60 tracking-widest">Fantasy Winnings</p>
                  <p className="text-amber-300 font-extrabold text-base mt-0.5 tracking-tight">${fantasyWinnings.toLocaleString("en-US")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link prefetch href="/deposit" className="flex items-center justify-center gap-2 rounded-xl bg-white text-[#d13239] py-3 font-extrabold text-xs transition-all hover:bg-amber-50 shadow-md uppercase tracking-wide">
                  <Plus size={16} strokeWidth={3} /> Add Cash
                </Link>
                <Link prefetch href="/withdraw" className="flex items-center justify-center gap-2 rounded-xl bg-white/15 text-white border border-white/25 py-3 font-extrabold text-xs hover:bg-white/25 transition-all uppercase tracking-wide">
                  <ArrowUpRight size={16} strokeWidth={2.75} /> Withdraw
                </Link>
              </div>
            </div>
          </div>

          {/* Info card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#fff4f4] to-red-100 border border-red-200 flex items-center justify-center text-[#d13239] shrink-0">
              <Gift size={17} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-gray-900 font-extrabold text-sm mb-0.5 tracking-tight">Same Wallet, More Fun</p>
              <p className="text-gray-500 text-[11px] font-semibold leading-relaxed">Your main Zeero wallet powers fantasy. Deposit once, play everywhere.</p>
            </div>
          </div>

          {/* Transactions */}
          <h2 className="text-gray-900 font-extrabold text-lg mb-3 tracking-tight">Recent Transactions</h2>
          {transactions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-gray-500 font-semibold text-sm">No transactions yet.</p>
            </div>
          ) : (
            <div className="space-y-1.5 pb-6">
              {transactions.map((t) => <TxnRow key={t.id} txn={t} />)}
            </div>
          )}
        </>
      )}
    </FantasyShell>
  );
}

function TxnRow({ txn }: { txn: Txn }) {
  const type = txn.type || '';
  const isEntry = type.includes('FANTASY_ENTRY');
  const isWin = type.includes('FANTASY_WINNING');
  const isDeposit = type.includes('DEPOSIT');
  const isWithdraw = type.includes('WITHDRAWAL');
  const isNeg = isEntry || isWithdraw;

  const icon = isDeposit ? <ArrowDownLeft size={15} strokeWidth={2.5} /> : isWithdraw ? <ArrowUpRight size={15} strokeWidth={2.5} /> : isWin ? <CheckCircle2 size={15} strokeWidth={2.5} /> : isEntry ? <ArrowUpRight size={15} strokeWidth={2.5} /> : <Gift size={15} strokeWidth={2.5} />;
  const iconBg = isDeposit ? "bg-green-50 text-green-600 border-green-200" : isWithdraw ? "bg-red-50 text-[#d13239] border-red-200" : isWin ? "bg-amber-50 text-amber-600 border-amber-200" : isEntry ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-purple-50 text-purple-500 border-purple-200";
  const dateStr = txn.createdAt ? new Date(txn.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const isPending = txn.status === 'PENDING';
  const amount = parseFloat(String(txn.amount)) || 0;

  return (
    <div className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-200">
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 font-extrabold text-[13px] truncate tracking-tight">{txn.remarks || type.replace(/_/g, ' ')}</p>
        <p className="text-gray-500 text-[10px] font-bold mt-0.5 flex items-center gap-1">
          {isPending && <Timer size={10} />} {dateStr} {isPending && " · Pending"}
        </p>
      </div>
      <span className={`text-[15px] font-extrabold tracking-tight ${isNeg ? "text-[#d13239]" : "text-green-600"}`}>
        {isNeg ? "-" : "+"}${Math.abs(amount).toLocaleString("en-US")}
      </span>
    </div>
  );
}
