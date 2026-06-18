"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
    Users, Search, X, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp,
    AlertTriangle, ArrowUpRight, ArrowDownLeft, Wallet, Calculator,
    Info, UserPlus, Badge, ReceiptText, Trash2, RefreshCw, ListChecks,
} from "lucide-react";
import {
    searchUsersForPicker,
    computeSettlementForUsers,
    applyUserSettlement,
    type UserSettlementRow,
} from "@/actions/manual-settlement";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.abs(n));
const fmtSigned = (n: number) =>
    n === 0 ? "₹0" : `${n > 0 ? "+" : "-"}₹${fmt(n)}`;

type Toast = { msg: string; type: "success" | "error" };
type PickedUser = { id: number; username: string; email: string; phoneNumber: string | null; balance: number; role: string };

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ManualSettlementPage() {
    // ── User Picker ───────────────────────────────────────────────────────
    const [pickerQuery, setPickerQuery] = useState("");
    const [pickerResults, setPickerResults] = useState<PickedUser[]>([]);
    const [pickerLoading, setPickerLoading] = useState(false);
    const [pickedUsers, setPickedUsers] = useState<PickedUser[]>([]);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Date range ────────────────────────────────────────────────────────
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // ── Settlement data ───────────────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<UserSettlementRow[]>([]);
    const [computed, setComputed] = useState(false);

    // ── Selection & overrides ─────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});
    const [notes, setNotes] = useState<Record<number, string>>({});

    // ── Sort ──────────────────────────────────────────────────────────────
    const [sortField, setSortField] = useState("netAdjustment");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // ── Apply ─────────────────────────────────────────────────────────────
    const [applying, setApplying] = useState(false);
    const [applyResult, setApplyResult] = useState<any>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // ── Toast ─────────────────────────────────────────────────────────────
    const [toast, setToast] = useState<Toast | null>(null);

    const showToast = (msg: string, type: "success" | "error") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4500);
    };

    // ── Picker search ────────────────────────────────────────────────────
    const handlePickerInput = (val: string) => {
        setPickerQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!val.trim()) { setPickerResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setPickerLoading(true);
            const res = await searchUsersForPicker(val);
            setPickerResults((res.users ?? []) as PickedUser[]);
            setPickerLoading(false);
        }, 300);
    };

    const addUser = (u: PickedUser) => {
        if (pickedUsers.some(p => p.id === u.id)) return;
        setPickedUsers(prev => [...prev, u]);
        setPickerQuery("");
        setPickerResults([]);
    };

    const removeUser = (id: number) => {
        setPickedUsers(prev => prev.filter(u => u.id !== id));
        setRows(prev => prev.filter(r => r.userId !== id));
        setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        setCustomAmounts(prev => { const n = { ...prev }; delete n[id]; return n; });
        setNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    };

    // ── Compute settlement ────────────────────────────────────────────────
    const handleCompute = async () => {
        if (!pickedUsers.length) { showToast("Pick at least one user.", "error"); return; }
        setLoading(true);
        setRows([]);
        setComputed(false);
        setApplyResult(null);
        setSelectedIds(new Set());
        setCustomAmounts({});
        setNotes({});

        const res = await computeSettlementForUsers({
            userIds: pickedUsers.map(u => u.id),
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
        });

        if (res.success) {
            setRows(res.rows);
            setComputed(true);
            // Auto-select non-zero
            setSelectedIds(new Set(res.rows.filter(r => r.netAdjustment !== 0).map(r => r.userId)));
        } else {
            showToast((res as any).error ?? "Failed to compute settlement.", "error");
        }
        setLoading(false);
    };

    // ── Sort ─────────────────────────────────────────────────────────────
    const sorted = useMemo(() => {
        return [...rows].sort((a: any, b: any) => {
            const av = a[sortField] ?? 0;
            const bv = b[sortField] ?? 0;
            if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === "asc" ? av - bv : bv - av;
        });
    }, [rows, sortField, sortDir]);

    const handleSort = (f: string) => {
        if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortField(f); setSortDir("desc"); }
    };

    // ── Selection ─────────────────────────────────────────────────────────
    const toggle = (id: number) => setSelectedIds(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
    const toggleAll = () => setSelectedIds(selectedIds.size === sorted.length ? new Set() : new Set(sorted.map(r => r.userId)));

    // ── Effective adj ─────────────────────────────────────────────────────
    const effAdj = (r: UserSettlementRow) => {
        const c = customAmounts[r.userId];
        return (c !== undefined && c !== "") ? parseFloat(c) || 0 : r.netAdjustment;
    };

    // ── Live totals ───────────────────────────────────────────────────────
    const liveSummary = useMemo(() => {
        const sel = sorted.filter(r => selectedIds.has(r.userId));
        const credits = sel.filter(r => effAdj(r) > 0).reduce((s, r) => s + effAdj(r), 0);
        const debits = sel.filter(r => effAdj(r) < 0).reduce((s, r) => s + effAdj(r), 0);
        return { count: sel.length, credits, debits, net: credits + debits };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sorted, selectedIds, customAmounts]);

    // ── Apply ─────────────────────────────────────────────────────────────
    const handleApply = async () => {
        const adjs = sorted
            .filter(r => selectedIds.has(r.userId))
            .map(r => ({ userId: r.userId, adjustmentAmount: effAdj(r), notes: notes[r.userId] || `Manual settlement — ${r.username}` }))
            .filter(a => a.adjustmentAmount !== 0);

        if (!adjs.length) { showToast("No non-zero adjustments selected.", "error"); setConfirmOpen(false); return; }

        setApplying(true);
        setConfirmOpen(false);
        const res = await applyUserSettlement(adjs);
        setApplying(false);
        setApplyResult(res);

        if (res.success) {
            showToast(`✅ Applied ${res.applied} adjustment(s).${(res.failed ?? 0) > 0 ? ` ${res.failed} failed.` : ""}`, "success");
            await handleCompute();
        } else {
            showToast("Settlement failed.", "error");
        }
    };

    // ─── Styles ───────────────────────────────────────────────────────────
    const thCls = "px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white select-none whitespace-nowrap";
    const tdCls = "px-3 py-3 text-sm text-slate-300";
    const inputCls = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:outline-none";
    const SortIcon = ({ f }: { f: string }) => sortField !== f
        ? <ChevronDown size={12} className="text-slate-600" />
        : sortDir === "asc" ? <ChevronUp size={12} className="text-violet-400" /> : <ChevronDown size={12} className="text-violet-400" />;

    const roleColor = (role: string) => ({
        USER: "bg-slate-700 text-slate-300",
        MANAGER: "bg-blue-900/60 text-blue-300",
        SUPER_ADMIN: "bg-violet-900/60 text-violet-300",
        MASTER: "bg-amber-900/60 text-amber-300",
        AGENT: "bg-emerald-900/60 text-emerald-300",
    }[role] ?? "bg-slate-700 text-slate-300");

    // ─── Render ───────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 relative pb-32">
            {/* Toast */}
            {toast && (
                <div className={`fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium shadow-xl animate-in slide-in-from-top-4 ${toast.type === "success" ? "bg-emerald-900/90 border-emerald-500/40 text-emerald-200" : "bg-red-900/90 border-red-500/40 text-red-200"}`}>
                    {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* ── Header ── */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                        <ListChecks size={20} className="text-emerald-400" />
                    </div>
                    Manual User Settlement
                </h1>
                <p className="text-slate-400 mt-1 ml-[52px]">
                    Search &amp; pick users → compute their transaction totals → adjust &amp; approve wallet changes.
                </p>
            </div>

            {/* ── Step 1: User Picker ── */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">1</div>
                    <span className="text-sm font-semibold text-white">Select Users</span>
                    {pickedUsers.length > 0 && (
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                            {pickedUsers.length} picked
                        </span>
                    )}
                </div>

                {/* Search input */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by username, email, or phone..."
                        value={pickerQuery}
                        onChange={e => handlePickerInput(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    {pickerLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />}
                </div>

                {/* Search dropdown */}
                {pickerResults.length > 0 && (
                    <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-xl divide-y divide-slate-800 max-h-64 overflow-y-auto">
                        {pickerResults.map(u => {
                            const already = pickedUsers.some(p => p.id === u.id);
                            return (
                                <button
                                    key={u.id}
                                    onClick={() => !already && addUser(u)}
                                    disabled={already}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${already ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-800"}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                            {(u.username?.[0] ?? "?").toUpperCase()}
                                        </div>
                                        <div className="text-left min-w-0">
                                            <p className="font-medium text-white truncate">{u.username}</p>
                                            <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                        <span className="text-emerald-400 text-xs font-mono">₹{fmt(u.balance)}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleColor(u.role)}`}>{u.role}</span>
                                        {already ? <CheckCircle size={14} className="text-emerald-500" /> : <UserPlus size={14} className="text-slate-500" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Picked users chips */}
                {pickedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {pickedUsers.map(u => (
                            <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/20 border border-emerald-500/25 rounded-xl text-sm">
                                <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold">
                                    {(u.username?.[0] ?? "?").toUpperCase()}
                                </div>
                                <span className="text-emerald-300 font-medium">{u.username}</span>
                                <span className="text-slate-500 text-xs">₹{fmt(u.balance)}</span>
                                <button onClick={() => removeUser(u.id)} className="text-slate-500 hover:text-red-400 transition-colors ml-0.5">
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => { setPickedUsers([]); setRows([]); setComputed(false); setSelectedIds(new Set()); }}
                            className="flex items-center gap-1 px-3 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-900/20 rounded-xl text-xs transition-colors"
                        >
                            <Trash2 size={12} /> Clear All
                        </button>
                    </div>
                )}

                {/* Date range */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1 border-t border-slate-700">
                    <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1.5">Date From (optional)</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1.5">Date To (optional)</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
                    </div>
                </div>

                <button
                    onClick={handleCompute}
                    disabled={loading || !pickedUsers.length}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/30"
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                    {loading ? "Computing..." : `Compute Settlement (${pickedUsers.length} user${pickedUsers.length !== 1 ? "s" : ""})`}
                </button>
            </div>

            {/* ── Step 2: Summary Cards ── */}
            {computed && rows.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: "Users", value: rows.length.toString(), color: "text-slate-200", bg: "bg-slate-700/30", icon: Users },
                        { label: "Total Deposits", value: `₹${fmt(rows.reduce((s, r) => s + r.totalDeposits, 0))}`, color: "text-emerald-400", bg: "bg-emerald-900/20", icon: ArrowDownLeft },
                        { label: "Total Withdrawals", value: `₹${fmt(rows.reduce((s, r) => s + r.totalWithdrawals, 0))}`, color: "text-red-400", bg: "bg-red-900/20", icon: ArrowUpRight },
                        { label: "Net Adj. Selected", value: fmtSigned(liveSummary.net), color: liveSummary.net >= 0 ? "text-emerald-400" : "text-red-400", bg: "bg-violet-900/20", icon: Calculator },
                    ].map(c => {
                        const Icon = c.icon;
                        return (
                            <div key={c.label} className={`${c.bg} border border-slate-700/50 rounded-xl p-4`}>
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs text-slate-500 font-medium">{c.label}</p>
                                    <Icon size={14} className={c.color} />
                                </div>
                                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Step 2: Table ── */}
            {computed && rows.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">2</div>
                            <span className="text-sm font-semibold text-white">Review Adjustments</span>
                            <span className="text-xs text-slate-500">({selectedIds.size} / {sorted.length} selected)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={toggleAll} className="text-xs px-3 py-1.5 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors">
                                {selectedIds.size === sorted.length ? "Deselect All" : "Select All"}
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set(sorted.filter(r => r.netAdjustment !== 0).map(r => r.userId)))}
                                className="text-xs px-3 py-1.5 border border-emerald-600/40 rounded-lg text-emerald-400 hover:bg-emerald-600/10 transition-colors"
                            >
                                Select Non-Zero
                            </button>
                            <button onClick={handleCompute} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors">
                                <RefreshCw size={12} /> Refresh
                            </button>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex items-start gap-2 mx-5 mt-4 mb-3 px-3 py-2.5 bg-blue-900/20 border border-blue-500/20 rounded-lg">
                        <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-300/80 leading-relaxed">
                            <strong>Net Position</strong> = Deposits + Bonus + Credits − Withdrawals − Debits.
                            {" "}<strong>Net Adjustment</strong> = Current Balance − Net Position.
                            {" "}Positive = balance exceeds ledger (may debit). Negative = ledger says user is owed (credit).
                            {" "}Override any amount per row before approving.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/30 border-b border-slate-700">
                                <tr>
                                    <th className="pl-4 pr-2 py-3 w-10">
                                        <input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleAll} className="w-4 h-4 accent-emerald-500 rounded" />
                                    </th>
                                    <th className={thCls} onClick={() => handleSort("username")}><span className="flex items-center gap-1">User <SortIcon f="username" /></span></th>
                                    <th className={thCls} onClick={() => handleSort("currentBalance")}><span className="flex items-center gap-1">Balance <SortIcon f="currentBalance" /></span></th>
                                    <th className={thCls} onClick={() => handleSort("totalDeposits")}><span className="flex items-center gap-1">Deposits <SortIcon f="totalDeposits" /></span></th>
                                    <th className={thCls} onClick={() => handleSort("totalWithdrawals")}><span className="flex items-center gap-1">Withdrawals <SortIcon f="totalWithdrawals" /></span></th>
                                    <th className={thCls} onClick={() => handleSort("totalBonus")}><span className="flex items-center gap-1">Bonus <SortIcon f="totalBonus" /></span></th>
                                    <th className={thCls} onClick={() => handleSort("netPosition")}><span className="flex items-center gap-1">Net Position <SortIcon f="netPosition" /></span></th>
                                    <th className={thCls} onClick={() => handleSort("netAdjustment")}><span className="flex items-center gap-1">Auto Adj. <SortIcon f="netAdjustment" /></span></th>
                                    <th className={`${thCls} min-w-[140px]`}>Override</th>
                                    <th className={`${thCls} min-w-[180px]`}>Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {sorted.map(row => {
                                    const isSelected = selectedIds.has(row.userId);
                                    const adj = effAdj(row);
                                    const adjColor = adj > 0 ? "text-emerald-400" : adj < 0 ? "text-red-400" : "text-slate-500";

                                    return (
                                        <tr key={row.userId} className={`transition-colors ${isSelected ? "bg-emerald-900/10" : "hover:bg-slate-700/20"}`}>
                                            <td className="pl-4 pr-2 py-3">
                                                <input type="checkbox" checked={isSelected} onChange={() => toggle(row.userId)} className="w-4 h-4 accent-emerald-500 rounded" />
                                            </td>
                                            <td className={tdCls}>
                                                <div>
                                                    <p className="font-medium text-white">{row.username}</p>
                                                    <p className="text-[11px] text-slate-500">{row.email}</p>
                                                    {row.phoneNumber && <p className="text-[11px] text-slate-600">{row.phoneNumber}</p>}
                                                </div>
                                            </td>
                                            <td className={tdCls}><span className="font-mono font-semibold text-white">₹{fmt(row.currentBalance)}</span></td>
                                            <td className={tdCls}><span className="text-emerald-400">+₹{fmt(row.totalDeposits)}</span></td>
                                            <td className={tdCls}><span className="text-red-400">−₹{fmt(row.totalWithdrawals)}</span></td>
                                            <td className={tdCls}><span className="text-amber-400">+₹{fmt(row.totalBonus)}</span></td>
                                            <td className={tdCls}><span className="font-mono text-slate-200">₹{fmt(row.netPosition)}</span></td>
                                            <td className={`${tdCls} font-mono font-bold`}>
                                                <span className={adjColor}>{fmtSigned(adj)}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder={row.netAdjustment.toFixed(2)}
                                                    value={customAmounts[row.userId] ?? ""}
                                                    onChange={e => setCustomAmounts(p => ({ ...p, [row.userId]: e.target.value }))}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:border-emerald-500 focus:outline-none font-mono"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="Reason..."
                                                    value={notes[row.userId] ?? ""}
                                                    onChange={e => setNotes(p => ({ ...p, [row.userId]: e.target.value }))}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* No results */}
            {computed && rows.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    <Users size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No data found for selected users.</p>
                </div>
            )}

            {/* Apply result banner */}
            {applyResult && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${(applyResult.failed ?? 0) === 0 ? "bg-emerald-900/30 border-emerald-500/30 text-emerald-300" : "bg-amber-900/30 border-amber-500/30 text-amber-300"}`}>
                    {(applyResult.failed ?? 0) === 0 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    <span>Applied <strong>{applyResult.applied}</strong> adjustments.
                        {(applyResult.failed ?? 0) > 0 && <> <strong className="text-red-400">{applyResult.failed} failed</strong>.</>}
                    </span>
                </div>
            )}

            {/* ── Step 3: Sticky Approval Bar ── */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-4 left-0 right-0 z-30 px-4">
                    <div className="mx-auto max-w-5xl bg-slate-900 border border-emerald-600/30 rounded-2xl shadow-2xl shadow-emerald-900/30 p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">3</div>
                            <span className="text-sm font-semibold text-white">Approve &amp; Apply</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 flex-1">
                            <div className="flex items-center gap-1.5 text-sm">
                                <Users size={13} className="text-slate-400" />
                                <span className="text-white font-bold">{liveSummary.count}</span>
                                <span className="text-slate-400">users</span>
                            </div>
                            <span className="h-4 w-px bg-slate-700 hidden sm:block" />
                            {liveSummary.credits > 0 && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <ArrowDownLeft size={13} className="text-emerald-400" />
                                    <span className="text-emerald-400 font-bold">+₹{fmt(liveSummary.credits)}</span>
                                    <span className="text-slate-500">credits</span>
                                </div>
                            )}
                            {liveSummary.debits < 0 && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <ArrowUpRight size={13} className="text-red-400" />
                                    <span className="text-red-400 font-bold">−₹{fmt(Math.abs(liveSummary.debits))}</span>
                                    <span className="text-slate-500">debits</span>
                                </div>
                            )}
                            <span className="h-4 w-px bg-slate-700 hidden sm:block" />
                            <div className="flex items-center gap-1.5 text-sm">
                                <Wallet size={13} className="text-emerald-400" />
                                <span className="text-slate-400">Net:</span>
                                <span className={`font-bold ${liveSummary.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtSigned(liveSummary.net)}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setConfirmOpen(true)}
                            disabled={applying}
                            className="shrink-0 flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors shadow-lg"
                        >
                            {applying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {applying ? "Applying..." : "Approve & Apply"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Confirm Modal ── */}
            {confirmOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Confirm Settlement</h3>
                                <p className="text-sm text-slate-400">This will update live wallet balances.</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Users affected</span>
                                <span className="text-white font-bold">{liveSummary.count}</span>
                            </div>
                            {liveSummary.credits > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Credits (wallet add)</span>
                                    <span className="text-emerald-400 font-bold">+₹{fmt(liveSummary.credits)}</span>
                                </div>
                            )}
                            {liveSummary.debits < 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Debits (wallet deduct)</span>
                                    <span className="text-red-400 font-bold">−₹{fmt(Math.abs(liveSummary.debits))}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-slate-700 pt-2 mt-1">
                                <span className="text-slate-400 font-medium">Net impact</span>
                                <span className={`font-bold ${liveSummary.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtSigned(liveSummary.net)}</span>
                            </div>
                        </div>

                        <p className="text-xs text-amber-300/70 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2 mb-5">
                            ⚠️ Changes are logged as MANUAL_CREDIT / MANUAL_DEBIT with full audit trail. Cannot be auto-reversed.
                        </p>

                        <div className="flex gap-3">
                            <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 border border-slate-600 text-slate-400 rounded-xl hover:bg-slate-700 transition-colors text-sm">Cancel</button>
                            <button onClick={handleApply} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors">Confirm & Apply</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
