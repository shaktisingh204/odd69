"use client";

import Link from "next/link";
import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { getReferralStats, getReferralHistory, getAdminReferralUsers } from "@/actions/internal-referral";
import {
    ArrowRight,
    BadgeIndianRupee,
    CheckCircle2,
    Gift,
    Loader2,
    RefreshCcw,
    Search,
    ShieldCheck,
    Trophy,
    Users,
} from "lucide-react";

const USER_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 8;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
    return currencyFormatter.format(value || 0);
}

function formatDate(value: string) {
    return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getConditionLabel(condition: string | null) {
    const labels: Record<string, string> = {
        SIGNUP: "Signup",
        DEPOSIT_FIRST: "First Deposit",
        DEPOSIT_RECURRING: "Recurring Deposit",
        BET_VOLUME: "Bet Volume",
    };

    if (!condition) return "Referral Reward";
    return labels[condition] || condition.replace(/_/g, " ");
}

function getStatusClass(status: string) {
    switch (status) {
        case "COMPLETED":
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        case "PENDING":
            return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        default:
            return "bg-slate-700/60 text-slate-300 border-slate-600";
    }
}

function PaginationControls({
    page,
    totalPages,
    onPrev,
    onNext,
}: {
    page: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
}) {
    return (
        <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3 text-xs text-slate-400">
            <button
                onClick={onPrev}
                disabled={page <= 1}
                className="rounded-lg border border-slate-700 px-3 py-1.5 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
                Previous
            </button>
            <span>
                Page {page} of {Math.max(totalPages, 1)}
            </span>
            <button
                onClick={onNext}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-700 px-3 py-1.5 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
                Next
            </button>
        </div>
    );
}

export default function AffiliatesPage() {
    // ── Local stats shape from internal action ─────────────────────────────────
    const [stats, setStats] = useState<{
        totalReferrals: number;
        completedReferrals: number;
        pendingReferrals: number;
        failedReferrals: number;
        totalPaidOut: number;
    } | null>(null);
    const [topReferrers, setTopReferrers] = useState<{
        referrerId: number;
        username: string;
        email: string;
        referralCount: number;
        totalEarned: number;
    }[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [usersPage, setUsersPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [usersTotalPages, setUsersTotalPages] = useState(1);
    const [historyTotalPages, setHistoryTotalPages] = useState(1);
    const [query, setQuery] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [statsLoading, setStatsLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const result = await getReferralStats();
            if (result.success) {
                setStats(result.stats);
                setTopReferrers(result.topReferrers);
            } else {
                setError("Unable to load referral overview right now.");
            }
        } catch (loadError) {
            console.error("Failed to fetch referral stats", loadError);
            setError("Unable to load referral overview right now.");
        } finally {
            setStatsLoading(false);
        }
    }, []);

    const loadUsers = useCallback(async (page: number, search: string) => {
        setUsersLoading(true);
        try {
            const data = await getAdminReferralUsers(page, USER_PAGE_SIZE, search);
            setUsers(data.users as any[]);
            setUsersTotalPages(data.pagination.totalPages);
        } catch (loadError) {
            console.error("Failed to fetch referral users", loadError);
            setError("Unable to load referral users right now.");
        } finally {
            setUsersLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async (page: number) => {
        setHistoryLoading(true);
        try {
            const result = await getReferralHistory(page, HISTORY_PAGE_SIZE);
            if (result.success) {
                setHistory(result.history);
                setHistoryTotalPages(result.pagination.totalPages);
            } else {
                setError("Unable to load referral reward history right now.");
            }
        } catch (loadError) {
            console.error("Failed to fetch referral history", loadError);
            setError("Unable to load referral reward history right now.");
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    useEffect(() => {
        void loadUsers(usersPage, activeSearch);
    }, [usersPage, activeSearch, loadUsers]);

    useEffect(() => {
        void loadHistory(historyPage);
    }, [historyPage, loadHistory]);

    const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextSearch = query.trim();
        setUsersPage(1);
        setActiveSearch(nextSearch);
        await loadUsers(1, nextSearch);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        setError(null);
        await Promise.all([
            loadStats(),
            loadUsers(usersPage, activeSearch),
            loadHistory(historyPage),
        ]);
        setRefreshing(false);
    };

    const totalCommission = stats?.totalPaidOut || 0;
    const totalReferrals = stats?.totalReferrals || 0;
    const averageCommission = totalReferrals > 0 ? totalCommission / totalReferrals : 0;
    const topAffiliate = topReferrers[0] || null;

    if (statsLoading && usersLoading && historyLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
                <Loader2 className="mr-2 animate-spin" size={18} />
                Loading referral workspace...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                        <Gift size={14} />
                        Refer &amp; Earn
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-white">Referral Operations</h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-400">
                        Monitor partner performance, search referral relationships, and review every payout from one place.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/dashboard/affiliates/rewards"
                        className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-400"
                    >
                        <ShieldCheck size={16} />
                        Manage Reward Rules
                    </Link>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                        Refresh Data
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        label: "Total Referred Users",
                        value: totalReferrals.toLocaleString("en-IN"),
                        sub: "Users linked to a referrer",
                        icon: Users,
                        shell: "bg-blue-500/10 text-blue-400",
                    },
                    {
                        label: "Commission Paid",
                        value: formatCurrency(totalCommission),
                        sub: "Completed referral rewards",
                        icon: BadgeIndianRupee,
                        shell: "bg-emerald-500/10 text-emerald-400",
                    },
                    {
                        label: "Average Reward",
                        value: formatCurrency(averageCommission),
                        sub: "Average commission per referred user",
                        icon: CheckCircle2,
                        shell: "bg-violet-500/10 text-violet-400",
                    },
                    {
                        label: "Top Performer",
                        value: topAffiliate?.username || "No data yet",
                        sub: topAffiliate ? `${topAffiliate.referralCount} referrals • ${formatCurrency(topAffiliate.totalEarned)}` : "Waiting for first payout",
                        icon: Trophy,
                        shell: "bg-amber-500/10 text-amber-400",
                    },
                ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                                <p className="mt-3 text-2xl font-bold text-white">{item.value}</p>
                                <p className="mt-1 text-xs text-slate-400">{item.sub}</p>
                            </div>
                            <div className={`rounded-xl p-3 ${item.shell}`}>
                                <item.icon size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1.4fr]">
                <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Top Referrers</h2>
                            <p className="text-xs text-slate-400">Best performing affiliates by commission earned.</p>
                        </div>
                        <Link href="/dashboard/affiliates/rewards" className="text-xs font-semibold text-orange-300 transition-colors hover:text-orange-200">
                            Reward rules
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left text-sm">
                            <thead className="bg-slate-900/50 text-xs uppercase tracking-[0.18em] text-slate-500">
                                <tr>
                                    <th className="px-5 py-3">Affiliate</th>
                                    <th className="px-5 py-3">Referrals</th>
                                    <th className="px-5 py-3">Earned</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {topReferrers.length ? (
                                    topReferrers.map((affiliate) => (
                                        <tr key={affiliate.referrerId} className="hover:bg-slate-700/20">
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-white">{affiliate.username}</div>
                                                <div className="text-xs text-slate-500">{affiliate.email || "No email on file"}</div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-300">{affiliate.referralCount.toLocaleString("en-IN")}</td>
                                            <td className="px-5 py-4 font-semibold text-emerald-400">{formatCurrency(affiliate.totalEarned)}</td>
                                            <td className="px-5 py-4 text-right">
                                                <Link
                                                    href={`/dashboard/users/${affiliate.referrerId}`}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-300 transition-colors hover:text-orange-200"
                                                >
                                                    Open profile
                                                    <ArrowRight size={12} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                                            No affiliate payouts yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
                    <div className="border-b border-slate-700 px-5 py-4">
                        <h2 className="text-lg font-semibold text-white">Recent Reward History</h2>
                        <p className="text-xs text-slate-400">Every completed or pending referral payout from the backend ledger.</p>
                    </div>

                    {historyLoading ? (
                        <div className="flex min-h-[260px] items-center justify-center text-slate-400">
                            <Loader2 className="mr-2 animate-spin" size={16} />
                            Loading reward history...
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[620px] text-left text-sm">
                                    <thead className="bg-slate-900/50 text-xs uppercase tracking-[0.18em] text-slate-500">
                                        <tr>
                                            <th className="px-5 py-3">Reward</th>
                                            <th className="px-5 py-3">Users</th>
                                            <th className="px-5 py-3">Amount</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {history.length ? (
                                            history.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-slate-700/20">
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-white">{item.reward?.name || item.rewardName || "Referral Reward"}</div>
                                                        <div className="text-xs text-slate-500">{getConditionLabel(item.reward?.conditionType || item.condition || null)}</div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="text-slate-200">{item.referrer?.username || item.referrer || "Unknown referrer"}</div>
                                                        <div className="text-xs text-slate-500">for {item.referredUser?.username || item.referee || "Unknown user"}</div>
                                                    </td>
                                                    <td className="px-5 py-4 font-semibold text-emerald-400">{formatCurrency(item.amount)}</td>
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(item.status)}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-xs text-slate-400">{formatDate(item.createdAt)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                                                    No referral reward history found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls
                                page={historyPage}
                                totalPages={historyTotalPages}
                                onPrev={() => setHistoryPage((page) => Math.max(1, page - 1))}
                                onNext={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
                            />
                        </>
                    )}
                </section>
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
                <div className="flex flex-col gap-4 border-b border-slate-700 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Referral Users</h2>
                        <p className="text-xs text-slate-400">Search by username, email, or referral code and open the user profile directly.</p>
                    </div>

                    <form onSubmit={handleSearch} className="flex w-full max-w-xl gap-2">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search username, email, or referral code"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-10 py-2.5 text-sm text-white outline-none transition-colors focus:border-orange-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-600"
                        >
                            Search
                        </button>
                    </form>
                </div>

                {usersLoading ? (
                    <div className="flex min-h-[320px] items-center justify-center text-slate-400">
                        <Loader2 className="mr-2 animate-spin" size={16} />
                        Loading referral users...
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[920px] text-left text-sm">
                                <thead className="bg-slate-900/50 text-xs uppercase tracking-[0.18em] text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3">User</th>
                                        <th className="px-5 py-3">Referred By</th>
                                        <th className="px-5 py-3">Referral Code</th>
                                        <th className="px-5 py-3">Invited</th>
                                        <th className="px-5 py-3">Earned</th>
                                        <th className="px-5 py-3">Joined</th>
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {users.length ? (
                                        users.map((user) => (
                                            <tr key={user.id} className="hover:bg-slate-700/20">
                                                <td className="px-5 py-4">
                                                    <div className="font-semibold text-white">{user.username}</div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {user.referrer ? (
                                                        <Link href={`/dashboard/users/${user.referrer.id}`} className="text-slate-200 transition-colors hover:text-orange-300">
                                                            {user.referrer.username}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-slate-500">Direct signup</span>
                                                    )}
                                                    <div className="text-xs text-slate-500">{user.referrer?.code || "No referrer code"}</div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-xs text-orange-300">
                                                        {user.referralCode || "Not generated"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-slate-300">{user.totalInvited.toLocaleString("en-IN")}</td>
                                                <td className="px-5 py-4 font-semibold text-emerald-400">{formatCurrency(user.totalEarned)}</td>
                                                <td className="px-5 py-4 text-xs text-slate-400">{formatDate(user.createdAt)}</td>
                                                <td className="px-5 py-4 text-right">
                                                    <Link
                                                        href={`/dashboard/users/${user.id}`}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-300 transition-colors hover:text-orange-200"
                                                    >
                                                        Open profile
                                                        <ArrowRight size={12} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                                                No referral users found for this search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls
                            page={usersPage}
                            totalPages={usersTotalPages}
                            onPrev={() => setUsersPage((page) => Math.max(1, page - 1))}
                            onNext={() => setUsersPage((page) => Math.min(usersTotalPages, page + 1))}
                        />
                    </>
                )}
            </section>
        </div>
    );
}
