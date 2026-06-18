"use client";

import React, { useState } from 'react';
import { Receipt, DollarSign, Activity, Briefcase, Target, Layers } from 'lucide-react';
import OverviewTab from './components/OverviewTab';
import BudgetsTab from './components/BudgetsTab';
import ExpensesTab from './components/ExpensesTab';
import FundFlowTab from './components/FundFlowTab';
import InvestmentsTab from './components/InvestmentsTab';
import SettingsTab from './components/SettingsTab';
import UpiLedgerTab from './components/UpiLedgerTab';

export default function ExpensesPage() {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXPENSES' | 'FUND_FLOW' | 'INVESTMENTS' | 'BUDGETS' | 'SETTINGS' | 'UPI_LEDGER'>('OVERVIEW');

    const tabs = [
        { id: 'OVERVIEW', label: 'Overview', icon: Activity },
        { id: 'EXPENSES', label: 'Expenses', icon: Receipt },
        { id: 'FUND_FLOW', label: 'Fund Flow', icon: DollarSign },
        { id: 'UPI_LEDGER', label: 'Gateways Ledger', icon: Layers },
        { id: 'INVESTMENTS', label: 'Investments', icon: Briefcase },
        { id: 'BUDGETS', label: 'Budgets', icon: Target },
        { id: 'SETTINGS', label: 'Category Schema', icon: Activity },
    ] as const;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                        Corporate Finance & Expenses
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Comprehensive tracking of company fund flows, expenses, and investments.
                    </p>
                </div>
            </div>

            {/* Global Tabs Navigation */}
            <div className="flex space-x-1 overflow-x-auto border-b border-white/[0.06] pb-px scrollbar-hide">
                {tabs.map(tab => {
                    const active = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-all ${
                                active
                                    ? 'border-violet-500 text-violet-400'
                                    : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
                            }`}
                        >
                            <Icon size={16} className={active ? 'text-violet-400' : 'text-slate-500'} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Contents */}
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {activeTab === 'OVERVIEW' && <OverviewTab />}
                {activeTab === 'EXPENSES' && <ExpensesTab />}
                {activeTab === 'FUND_FLOW' && <FundFlowTab />}
                {activeTab === 'UPI_LEDGER' && <UpiLedgerTab />}
                {activeTab === 'INVESTMENTS' && <InvestmentsTab />}
                {activeTab === 'BUDGETS' && <BudgetsTab />}
                {activeTab === 'SETTINGS' && <SettingsTab />}
            </div>
        </div>
    );
}
