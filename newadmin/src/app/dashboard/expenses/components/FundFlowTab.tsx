"use client";

import React, { useEffect, useState } from 'react';
import { getFundFlows, createFundFlow, deleteFundFlow, FundFlowType } from '@/actions/expenses';
import { Plus, ArrowDownLeft, ArrowUpRight, Repeat, Trash2, Search, Loader2 } from 'lucide-react';

export default function FundFlowTab() {
    const [flows, setFlows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    
    // filters
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const fetchFlows = async () => {
        setLoading(true);
        try {
            const data = await getFundFlows(page, 20, search, typeFilter);
            setFlows(data.flows);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchFlows();
    }, [page, search, typeFilter]);

    // Form
    const [formData, setFormData] = useState({
        type: 'INFLOW' as FundFlowType,
        title: '',
        amount: '',
        source: '',
        destination: '',
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await createFundFlow({
            type: formData.type,
            title: formData.title,
            amount: Number(formData.amount),
            source: formData.source,
            destination: formData.destination,
            createdBy: 'Admin', // In real system, this would come from user session
        });
        setShowForm(false);
        setFormData({ type: 'INFLOW', title: '', amount: '', source: '', destination: '' });
        fetchFlows();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this record?')) return;
        await deleteFundFlow(id);
        fetchFlows();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
                    <button onClick={() => setTypeFilter('')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${typeFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>All</button>
                    <button onClick={() => setTypeFilter('INFLOW')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${typeFilter === 'INFLOW' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>Inflows</button>
                    <button onClick={() => setTypeFilter('OUTFLOW')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${typeFilter === 'OUTFLOW' ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white'}`}>Outflows</button>
                </div>

                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search flows..." 
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        <Plus size={16} /> Add Flow
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">Record New Fund Flow</h3>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-semibold">Type</label>
                            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as FundFlowType})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none">
                                <option value="INFLOW">Inflow</option>
                                <option value="OUTFLOW">Outflow</option>
                                <option value="TRANSFER">Transfer</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-semibold">Title</label>
                            <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none placeholder-slate-600" placeholder="e.g. Funding from VC" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-semibold">Amount (₹)</label>
                            <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none" placeholder="100000" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-semibold">Source/Dest.</label>
                            <input type="text" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none placeholder-slate-600" placeholder="Bank Acc / Platform" />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-2.5 text-sm font-medium">Save</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 border-b border-slate-700 text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="p-4">Type</th>
                            <th className="p-4">Details</th>
                            <th className="p-4">Source/Destination</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin text-slate-500 mx-auto" /></td></tr>
                        ) : flows.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No flow records found.</td></tr>
                        ) : flows.map(flow => (
                            <tr key={flow._id} className="hover:bg-white/[0.02]">
                                <td className="p-4">
                                    {flow.type === 'INFLOW' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium text-xs"><ArrowDownLeft size={14}/> Inflow</span>}
                                    {flow.type === 'OUTFLOW' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-500/10 text-red-400 font-medium text-xs"><ArrowUpRight size={14}/> Outflow</span>}
                                    {flow.type === 'TRANSFER' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 font-medium text-xs"><Repeat size={14}/> Transfer</span>}
                                </td>
                                <td className="p-4">
                                    <p className="text-white font-medium">{flow.title}</p>
                                    <p className="text-xs text-slate-500 mt-1">{new Date(flow.createdAt).toLocaleDateString()}</p>
                                </td>
                                <td className="p-4">
                                    <p className="text-slate-300">{flow.source || flow.destination || 'N/A'}</p>
                                </td>
                                <td className="p-4 font-mono font-medium text-white">
                                    ₹{flow.amount.toLocaleString()}
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => handleDelete(flow._id)} className="text-slate-500 hover:text-red-400 transition-colors p-2"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
