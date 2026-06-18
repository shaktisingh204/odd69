"use client";

import React, { useEffect, useState } from 'react';
import { getInvestments, createInvestment, updateInvestment, deleteInvestment, InvestmentStatus } from '@/actions/expenses';
import { Briefcase, Info, Plus, TrendingUp, Search, Loader2, DollarSign, CheckCircle } from 'lucide-react';

export default function InvestmentsTab() {
    const [investments, setInvestments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    
    // filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchInvestments = async () => {
        setLoading(true);
        try {
            const data = await getInvestments(page, 20, search, statusFilter);
            setInvestments(data.investments);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchInvestments();
    }, [page, search, statusFilter]);

    // Form
    const [formData, setFormData] = useState({
        title: '',
        principal: '',
        platform: '',
        investedAt: new Date().toISOString().split('T')[0],
        returnRate: '',
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await createInvestment({
            title: formData.title,
            principal: Number(formData.principal),
            platform: formData.platform,
            investedAt: formData.investedAt,
            returnRate: Number(formData.returnRate) || 0,
            createdBy: 'Admin',
        });
        setShowForm(false);
        setFormData({ title: '', principal: '', platform: '', investedAt: new Date().toISOString().split('T')[0], returnRate: '' });
        fetchInvestments(); // Refresh
    };

    const handleMature = async (id: string, currentVal: number) => {
        if(!confirm('Mark this investment as matured?')) return;
        await updateInvestment(id, { status: 'MATURED', currentValue: currentVal, maturesAt: new Date().toISOString() });
        fetchInvestments();
    };

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
                    <button onClick={() => setStatusFilter('')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${statusFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>All</button>
                    <button onClick={() => setStatusFilter('ACTIVE')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'ACTIVE' ? 'bg-blue-500/20 text-blue-500' : 'text-slate-400 hover:text-white'}`}>Active</button>
                    <button onClick={() => setStatusFilter('MATURED')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'MATURED' ? 'bg-emerald-500/20 text-emerald-500' : 'text-slate-400 hover:text-white'}`}>Matured</button>
                    <button onClick={() => setStatusFilter('WITHDRAWN')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'WITHDRAWN' ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:text-white'}`}>Withdrawn</button>
                </div>

                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Find portfolio..." 
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        <Plus size={16} /> Add Position
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 mb-6 font-medium animate-in slide-in-from-top-4 fade-in">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Briefcase size={18} className="text-indigo-400"/> Map New Investment</h3>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                        <div className="col-span-1 lg:col-span-2">
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-semibold">Title</label>
                            <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none placeholder-slate-600" placeholder="e.g. Mutual Fund / Server Equity" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-semibold">Principal (₹)</label>
                            <input type="number" value={formData.principal} onChange={e => setFormData({...formData, principal: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none" placeholder="100000" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-semibold">Platform/Entity</label>
                            <input type="text" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none" placeholder="e.g. Zerodha" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-semibold">Date Invested</label>
                            <input type="date" value={formData.investedAt} onChange={e => setFormData({...formData, investedAt: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none" />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-2.5 text-sm">Save</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-12 flex justify-center"><Loader2 className="animate-spin text-slate-500"/></div>
                ) : investments.length === 0 ? (
                     <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">No investments mapped yet.</div>
                ) : investments.map(inv => {
                    const statusColors: Record<string, string> = {
                        ACTIVE: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                        MATURED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                        WITHDRAWN: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                        PENDING: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
                    };

                    const ReturnDiff = inv.currentValue - inv.principal;
                    const ReturnPct = (ReturnDiff / inv.principal) * 100;
                    const isPositive = ReturnDiff >= 0;

                    return (
                        <div key={inv._id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative group">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">{inv.title}</h4>
                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md border tracking-wider ${statusColors[inv.status]}`}>
                                    {inv.status}
                                </span>
                            </div>

                            <p className="text-xs text-slate-400 uppercase font-semibold mb-1 tracking-wider">Invested value</p>
                            <div className="flex justify-between items-end mb-4 font-mono">
                                <span className="text-xl text-white font-bold">{formatCurrency(inv.principal)}</span>
                                <span className="text-slate-500 text-sm">Via {inv.platform}</span>
                            </div>

                            <div className="bg-slate-900 rounded-lg p-3 mb-4 border border-slate-700 border-dashed">
                                <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider flex items-center justify-between mb-1.5">
                                    Current Value
                                    <span className={`flex items-center gap-0.5 text-xs font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isPositive ? '+' : ''}{ReturnPct.toFixed(1)}% <TrendingUp size={12}/>
                                    </span>
                                </p>
                                <span className="text-lg text-white font-bold font-mono">{formatCurrency(inv.currentValue)}</span>
                            </div>

                            <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-700 pt-4">
                                <span>{new Date(inv.investedAt).toLocaleDateString()}</span>
                                <div className="flex gap-2">
                                    {inv.status === 'ACTIVE' && (
                                        <button onClick={() => handleMature(inv._id, inv.currentValue)} className="text-emerald-500 font-bold uppercase tracking-wider hover:text-emerald-400 transition-colors flex items-center gap-1">
                                            <CheckCircle size={14}/> Mark Matured
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
