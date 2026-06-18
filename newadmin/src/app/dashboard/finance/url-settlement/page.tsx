"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
    Link as LinkIcon, Search, Users, DollarSign, TrendingUp, TrendingDown,
    CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, AlertTriangle,
    RefreshCw, ArrowUpRight, ArrowDownLeft, Filter, BadgeCheck, X,
    Calculator, Wallet, ReceiptText, Info, SlidersHorizontal,
    ShieldOff, Shield, Ban,
} from "lucide-react";
import {
    getAvailableReferrers,
    getUsersForSettlement,
    applySettlementAdjustments,
    banReferralUsers,
    type UserSettlementRow,
    type SettlementSummary,
} from "@/actions/url-settlement";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.abs(n));

const fmtSigned = (n: number) => {
    if (n === 0) return "₹0";
    return `${n > 0 ? "+" : "-"}₹${fmt(n)}`;
};

type Toast = { msg: string; type: "success" | "error" };

// ─── Component ───────────────────────────────────────────────────────────────

export default function UrlSettlementPage() {
    // ── Source selection ──────────────────────────────────────────────────
    const [mode, setMode] = useState<"referrer" | "search">("referrer");
    const [referrers, setReferrers] = useState<any[]>([]);
    const [referrersLoaded, setReferrersLoaded] = useState(false);
    const [selectedReferrer, setSelectedReferrer] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [referrerSearch, setReferrerSearch] = useState("");

    // ── Date range ────────────────────────────────────────────────────────
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // ── Data ─────────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<UserSettlementRow[]>([]);
    const [summary, setSummary] = useState<SettlementSummary | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});
    const [notes, setNotes] = useState<Record<number, string>>({});

    // ── Sorting ───────────────────────────────────────────────────────────
    const [sortField, setSortField] = useState<string>("netAdjustment");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // ── Applying ─────────────────────────────────────────────────────────
    const [applying, setApplying] = useState(false);
    const [applyResult, setApplyResult] = useState<any | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // ── Ban ───────────────────────────────────────────────────────────────
    const [banModal, setBanModal] = useState<{
        open: boolean;
        ban: boolean;         // true = ban, false = unban
        userIds: number[];    // ids to act on
        reason: string;
        confirming: boolean;
    }>({ open: false, ban: true, userIds: [], reason: '', confirming: false });
    const [banResult, setBanResult] = useState<any | null>(null);

    // ── Toast ─────────────────────────────────────────────────────────────
    const [toast, setToast] = useState<Toast | null>(null);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4500);
    };

    // ── Load referrers ────────────────────────────────────────────────────
    const loadReferrers = async () => {
        if (referrersLoaded) return;
        setLoading(true);
        const res = await getAvailableReferrers();
        if (res.success) {
            setReferrers(res.referrers);
            setReferrersLoaded(true);
        }
        setLoading(false);
    };

    // ── Fetch settlement data ─────────────────────────────────────────────
    const fetchData = async () => {
        if (mode === "referrer" && !selectedReferrer) {
            showToast("Please select a referrer/agent.", "error");
            return;
        }
        if (mode === "search" && !searchQuery.trim()) {
            showToast("Please enter a search query.", "error");
            return;
        }

        setLoading(true);
        setRows([]);
        setSummary(null);
        setSelectedIds(new Set());
        setCustomAmounts({});
        setNotes({});
        setApplyResult(null);

        const res = await getUsersForSettlement({
            mode,
            referrerId: selectedReferrer?.id,
            searchQuery: searchQuery.trim(),
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
        });

        if (res.success) {
            setRows(res.users);
            setSummary(res.summary);
            // Auto-select users with non-zero adjustments
            const autoSelect = new Set(
                res.users
                    .filter((r) => Math.abs(r.netAdjustment) > 0)
                    .map((r) => r.userId),
            );
            setSelectedIds(autoSelect);
        } else {
            showToast(res.error || "Failed to load settlement data.", "error");
        }
        setLoading(false);
    };

    // ── Sorting logic ─────────────────────────────────────────────────────
    const sorted = useMemo(() => {
        return [...rows].sort((a: any, b: any) => {
            const av = a[sortField] ?? 0;
            const bv = b[sortField] ?? 0;
            if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === "asc" ? av - bv : bv - av;
        });
    }, [rows, sortField, sortDir]);

    const handleSort = (field: string) => {
        if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortField(field); setSortDir("desc"); }
    };

    // ── Selection ─────────────────────────────────────────────────────────
    const toggle = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === sorted.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(sorted.map(r => r.userId)));
    };

    // ── Effective adjustment for a row ────────────────────────────────────
    const effectiveAdj = (row: UserSettlementRow) => {
        const custom = customAmounts[row.userId];
        if (custom !== undefined && custom !== "") return parseFloat(custom) || 0;
        return row.netAdjustment;
    };

    // ── Live totals ───────────────────────────────────────────────────────
    const liveSummary = useMemo(() => {
        const sel = sorted.filter(r => selectedIds.has(r.userId));
        const total = sel.reduce((s, r) => s + effectiveAdj(r), 0);
        const credits = sel.filter(r => effectiveAdj(r) > 0).reduce((s, r) => s + effectiveAdj(r), 0);
        const debits = sel.filter(r => effectiveAdj(r) < 0).reduce((s, r) => s + effectiveAdj(r), 0);
        return { total, credits, debits, count: sel.length };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sorted, selectedIds, customAmounts]);

    // ── Apply adjustments ─────────────────────────────────────────────────
    const handleApply = async () => {
        const adjustments = sorted
            .filter(r => selectedIds.has(r.userId))
            .map(r => ({
                userId: r.userId,
                adjustmentAmount: effectiveAdj(r),
                notes: notes[r.userId] || `Batch settlement for ${r.username}`,
            }))
            .filter(a => a.adjustmentAmount !== 0);

        if (!adjustments.length) {
            showToast("No non-zero adjustments to apply.", "error");
            setConfirmOpen(false);
            return;
        }

        setApplying(true);
        setConfirmOpen(false);
        const res = await applySettlementAdjustments(adjustments);
        setApplying(false);
        setApplyResult(res);

        if (res.success) {
            showToast(`✅ Applied ${res.applied} adjustment(s).${(res.failed ?? 0) > 0 ? ` ${res.failed} failed.` : ""}`, "success");
            // Refresh data
            await fetchData();
        } else {
            showToast("Settlement failed. Please try again.", "error");
        }
    };

    // ── Ban handler ───────────────────────────────────────────────────────
    const handleBan = async () => {
        const { userIds, ban, reason } = banModal;
        if (!userIds.length) return;
        setBanModal(m => ({ ...m, confirming: true }));
        const res = await banReferralUsers(userIds, ban, 1, reason || (ban ? 'Referral settlement ban' : 'Referral settlement unban'));
        setBanModal(m => ({ ...m, open: false, confirming: false }));
        setBanResult(res);
        if (res.success) {
            showToast(`${ban ? '🚫 Banned' : '✅ Unbanned'} ${res.affected} user(s)${(res.failed ?? 0) > 0 ? `, ${res.failed} failed` : ''}.`, (res.failed ?? 0) > 0 ? "error" : "success");
            // Update local rows to reflect new ban status
            setRows(prev => prev.map(r => userIds.includes(r.userId) ? { ...r, isBanned: ban } : r));
        } else {
            showToast('Ban action failed. Please try again.', 'error');
        }
    };

    const openBanModal = (ban: boolean, ids: number[]) => {
        setBanModal({ open: true, ban, userIds: ids, reason: '', confirming: false });
    };

    // ── Count banned in selection ─────────────────────────────────────────
    const selectedBannedCount = useMemo(() =>
        sorted.filter(r => selectedIds.has(r.userId) && r.isBanned).length,
    [sorted, selectedIds]);
    const selectedUnbannedCount = useMemo(() =>
        sorted.filter(r => selectedIds.has(r.userId) && !r.isBanned).length,
    [sorted, selectedIds]);

    // ─────────────────────────────────────────────────────────────────────

    const filteredReferrers = referrers.filter(r =>
        !referrerSearch || r.username.toLowerCase().includes(referrerSearch.toLowerCase()) ||
        r.email?.toLowerCase().includes(referrerSearch.toLowerCase()),
    );

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return <ChevronDown size={12} className="text-slate-600" />;
        return sortDir === "asc"
            ? <ChevronUp size={12} className="text-violet-400" />
            : <ChevronDown size={12} className="text-violet-400" />;
    };

    const thCls = "px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white select-none";
    const tdCls = "px-3 py-3 text-sm text-slate-300";
    const inputCls = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none transition-colors";

    // Number of banned users in the current result set
    const totalBannedInView = rows.filter(r => r.isBanned).length;

    return (
        <div className="space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium shadow-xl animate-in slide-in-from-top-4 ${toast.type === "success" ? "bg-emerald-900/90 border-emerald-500/40 text-emerald-200" : "bg-red-900/90 border-red-500/40 text-red-200"}`}>
                    {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                            <Calculator size={20} className="text-violet-400" />
                        </div>
                        URL Batch Settlement
                    </h1>
                    <p className="text-slate-400 mt-1 ml-13">Select a referrer or search users → review adjustments → approve to update wallets.</p>
                </div>
            </div>

            {/* ── Step 1: Source Selector ── */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">1</div>
                    <span className="text-sm font-semibold text-white">Select User Source</span>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2">
                    {(["referrer", "search"] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${mode === m ? "bg-violet-600 border-violet-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"}`}
                        >
                            {m === "referrer" ? "By Referrer / Agent" : "By Search"}
                        </button>
                    ))}
                </div>

                {mode === "referrer" ? (
                    <div className="space-y-3">
                        <button
                            onClick={loadReferrers}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                        >
                            <RefreshCw size={14} className={loading && !referrersLoaded ? "animate-spin" : ""} />
                            {referrersLoaded ? "Reload Referrers" : "Load Referrers"}
                        </button>

                        {referrersLoaded && (
                            <>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Filter referrers..."
                                        value={referrerSearch}
                                        onChange={e => setReferrerSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/50">
                                    {filteredReferrers.length === 0 ? (
                                        <div className="text-slate-500 text-sm p-4 text-center">No referrers found.</div>
                                    ) : filteredReferrers.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => setSelectedReferrer(r)}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-slate-700 ${selectedReferrer?.id === r.id ? "bg-violet-900/40 text-violet-300" : "text-slate-300"}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-violet-400">
                                                    {r.username[0]?.toUpperCase()}
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-medium">{r.username}</p>
                                                    <p className="text-[11px] text-slate-500">{r.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-right">
                                                <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{r.referredCount} referred</span>
                                                <span className="text-xs text-slate-500 capitalize">{r.role?.toLowerCase()}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {selectedReferrer && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-violet-900/20 border border-violet-500/30 rounded-lg text-sm">
                                        <BadgeCheck size={14} className="text-violet-400" />
                                        <span className="text-violet-300 font-medium">Selected: {selectedReferrer.username}</span>
                                        <span className="text-slate-400">({selectedReferrer.referredCount} users)</span>
                                        <button onClick={() => setSelectedReferrer(null)} className="ml-auto text-slate-500 hover:text-white">
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by username, email, or phone..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && fetchData()}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                        />
                    </div>
                )}

                {/* Date range */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Date From (optional)</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Date To (optional)</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
                    </div>
                </div>

                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-violet-900/30"
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                    {loading ? "Calculating..." : "Calculate Settlement"}
                </button>
            </div>

            {/* ── Step 2: Summary Cards ── */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    {[
                        { label: "Users Found", value: summary.totalUsers.toString(), icon: Users, color: "text-slate-300", bg: "bg-slate-700/30" },
                        { label: "Total Deposits", value: `₹${fmt(summary.totalDeposits)}`, icon: ArrowDownLeft, color: "text-emerald-400", bg: "bg-emerald-900/20" },
                        { label: "Total Withdrawals", value: `₹${fmt(summary.totalWithdrawals)}`, icon: ArrowUpRight, color: "text-red-400", bg: "bg-red-900/20" },
                        { label: "Total Bonus", value: `₹${fmt(summary.totalBonus)}`, icon: DollarSign, color: "text-amber-400", bg: "bg-amber-900/20" },
                        { label: "Users to Credit", value: summary.usersOwed.toString(), icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-900/20" },
                        { label: "Users to Debit", value: summary.usersOwing.toString(), icon: TrendingDown, color: "text-red-400", bg: "bg-red-900/20" },
                    ].map(card => {
                        const Icon = card.icon;
                        return (
                            <div key={card.label} className={`${card.bg} border border-slate-700/50 rounded-xl p-3.5`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                                    <Icon size={14} className={card.color} />
                                </div>
                                <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Step 3: User Table ── */}
            {rows.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">2</div>
                            <span className="text-sm font-semibold text-white">Review & Select Adjustments</span>
                            <span className="text-xs text-slate-500">({selectedIds.size} selected)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={toggleAll} className="text-xs px-3 py-1.5 border border-slate-600 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
                                {selectedIds.size === sorted.length ? "Deselect All" : "Select All"}
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set(sorted.filter(r => r.netAdjustment !== 0).map(r => r.userId)))}
                                className="text-xs px-3 py-1.5 border border-violet-600/40 rounded-lg text-violet-400 hover:bg-violet-600/10 transition-colors"
                            >
                                Select Non-Zero
                            </button>
                            {selectedUnbannedCount > 0 && (
                                <button
                                    onClick={() => openBanModal(true, sorted.filter(r => selectedIds.has(r.userId) && !r.isBanned).map(r => r.userId))}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-900/30 border border-red-500/40 rounded-lg text-red-400 hover:bg-red-900/50 transition-colors"
                                >
                                    <ShieldOff size={12} />
                                    Ban {selectedUnbannedCount} selected
                                </button>
                            )}
                            {selectedBannedCount > 0 && (
                                <button
                                    onClick={() => openBanModal(false, sorted.filter(r => selectedIds.has(r.userId) && r.isBanned).map(r => r.userId))}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-900/30 border border-emerald-500/40 rounded-lg text-emerald-400 hover:bg-emerald-900/50 transition-colors"
                                >
                                    <Shield size={12} />
                                    Unban {selectedBannedCount} selected
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Banned users notice */}
                    {totalBannedInView > 0 && (
                        <div className="flex items-center gap-2 mx-5 mt-3 mb-0 px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-lg">
                            <Ban size={12} className="text-red-400 shrink-0" />
                            <p className="text-[11px] text-red-300/80">
                                <strong>{totalBannedInView}</strong> banned user{totalBannedInView !== 1 ? 's' : ''} in this list. Banned users cannot log in. Use the <span className="font-semibold">Ban / Unban</span> buttons to manage their access.
                            </p>
                        </div>
                    )}

                    {/* Info banner */}
                    <div className="flex items-start gap-2 mx-5 mt-4 mb-2 px-3 py-2.5 bg-blue-900/20 border border-blue-500/20 rounded-lg">
                        <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-300/80 leading-relaxed">
                            <strong>Net Adjustment</strong> = Current Balance − (Deposits + Bonus + Bonus Converts − Withdrawals). You can override the amount per user. Positive = credit to wallet. Negative = debit from wallet.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/30 border-b border-slate-700">
                                <tr>
                                    <th className="pl-4 pr-2 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === sorted.length && sorted.length > 0}
                                            onChange={toggleAll}
                                            className="w-4 h-4 accent-violet-500 rounded"
                                        />
                                    </th>
                                    <th className={thCls} onClick={() => handleSort("username")}>
                                        <span className="flex items-center gap-1">User <SortIcon field="username" /></span>
                                    </th>
                                    <th className={thCls} onClick={() => handleSort("currentBalance")}>
                                        <span className="flex items-center gap-1">Balance <SortIcon field="currentBalance" /></span>
                                    </th>
                                    <th className={thCls} onClick={() => handleSort("totalDeposits")}>
                                        <span className="flex items-center gap-1">Deposits <SortIcon field="totalDeposits" /></span>
                                    </th>
                                    <th className={thCls} onClick={() => handleSort("totalWithdrawals")}>
                                        <span className="flex items-center gap-1">Withdrawals <SortIcon field="totalWithdrawals" /></span>
                                    </th>
                                    <th className={thCls} onClick={() => handleSort("totalBonus")}>
                                        <span className="flex items-center gap-1">Bonus <SortIcon field="totalBonus" /></span>
                                    </th>
                                    <th className={thCls} onClick={() => handleSort("netAdjustment")}>
                                        <span className="flex items-center gap-1">Net Adj. <SortIcon field="netAdjustment" /></span>
                                    </th>
                                    <th className={`${thCls} min-w-[140px]`}>Override Amt.</th>
                                    <th className={`${thCls} min-w-[180px]`}>Notes</th>
                                    <th className={`${thCls} w-24 text-center`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {sorted.map(row => {
                                    const isSelected = selectedIds.has(row.userId);
                                    const adj = effectiveAdj(row);
                                    const adjColor = adj > 0 ? "text-emerald-400" : adj < 0 ? "text-red-400" : "text-slate-500";

                                    return (
                                        <tr
                                            key={row.userId}
                                            className={`transition-colors ${isSelected ? "bg-violet-900/10" : "hover:bg-slate-700/20"}`}
                                        >
                                            <td className="pl-4 pr-2 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggle(row.userId)}
                                                    className="w-4 h-4 accent-violet-500 rounded"
                                                />
                                            </td>
                                            <td className={tdCls}>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-white">{row.username}</p>
                                                        {row.isBanned && (
                                                            <span className="flex items-center gap-0.5 text-[10px] bg-red-900/50 border border-red-500/40 text-red-400 px-1.5 py-0.5 rounded-full font-semibold">
                                                                <Ban size={8} /> BANNED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500">{row.email}</p>
                                                    {row.phoneNumber && <p className="text-[11px] text-slate-600">{row.phoneNumber}</p>}
                                                </div>
                                            </td>
                                            <td className={tdCls}>
                                                <span className="font-mono font-semibold text-white">₹{fmt(row.currentBalance)}</span>
                                            </td>
                                            <td className={tdCls}>
                                                <span className="text-emerald-400">+₹{fmt(row.totalDeposits)}</span>
                                            </td>
                                            <td className={tdCls}>
                                                <span className="text-red-400">-₹{fmt(row.totalWithdrawals)}</span>
                                            </td>
                                            <td className={tdCls}>
                                                <span className="text-amber-400">+₹{fmt(row.totalBonus)}</span>
                                            </td>
                                            <td className={`${tdCls} font-mono font-bold`}>
                                                <span className={adjColor}>{fmtSigned(adj)}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder={row.netAdjustment.toFixed(2)}
                                                    value={customAmounts[row.userId] ?? ""}
                                                    onChange={e => setCustomAmounts(prev => ({ ...prev, [row.userId]: e.target.value }))}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:border-violet-500 focus:outline-none font-mono"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="Reason..."
                                                    value={notes[row.userId] ?? ""}
                                                    onChange={e => setNotes(prev => ({ ...prev, [row.userId]: e.target.value }))}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:border-violet-500 focus:outline-none"
                                                />
                                            </td>
                                            {/* Ban / Unban action */}
                                            <td className="px-3 py-2 text-center">
                                                {row.isBanned ? (
                                                    <button
                                                        onClick={() => openBanModal(false, [row.userId])}
                                                        title="Unban user"
                                                        className="flex items-center gap-1 mx-auto text-[11px] px-2.5 py-1.5 bg-emerald-900/30 border border-emerald-500/40 text-emerald-400 rounded-lg hover:bg-emerald-900/60 transition-colors"
                                                    >
                                                        <Shield size={11} /> Unban
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => openBanModal(true, [row.userId])}
                                                        title="Ban user"
                                                        className="flex items-center gap-1 mx-auto text-[11px] px-2.5 py-1.5 bg-red-900/30 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-900/60 transition-colors"
                                                    >
                                                        <ShieldOff size={11} /> Ban
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Step 3: Approval Bar ── */}
            {selectedIds.size > 0 && (
                <div className="sticky bottom-4 left-0 right-0 z-30">
                    <div className="mx-auto max-w-4xl bg-slate-900 border border-slate-600 rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">3</div>
                            <span className="text-sm font-semibold text-white">Approve Settlement</span>
                        </div>

                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5 text-sm">
                                <Users size={14} className="text-slate-400" />
                                <span className="text-white font-bold">{liveSummary.count}</span>
                                <span className="text-slate-400">users</span>
                            </div>
                            <div className="h-4 w-px bg-slate-700" />
                            {liveSummary.credits > 0 && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <ArrowDownLeft size={14} className="text-emerald-400" />
                                    <span className="text-emerald-400 font-bold">+₹{fmt(liveSummary.credits)}</span>
                                    <span className="text-slate-400">credits</span>
                                </div>
                            )}
                            {liveSummary.debits < 0 && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <ArrowUpRight size={14} className="text-red-400" />
                                    <span className="text-red-400 font-bold">-₹{fmt(Math.abs(liveSummary.debits))}</span>
                                    <span className="text-slate-400">debits</span>
                                </div>
                            )}
                            <div className="h-4 w-px bg-slate-700" />
                            <div className="flex items-center gap-1.5 text-sm">
                                <Wallet size={14} className="text-violet-400" />
                                <span className="text-slate-400">Net:</span>
                                <span className={`font-bold ${liveSummary.total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {fmtSigned(liveSummary.total)}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setConfirmOpen(true)}
                            disabled={applying}
                            className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-violet-900/50"
                        >
                            {applying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {applying ? "Applying..." : "Approve & Apply"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Ban confirmation Modal ── */}
            {banModal.open && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${banModal.ban ? 'bg-red-500/20 border-red-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>
                                {banModal.ban ? <ShieldOff size={20} className="text-red-400" /> : <Shield size={20} className="text-emerald-400" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {banModal.ban ? 'Ban Users' : 'Unban Users'}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    {banModal.userIds.length} user{banModal.userIds.length !== 1 ? 's' : ''} will be {banModal.ban ? 'banned' : 'unbanned'}.
                                </p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs text-slate-400 mb-1.5">Reason (optional)</label>
                            <input
                                type="text"
                                placeholder={banModal.ban ? 'e.g. Referral abuse, bonus farming...' : 'e.g. Appeal approved...'}
                                value={banModal.reason}
                                onChange={e => setBanModal(m => ({ ...m, reason: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-red-500 focus:outline-none"
                            />
                        </div>

                        {banModal.ban && (
                            <p className="text-xs text-red-300/70 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                                ⚠️ Banned users will be unable to log in. This action is logged in the Audit Log and can be reversed by unbanning.
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setBanModal(m => ({ ...m, open: false }))}
                                className="flex-1 py-2.5 border border-slate-600 text-slate-400 rounded-xl hover:bg-slate-700 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBan}
                                disabled={banModal.confirming}
                                className={`flex-1 py-2.5 font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${banModal.ban ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                            >
                                {banModal.confirming ? <Loader2 size={14} className="animate-spin" /> : banModal.ban ? <ShieldOff size={14} /> : <Shield size={14} />}
                                {banModal.confirming ? 'Processing...' : banModal.ban ? 'Confirm Ban' : 'Confirm Unban'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirmation Modal ── */}
            {confirmOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Confirm Settlement</h3>
                                <p className="text-sm text-slate-400">This will update live wallet balances.</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-5">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Users affected</span>
                                <span className="text-white font-bold">{liveSummary.count}</span>
                            </div>
                            {liveSummary.credits > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Total credits (wallet add)</span>
                                    <span className="text-emerald-400 font-bold">+₹{fmt(liveSummary.credits)}</span>
                                </div>
                            )}
                            {liveSummary.debits < 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Total debits (wallet deduct)</span>
                                    <span className="text-red-400 font-bold">-₹{fmt(Math.abs(liveSummary.debits))}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm border-t border-slate-700 pt-2 mt-2">
                                <span className="text-slate-400 font-medium">Net platform impact</span>
                                <span className={`font-bold ${liveSummary.total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {fmtSigned(liveSummary.total)}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-amber-300/70 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2 mb-5">
                            ⚠️ Each change will be logged as MANUAL_CREDIT or MANUAL_DEBIT and recorded in Audit Logs. This action cannot be automatically reversed.
                        </p>

                        <div className="flex gap-3">
                            <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 border border-slate-600 text-slate-400 rounded-xl hover:bg-slate-700 transition-colors text-sm">
                                Cancel
                            </button>
                            <button onClick={handleApply} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-colors">
                                Confirm & Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && rows.length === 0 && summary !== null && (
                <div className="text-center py-16 text-slate-500">
                    <Users size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No users found for this source.</p>
                    <p className="text-sm">Try a different referrer or search query.</p>
                </div>
            )}

            {/* Apply result */}
            {applyResult && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${applyResult.failed === 0 ? "bg-emerald-900/30 border-emerald-500/30 text-emerald-300" : "bg-amber-900/30 border-amber-500/30 text-amber-300"}`}>
                    {applyResult.failed === 0 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    <span>Applied <strong>{applyResult.applied}</strong> adjustments.
                        {applyResult.failed > 0 && <> <strong className="text-red-400">{applyResult.failed} failed</strong> — check console logs.</>}
                    </span>
                </div>
            )}
        </div>
    );
}
