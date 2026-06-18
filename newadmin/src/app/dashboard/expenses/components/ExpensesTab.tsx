"use client";

import React, { useEffect, useState } from 'react';
import { getExpenses, createExpense, updateExpenseStatus, deleteExpense, ExpenseStatus, getExpenseCategories } from '@/actions/expenses';
import { Plus, CheckCircle, Search, Trash2, XCircle, Clock, Loader2, ListFilter, AlertCircle } from 'lucide-react';

export default function ExpensesTab() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    
    // filters
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [actingOn, setActingOn] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [data, cats] = await Promise.all([
                getExpenses(page, 20, search, categoryFilter, statusFilter),
                getExpenseCategories()
            ]);
            setExpenses(data.expenses);
            setCategories(cats);
            if (cats.length > 0 && !formData.category) {
                setFormData(prev => ({...prev, category: cats[0].slug}));
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, categoryFilter, statusFilter]);

    // Form
    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: '',
        vendor: '',
    });
    const [customData, setCustomData] = useState<Record<string, any>>({});

    const handleCategoryChange = (val: string) => {
        setFormData({ ...formData, category: val });
        setCustomData({}); // Reset custom data on schema switch
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate required custom fields
        const catSchema = categories.find(c => c.slug === formData.category);
        if (catSchema) {
            for (const f of catSchema.customFields) {
                if (f.required && !customData[f.name]) {
                    alert(`Required parameter missing: ${f.label}`);
                    return;
                }
            }
        }

        await createExpense({
            ...formData,
            amount: Number(formData.amount),
            customData,
            createdBy: 'Admin',
        });
        
        setShowForm(false);
        setFormData({ title: '', amount: '', category: categories[0]?.slug, vendor: '' });
        setCustomData({});
        fetchData();
    };

    const handleAction = async (id: string, status: ExpenseStatus) => {
        setActingOn(id);
        await updateExpenseStatus(id, status);
        await fetchData();
        setActingOn(null);
    };

    const handleDelete = async (id: string) => {
        if(!confirm('Are you sure you want to delete this expense completely?')) return;
        setActingOn(id);
        await deleteExpense(id);
        await fetchData();
        setActingOn(null);
    };

    const activeSchema = categories.find(c => c.slug === formData.category);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex gap-2 bg-slate-800 border border-slate-700 rounded-lg p-1 overflow-x-auto">
                    <button onClick={() => setStatusFilter('')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${statusFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Latest Flow</button>
                    <button onClick={() => setStatusFilter('PENDING')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'PENDING' ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:text-white'}`}>Approval Queue</button>
                    <button onClick={() => setStatusFilter('APPROVED')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'APPROVED' ? 'bg-blue-500/20 text-blue-500' : 'text-slate-400 hover:text-white'}`}>Settlements</button>
                </div>

                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Title / Vendor..." 
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                    >
                        <Plus size={16} /> Log Expense
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-slate-800 p-5 rounded-xl border border-violet-500/30 mb-6 animate-in slide-in-from-top-4 fade-in">
                    <h3 className="text-lg font-bold text-white mb-2">Record Base Expense Details</h3>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                            <div className="col-span-1 lg:col-span-2 space-y-1">
                                <label className="text-xs text-slate-400 uppercase font-semibold">Expense Title</label>
                                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-violet-500 placeholder-slate-600" placeholder="e.g. Server Hosting" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400 uppercase font-semibold">Schema / Category</label>
                                <select value={formData.category} onChange={e => handleCategoryChange(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                                    {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400 uppercase font-semibold">Amount (₹)</label>
                                <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-mono text-white focus:outline-none focus:border-violet-500 placeholder-slate-600" placeholder="e.g. 50000" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400 uppercase font-semibold">Vendor (Opt)</label>
                                <input type="text" value={formData.vendor} onChange={e => setFormData({...formData, vendor: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-violet-500 placeholder-slate-600" placeholder="Amazon, etc" />
                            </div>
                        </div>

                        {activeSchema && activeSchema.customFields.length > 0 && (
                            <div className="bg-slate-900/50 p-4 border border-slate-700 border-dashed rounded-lg">
                                <h4 className="flex items-center gap-2 text-xs uppercase font-bold text-violet-400 mb-4"><ListFilter size={14}/> Dynamic Field Extraction: {activeSchema.name}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {activeSchema.customFields.map((field: any) => (
                                        <div key={field.name} className="space-y-1">
                                            <label className="text-[11px] text-slate-400 uppercase font-semibold flex justify-between">
                                                {field.label} {field.required && <AlertCircle size={10} className="text-red-400"/> }
                                            </label>
                                            
                                            {field.type === 'SELECT' ? (
                                                <select value={customData[field.name] || ''} onChange={e => setCustomData({...customData, [field.name]: e.target.value})} required={field.required} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-violet-500">
                                                    <option value="">Select option</option>
                                                    {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            ) : field.type === 'DATE' ? (
                                                <input type="date" value={customData[field.name] || ''} onChange={e => setCustomData({...customData, [field.name]: e.target.value})} required={field.required} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                                            ) : (
                                                <input type={field.type === 'NUMBER' ? 'number' : 'text'} value={customData[field.name] || ''} onChange={e => setCustomData({...customData, [field.name]: e.target.value})} required={field.required} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-violet-500 placeholder-slate-700" placeholder={field.type === 'NUMBER' ? '0' : 'Value'} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-slate-700">
                            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800">
                                Cancel Operation
                            </button>
                            <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-2.5 text-sm font-bold tracking-wide uppercase transition-colors">Submit Flow Record</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 border-b border-slate-700 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                        <tr>
                            <th className="p-4">Reference Title</th>
                            <th className="p-4">Mapped Schema</th>
                            <th className="p-4">Amount / Valuation</th>
                            <th className="p-4">System Status</th>
                            <th className="p-4 text-right">Actions Flow</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {loading ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-500"><Loader2 className="animate-spin mx-auto"/></td></tr>
                        ) : expenses.length === 0 ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-500">No organizational records match parameters.</td></tr>
                        ) : expenses.map(exp => {
                            const catDef = categories.find(c => c.slug === exp.category);
                            
                            return (
                                <tr key={exp._id} className="hover:bg-slate-700/20 transition-colors">
                                    <td className="p-4">
                                        <p className="text-white font-medium mb-1">{exp.title}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                                            {new Date(exp.createdAt).toLocaleDateString()} 
                                            {exp.vendor ? ` • ${exp.vendor}` : ''}
                                        </p>
                                        
                                        {/* Display dynamic custom data pills */}
                                        {exp.customData && Object.keys(exp.customData).length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {Object.entries(exp.customData).map(([k, v]) => (
                                                    <span key={k} className="bg-slate-900 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded text-[9px] uppercase">
                                                        {k}: <span className="text-white font-bold">{String(v)}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className="bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2.5 py-1 rounded text-xs font-bold uppercase">{catDef ? catDef.name : exp.category}</span>
                                    </td>
                                    <td className="p-4 font-mono font-medium text-white text-lg">
                                        ₹{exp.amount.toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${
                                            exp.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                            exp.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                                            exp.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                            'bg-red-500/10 text-red-500 border-red-500/20'
                                        }`}>
                                            {exp.status}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {exp.status === 'PENDING' && (
                                                <>
                                                    <button onClick={() => handleAction(exp._id, 'APPROVED')} disabled={actingOn === exp._id} className="p-1.5 bg-blue-500/10 text-blue-500 rounded hover:bg-blue-500/20 transition-all" title="Approve">
                                                        <CheckCircle size={16}/>
                                                    </button>
                                                    <button onClick={() => handleAction(exp._id, 'REJECTED')} disabled={actingOn === exp._id} className="p-1.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-all" title="Reject">
                                                        <XCircle size={16}/>
                                                    </button>
                                                </>
                                            )}
                                            {exp.status === 'APPROVED' && (
                                                <button onClick={() => handleAction(exp._id, 'PAID')} disabled={actingOn === exp._id} className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded hover:bg-emerald-500/20 transition-all flex items-center gap-1 text-[10px] font-bold uppercase pr-2.5" title="Mark Settled">
                                                    <CheckCircle size={14}/> Settle
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(exp._id)} disabled={actingOn === exp._id} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all ml-4" title="Hard Delete Data">
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
