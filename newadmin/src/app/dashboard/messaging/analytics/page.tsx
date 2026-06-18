"use client";

import { useState, useEffect } from "react";
import {
    BarChart2, Send, CheckCircle2, XCircle, Clock,
    TrendingUp, Users, MessageSquare, Loader2
} from "lucide-react";

interface CampaignLog {
    id: string;
    campaignName: string;
    type: string;
    templateName: string;
    segment: string;
    sentCount: number;
    failedCount: number;
    status: string;
    createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
    BULK: "Bulk",
    AUTO_WELCOME: "Welcome",
    AUTO_DEPOSIT: "Deposit",
    AUTO_WITHDRAWAL: "Withdrawal",
};

const STATUS_COLOR: Record<string, string> = {
    COMPLETED: "text-green-400 bg-green-500/10",
    RUNNING: "text-blue-400 bg-blue-500/10 animate-pulse",
    PENDING: "text-yellow-400 bg-yellow-500/10",
    FAILED: "text-red-400 bg-red-500/10",
};

export default function WhatsAppAnalyticsPage() {
    const [records, setRecords] = useState<CampaignLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchData = async (p = 1) => {
        setLoading(true);
        try {
            const res = await fetch(`/actions/whatsapp-campaigns?page=${p}&limit=15`);
            const d = await res.json();
            if (d.success) {
                setRecords(d.records);
                setTotalPages(d.pagination.totalPages);
                setTotal(d.pagination.total);
            }
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const totalSent = records.reduce((acc, r) => acc + r.sentCount, 0);
    const totalFailed = records.reduce((acc, r) => acc + r.failedCount, 0);
    const successRate = totalSent + totalFailed > 0
        ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
        : 0;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                    <BarChart2 className="text-green-500" size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">WhatsApp Campaign Analytics</h1>
                    <p className="text-sm text-slate-400">Track all sent messages and campaign performance</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Campaigns", value: total, icon: MessageSquare, color: "text-blue-400 bg-blue-500/10" },
                    { label: "Messages Sent", value: totalSent.toLocaleString(), icon: Send, color: "text-green-400 bg-green-500/10" },
                    { label: "Failed", value: totalFailed.toLocaleString(), icon: XCircle, color: "text-red-400 bg-red-500/10" },
                    { label: "Success Rate", value: `${successRate}%`, icon: TrendingUp, color: "text-yellow-400 bg-yellow-500/10" },
                ].map(s => (
                    <div key={s.label} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center gap-3">
                        <div className={`w-9 h-9 ${s.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <s.icon size={18} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">{s.label}</p>
                            <p className="text-lg font-bold text-white">{loading ? "—" : s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Records Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <Clock size={14} /> All Campaigns
                    </h2>
                    <button onClick={() => fetchData(page)} className="text-xs text-green-400 hover:text-green-300">Refresh</button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="animate-spin text-green-500" size={24} />
                    </div>
                ) : records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
                        <Send size={32} className="opacity-20" />
                        <p className="text-sm">No campaigns yet</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        {["Campaign", "Type", "Template", "Segment", "Sent", "Failed", "Status", "Date"].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {records.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3 text-white font-medium truncate max-w-[140px]">{r.campaignName}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                                                    {TYPE_LABELS[r.type] || r.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[120px]">{r.templateName}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{r.segment}</td>
                                            <td className="px-4 py-3 text-green-400 font-bold">{r.sentCount}</td>
                                            <td className="px-4 py-3 text-red-400">{r.failedCount}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] || "text-slate-400 bg-slate-700"}`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                                                {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="p-4 border-t border-slate-700 flex items-center justify-between">
                                <button onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchData(p); }} disabled={page === 1}
                                    className="text-xs text-slate-400 disabled:opacity-40 hover:text-white px-3 py-1.5 bg-slate-700 rounded-lg">← Prev</button>
                                <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                                <button onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchData(p); }} disabled={page === totalPages}
                                    className="text-xs text-slate-400 disabled:opacity-40 hover:text-white px-3 py-1.5 bg-slate-700 rounded-lg">Next →</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
