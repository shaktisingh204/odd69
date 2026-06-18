"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Wallet, ShieldCheck, PieChart } from 'lucide-react';

export default function FinanceLandingPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Financial Management</h1>
                <p className="text-slate-400 mt-1">Manage deposits, withdrawals, and user balances.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link
                    href="/dashboard/finance/transactions"
                    className="p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-indigo-500 hover:bg-slate-800/80 transition-all group"
                >
                    <div className="w-12 h-12 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ArrowRightLeft size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Transactions</h3>
                    <p className="text-slate-400 text-sm">View all deposits and withdrawals. Approve or reject pending requests.</p>
                </Link>

                <Link
                    href="/dashboard/finance/adjustments"
                    className="p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500 hover:bg-slate-800/80 transition-all group"
                >
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Wallet size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Manual Adjustments</h3>
                    <p className="text-slate-400 text-sm">Manually credit or debit user accounts for bonuses, corrections, or penalties.</p>
                </Link>

                <Link
                    href="/dashboard/finance/deposit-settings"
                    className="p-6 bg-slate-800 rounded-xl border border-slate-700 hover:border-purple-500 hover:bg-slate-800/80 transition-all group"
                >
                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ShieldCheck size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Deposit & Withdrawal Settings</h3>
                    <p className="text-slate-400 text-sm">Configure payment gateways, limits, and processing rules.</p>
                </Link>

                <div className="p-6 bg-slate-800 rounded-xl border border-slate-700 opacity-50 cursor-not-allowed">
                    <div className="w-12 h-12 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                        <PieChart size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Financial Reports</h3>
                    <p className="text-slate-400 text-sm">Coming Soon. Detailed breakdown of GGR, NGR, and affiliate costs.</p>
                </div>
            </div>
        </div>
    );
}
