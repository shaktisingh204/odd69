"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    TrendingUp, Instagram, Globe, Users, DollarSign,
    Download, RefreshCw, Calendar, BarChart2, Filter,
    ArrowUpRight, ArrowDownRight, Search, ExternalLink,
    Megaphone, Target, Zap, ChevronDown, Info,
} from "lucide-react";
import { getTrafficReport, TrafficSummary, SourceRow } from "@/actions/traffic";

// ─── Types ────────────────────────────────────────────────────────────────────
type DateRange = "7" | "30" | "90" | "custom";

// ─── Colour map for top traffic sources ───────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
    instagram: "#E1306C",
    facebook: "#1877F2",
    google: "#4285F4",
    tiktok: "#69C9D0",
    twitter: "#1DA1F2",
    youtube: "#FF0000",
    telegram: "#2CA5E0",
    whatsapp: "#25D366",
    organic: "#6366f1",
    direct: "#8b5cf6",
    referral: "#f59e0b",
};

function getSourceColor(source: string) {
    return SOURCE_COLORS[source.toLowerCase()] || "#64748b";
}

function getSourceIcon(source: string) {
    const s = source.toLowerCase();
    if (s.includes("instagram")) return "📸";
    if (s.includes("facebook")) return "👤";
    if (s.includes("google")) return "🔍";
    if (s.includes("tiktok")) return "🎵";
    if (s.includes("twitter")) return "🐦";
    if (s.includes("youtube")) return "▶️";
    if (s.includes("telegram")) return "✈️";
    if (s.includes("whatsapp")) return "💬";
    if (s === "organic") return "🌿";
    if (s === "direct") return "🔗";
    if (s === "referral") return "👥";
    return "📊";
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
    icon: Icon,
    label,
    value,
    sub,
    color,
    trend,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
    trend?: "up" | "down" | null;
}) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f1117] p-5 transition-all hover:border-white/10 hover:bg-[#131620]">
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 blur-2xl`} style={{ background: color }} />
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3">{label}</p>
                    <p className="text-3xl font-black text-white">{value}</p>
                    {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                    <Icon size={18} style={{ color }} />
                </div>
            </div>
            {trend && (
                <div className={`mt-3 flex items-center gap-1 text-xs font-semibold ${trend === "up" ? "text-emerald-400" : "text-red-400"}`}>
                    {trend === "up" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {trend === "up" ? "Increasing" : "Decreasing"}
                </div>
            )}
        </div>
    );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-white/40 text-[11px] w-8 text-right">{value}</span>
        </div>
    );
}

// ─── Timeline spark line ──────────────────────────────────────────────────────
function SparkLine({ data }: { data: { date: string; signups: number }[] }) {
    if (!data.length) return null;
    const max = Math.max(...data.map(d => d.signups), 1);
    const width = 560;
    const height = 80;
    const pts = data.map((d, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * width;
        const y = height - (d.signups / max) * (height - 10);
        return `${x},${y}`;
    });
    const areaPath = `M${pts.join("L")}L${width},${height}L0,${height}Z`;
    const linePath = `M${pts.join("L")}`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
            <defs>
                <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#spark-grad)" />
            <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => {
                const x = (i / Math.max(data.length - 1, 1)) * width;
                const y = height - (d.signups / max) * (height - 10);
                return d.signups === max ? (
                    <circle key={i} cx={x} cy={y} r="3.5" fill="#6366f1" />
                ) : null;
            })}
        </svg>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TrafficSourcesPage() {
    const [data, setData] = useState<TrafficSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>("30");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [search, setSearch] = useState("");
    const [showCustom, setShowCustom] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const filters =
            dateRange === "custom" && customStart && customEnd
                ? { startDate: customStart, endDate: customEnd }
                : { days: parseInt(dateRange) };
        const res = await getTrafficReport(filters);
        if (res.success && res.data) setData(res.data);
        setLoading(false);
    }, [dateRange, customStart, customEnd]);

    useEffect(() => { load(); }, [load]);

    const filteredRows = (data?.rows || []).filter(row =>
        !search ||
        row.source.toLowerCase().includes(search.toLowerCase()) ||
        (row.campaign || "").toLowerCase().includes(search.toLowerCase()) ||
        (row.medium || "").toLowerCase().includes(search.toLowerCase())
    );

    const maxSignups = Math.max(...filteredRows.map(r => r.signups), 1);

    const exportCSV = () => {
        if (!data?.rows?.length) return;
        const header = ["Source", "Medium", "Campaign", "Signups", "FTDs", "FTD Rate", "Revenue (₹)"];
        const rows = data.rows.map(r => [
            r.source, r.medium || "", r.campaign || "",
            r.signups, r.ftdCount, r.ftdRate, r.revenue.toFixed(2),
        ]);
        const csv = [header, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `traffic-report-${new Date().toISOString().split("T")[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-[#0a0b10] text-white">
            {/* Header glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-violet-600/8 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative px-6 py-8 max-w-[1400px] mx-auto space-y-6">

                {/* ── Page header ─────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                                <TrendingUp size={16} className="text-violet-400" />
                            </div>
                            <h1 className="text-2xl font-black text-white">Traffic Sources</h1>
                        </div>
                        <p className="text-sm text-white/40 ml-10">Track where your users are coming from — ads, organic, referrals &amp; more</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white border border-white/[0.07] hover:border-white/15 bg-white/[0.03] transition-all">
                            <Download size={13} /> Export CSV
                        </button>
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white border border-white/[0.07] hover:border-white/15 bg-white/[0.03] transition-all">
                            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
                        </button>
                    </div>
                </div>

                {/* ── Date range filter ────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-[#0f1117] border border-white/[0.06] rounded-xl p-1 gap-1">
                        {(["7", "30", "90"] as DateRange[]).map(d => (
                            <button
                                key={d}
                                onClick={() => { setDateRange(d); setShowCustom(false); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateRange === d && !showCustom
                                    ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                                    : "text-white/40 hover:text-white"
                                    }`}
                            >
                                Last {d}d
                            </button>
                        ))}
                        <button
                            onClick={() => { setShowCustom(true); setDateRange("custom"); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${showCustom
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                                : "text-white/40 hover:text-white"
                                }`}
                        >
                            <Calendar size={11} /> Custom
                        </button>
                    </div>

                    {showCustom && (
                        <div className="flex items-center gap-2">
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-[#0f1117] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-violet-500/50" />
                            <span className="text-white/30 text-xs">→</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-[#0f1117] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-violet-500/50" />
                            <button onClick={load} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-500 transition-all">Apply</button>
                        </div>
                    )}
                </div>

                {/* ── KPI cards ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Users} label="Total Signups" value={loading ? "—" : data?.totalSignups || 0} sub="via tracked links" color="#6366f1" />
                    <StatCard icon={Target} label="Paid Traffic" value={loading ? "—" : data?.paidSignups || 0} sub="from ad campaigns" color="#ec4899" trend={null} />
                    <StatCard icon={Globe} label="Organic" value={loading ? "—" : data?.organicSignups || 0} sub="direct / unattributed" color="#10b981" />
                    <StatCard icon={Megaphone} label="Top Source" value={loading ? "—" : data?.topSource || "—"} sub="most signups this period" color="#f59e0b" />
                </div>

                {/* ── Timeline chart ─────────────────────────────────────── */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#0f1117] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-bold text-white">Signup Trend</p>
                            <p className="text-xs text-white/30 mt-0.5">Daily traffic attribution over selected period</p>
                        </div>
                        <BarChart2 size={16} className="text-white/20" />
                    </div>
                    {loading ? (
                        <div className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
                    ) : data?.timeline?.length ? (
                        <div>
                            <SparkLine data={data.timeline} />
                            <div className="flex justify-between mt-2">
                                <span className="text-[10px] text-white/20">{data.timeline[0]?.date}</span>
                                <span className="text-[10px] text-white/20">{data.timeline[data.timeline.length - 1]?.date}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="h-20 flex items-center justify-center text-white/20 text-sm bg-white/[0.02] rounded-xl">
                            No timeline data for selected range
                        </div>
                    )}
                </div>

                {/* ── Source breakdown table ─────────────────────────────── */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#0f1117] overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                        <div>
                            <p className="text-sm font-bold text-white">Source Breakdown</p>
                            <p className="text-xs text-white/30 mt-0.5">{filteredRows.length} sources tracked</p>
                        </div>
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                            <input
                                type="text"
                                placeholder="Search source..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-violet-500/50 w-40"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="divide-y divide-white/[0.03]">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                                    <div className="w-8 h-8 bg-white/[0.05] rounded-xl flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-white/[0.05] rounded w-1/4" />
                                        <div className="h-2 bg-white/[0.03] rounded w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-white/20">
                            <Globe size={36} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium">No traffic data</p>
                            <p className="text-xs mt-1">Start sharing UTM-tagged links to see source attribution</p>
                        </div>
                    ) : (
                        <>
                            {/* Table header */}
                            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
                                {["Source / Campaign", "Volume", "Signups", "FTDs", "FTD Rate", "Revenue"].map(h => (
                                    <p key={h} className="text-[10px] font-bold text-white/25 uppercase tracking-wider">{h}</p>
                                ))}
                            </div>

                            <div className="divide-y divide-white/[0.03]">
                                {filteredRows.map((row, idx) => {
                                    const color = getSourceColor(row.source);
                                    const emoji = getSourceIcon(row.source);
                                    return (
                                        <div
                                            key={idx}
                                            className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-4 items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors group"
                                        >
                                            {/* Source + campaign */}
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
                                                    style={{ background: `${color}18`, border: `1px solid ${color}25` }}
                                                >
                                                    {emoji}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-white capitalize truncate">{row.source}</p>
                                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                        {row.medium && (
                                                            <span className="text-[10px] text-white/30 font-mono truncate">{row.medium}</span>
                                                        )}
                                                        {row.campaign && (
                                                            <>
                                                                {row.medium && <span className="text-white/20 text-[10px]">·</span>}
                                                                <span className="text-[10px] text-white/30 font-mono truncate">{row.campaign}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bar */}
                                            <MiniBar value={row.signups} max={maxSignups} color={color} />

                                            {/* Signups */}
                                            <p className="text-sm font-bold text-white">{row.signups.toLocaleString()}</p>

                                            {/* FTDs */}
                                            <p className="text-sm text-emerald-400 font-semibold">{row.ftdCount}</p>

                                            {/* FTD rate */}
                                            <div>
                                                <span
                                                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                                                    style={{
                                                        background: parseFloat(row.ftdRate) >= 30 ? "#10b98120" : "#ffffff08",
                                                        color: parseFloat(row.ftdRate) >= 30 ? "#10b981" : "#ffffff50",
                                                    }}
                                                >
                                                    {row.ftdRate}
                                                </span>
                                            </div>

                                            {/* Revenue */}
                                            <p className="text-sm text-amber-400 font-semibold">
                                                ₹{row.revenue >= 1000
                                                    ? `${(row.revenue / 1000).toFixed(1)}k`
                                                    : row.revenue.toFixed(0)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Info card ─────────────────────────────────────────── */}
                <div className="flex items-start gap-3 bg-violet-500/5 border border-violet-500/15 rounded-2xl p-4">
                    <Info size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-violet-300">How to use UTM tracking</p>
                        <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                            Add UTM parameters to your ad links to track source attribution automatically.
                            Example: <code className="text-violet-300 font-mono text-[11px]">
                                https://yourdomain.com/?utm_source=instagram&utm_medium=paid&utm_campaign=ipl2026
                            </code>
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
