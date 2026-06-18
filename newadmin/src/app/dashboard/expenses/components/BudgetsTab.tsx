"use client";

import React, { useEffect, useState } from 'react';
import { getBudgets, upsertBudget, deleteBudget, getExpenseCategories } from '@/actions/expenses';
import { Plus, Target, Trash2, Loader2 } from 'lucide-react';

export default function BudgetsTab() {
    const [budgets, setBudgets] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formCategory, setFormCategory] = useState<string>('');
    const [formLimit, setFormLimit] = useState('');
    const [formPeriod, setFormPeriod] = useState<'MONTHLY'|'QUARTERLY'|'YEARLY'>('MONTHLY');

    const fetchBudgetsAndCats = async () => {
        setLoading(true);
        try {
            const [bDocs, cDocs] = await Promise.all([
                getBudgets(),
                getExpenseCategories()
            ]);
            setBudgets(bDocs);
            setCategories(cDocs);
            if (cDocs.length > 0 && !formCategory) {
                setFormCategory(cDocs[0].slug);
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBudgetsAndCats();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formLimit || !formCategory) return;
        setSaving(true);
        
        await upsertBudget({
            category: formCategory,
            limit: Number(formLimit),
            period: formPeriod,
        });

        await fetchBudgetsAndCats();
        setSaving(false);
        setShowForm(false);
        setFormLimit('');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this budget limit?')) return;
        await deleteBudget(id);
        await fetchBudgetsAndCats();
    };

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center relative z-10">
                <h3 className="text-xl font-semibold text-white">Active Limit Trackers</h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                    <Plus size={16} /> New Tracking Limit
                </button>
            </div>

            {showForm && (
                <div className="bg-slate-800/80 border border-violet-500/30 p-5 rounded-xl mt-4 animate-in fade-in slide-in-from-top-4">
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 font-semibold uppercase">Tracking Schema</label>
                            <select 
                                value={formCategory} 
                                onChange={(e) => setFormCategory(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none"
                            >
                                {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 font-semibold uppercase">Allocation Period</label>
                            <select 
                                value={formPeriod} 
                                onChange={(e) => setFormPeriod(e.target.value as any)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none"
                            >
                                <option value="MONTHLY">Monthly Refresh</option>
                                <option value="QUARTERLY">Quarterly Refresh</option>
                                <option value="YEARLY">Annual Allocation</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 font-semibold uppercase">Limit Amount (₹)</label>
                            <input 
                                type="number" 
                                value={formLimit} 
                                onChange={(e) => setFormLimit(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none"
                                placeholder="e.g. 50000"
                                required 
                            />
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 flex-1">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm flex-1 flex justify-center items-center">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Map Budget'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-violet-500" /></div>
            ) : budgets.length === 0 ? (
                <div className="text-center py-20 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                    <Target size={32} className="mx-auto mb-3 opacity-20" />
                    <p>No schemas tracked with budget limits.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {budgets.map(b => {
                        const pct = Math.min((b.spent / b.limit) * 100, 100);
                        const isDanger = pct > b.alertThreshold;
                        const catDef = categories.find(c => c.slug === b.category);

                        return (
                            <div key={b._id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-xs font-bold text-violet-400 mb-1">{b.period} ALLOCATION ({b.periodLabel})</p>
                                        <h4 className="text-base font-bold text-white uppercase tracking-wider">{catDef ? catDef.name : b.category} Tracking</h4>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleDelete(b._id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Consumed: <span className="text-white font-mono">{formatCurrency(b.spent)}</span></span>
                                        <span className="text-slate-400 flex items-center gap-1">
                                            Limit: <span className="text-white font-mono">{formatCurrency(b.limit)}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${isDanger ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${pct}%` }} 
                                    />
                                </div>
                                <div className="mt-2 text-right">
                                    <span className={`text-xs font-bold ${isDanger ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {pct.toFixed(1)}% Bound Used
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
