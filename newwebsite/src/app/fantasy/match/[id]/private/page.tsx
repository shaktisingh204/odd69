"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Shield, Copy, Share2, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import FantasyShell from "@/components/fantasy/FantasyShell";
import api from "@/services/api";

export default function CreatePrivateContestPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const { user, loading: authLoading } = useAuth();

    const [title, setTitle] = useState("Friends Contest");
    const [entryFee, setEntryFee] = useState(49);
    const [maxSpots, setMaxSpots] = useState(10);
    const [totalPrize, setTotalPrize] = useState(400);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const [created, setCreated] = useState<{ _id: string; inviteCode: string } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => { if (!authLoading && !user) router.replace("/"); }, [authLoading, user, router]);

    const submit = async () => {
        setSaving(true); setErr("");
        try {
            const res = await api.post("/fantasy/private-contests", {
                matchId: Number(id),
                title, entryFee, maxSpots, totalPrize,
                prizeBreakdown: [{ rankFrom: 1, rankTo: 1, prize: totalPrize }],
            });
            setCreated(res.data);
        } catch (e: any) {
            setErr(e?.response?.data?.message || "Failed to create");
        } finally {
            setSaving(false);
        }
    };

    const inviteLink = created ? `${typeof window !== 'undefined' ? window.location.origin : ''}/fantasy/invite/${created.inviteCode}` : '';
    const copy = () => {
        if (!inviteLink) return;
        navigator.clipboard?.writeText(inviteLink);
        setCopied(true); setTimeout(() => setCopied(false), 1500);
    };
    const share = async () => {
        if (!inviteLink) return;
        if ((navigator as any).share) {
            await (navigator as any).share({ title: 'Join my fantasy contest', text: title, url: inviteLink });
        } else copy();
    };

    if (authLoading || !user) return <div className="h-screen flex items-center justify-center bg-[#f5f6f8] text-gray-400 text-sm">Loading...</div>;

    return (
        <FantasyShell title="Create Private Contest" subtitle="Invite-only, for friends" backHref={`/fantasy/match/${id}`} hideSubNav>
            {created ? (
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6 text-center shadow-lg">
                    <Shield className="mx-auto mb-2" size={40} />
                    <p className="text-white/80 text-xs uppercase tracking-widest font-bold">Invite Code</p>
                    <p className="text-4xl font-mono font-black tracking-widest mt-1">{created.inviteCode}</p>
                    <p className="text-white/70 text-xs mt-3 break-all">{inviteLink}</p>
                    <div className="flex gap-2 justify-center mt-4">
                        <button onClick={copy} className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white font-black text-sm px-4 py-2 rounded-full">
                            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button onClick={share} className="inline-flex items-center gap-1.5 bg-white text-emerald-600 font-black text-sm px-4 py-2 rounded-full">
                            <Share2 size={14} /> Share
                        </button>
                    </div>
                    <button onClick={() => router.push(`/fantasy/match/${id}`)}
                        className="mt-4 text-white/80 hover:text-white text-xs font-bold underline">
                        Back to match
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                        <F label="Contest Name">
                            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:border-[#d13239] outline-none" />
                        </F>
                        <div className="grid grid-cols-2 gap-3">
                            <F label="Entry Fee ($)">
                                <input type="number" value={entryFee} onChange={e => setEntryFee(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:border-[#d13239] outline-none" />
                            </F>
                            <F label="Spots (2-100)">
                                <input type="number" value={maxSpots} onChange={e => setMaxSpots(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:border-[#d13239] outline-none" />
                            </F>
                            <F label="Total Prize ($)">
                                <input type="number" value={totalPrize} onChange={e => setTotalPrize(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:border-[#d13239] outline-none" />
                            </F>
                        </div>
                        <p className="text-[11px] text-gray-500">
                            Max pool: <span className="font-mono font-bold">${(entryFee * maxSpots).toLocaleString("en-US")}</span>. Prize can't exceed this.
                        </p>
                        {err && <p className="text-xs text-red-500 font-bold">{err}</p>}
                    </div>
                    <button onClick={submit} disabled={saving}
                        className="w-full bg-[#d13239] text-white font-black py-3 rounded-full hover:bg-[#b32028] disabled:opacity-50 inline-flex items-center justify-center gap-2">
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        Create Contest
                    </button>
                </div>
            )}
        </FantasyShell>
    );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
