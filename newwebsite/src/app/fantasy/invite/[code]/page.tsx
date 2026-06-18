"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Shield, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import api from "@/services/api";

export default function InviteLandingPage() {
    const router = useRouter();
    const { code } = useParams<{ code: string }>();
    const { user, loading: authLoading } = useAuth();
    const [contest, setContest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!authLoading && !user) router.replace("/");
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!code) return;
        (async () => {
            setLoading(true);
            try {
                const res = await api.get(`/fantasy/private-contests/invite/${code}`);
                setContest(res.data);
            } catch (e: any) {
                setErr(e?.response?.data?.message || "Invite not found");
            } finally {
                setLoading(false);
            }
        })();
    }, [code]);

    if (authLoading || !user) return <div className="h-screen flex items-center justify-center bg-[#f5f6f8] text-gray-400 text-sm">Loading...</div>;

    return (
        <FantasyShell title="Private Contest" subtitle="Invite" backHref="/fantasy" hideSubNav>
            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#d13239]" /></div>
            ) : err ? (
                <div className="bg-white rounded-2xl p-10 text-center">
                    <Shield className="mx-auto text-gray-300 mb-3" size={40} />
                    <p className="text-gray-600 font-bold">{err}</p>
                </div>
            ) : contest && (
                <div className="space-y-4">
                    <div className="rounded-2xl bg-gradient-to-br from-[#d13239] to-[#9b1921] text-white p-6 shadow-lg">
                        <p className="text-white/70 text-[10px] uppercase tracking-widest font-bold">You've been invited to</p>
                        <p className="text-2xl font-black mt-1">{contest.title}</p>
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            <Stat v={`$${contest.entryFee}`} l="Entry" />
                            <Stat v={`$${contest.totalPrize.toLocaleString("en-US")}`} l="Prize" />
                            <Stat v={`${contest.filledSpots}/${contest.maxSpots}`} l="Filled" />
                        </div>
                    </div>
                    <Link href={`/fantasy/match/${contest.matchId}`}
                        className="block w-full bg-[#d13239] text-white font-black py-3 rounded-full hover:bg-[#b32028] text-center">
                        <Trophy className="inline mr-2" size={16} /> Build a team to join
                    </Link>
                </div>
            )}
        </FantasyShell>
    );
}

function Stat({ v, l }: { v: string; l: string }) {
    return (
        <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">{l}</p>
            <p className="text-white font-black text-sm">{v}</p>
        </div>
    );
}
