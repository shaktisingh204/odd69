"use client";

import React, { useEffect, useState } from 'react';
import { getUpiAccounts, upsertUpiAccount, deleteUpiAccount, getGatewayHistory, syncHistoricalGateways } from '@/actions/expenses';
import { Loader2, Plus, Trash2, Edit2, Activity, Smartphone, Link as LinkIcon, Download, Upload, Shield, XCircle, Banknote, Server, BatteryCharging, Battery, CheckCircle, AlertTriangle, CloudLightning } from 'lucide-react';
import { formatCurrencyParts } from '@/utils/transactionCurrency';

export default function UpiLedgerTab() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);

    const [viewingDrawer, setViewingDrawer] = useState<any | null>(null);
    const [drawerLogs, setDrawerLogs] = useState<any[]>([]);
    const [drawerLoading, setDrawerLoading] = useState(false);

    const [syncing, setSyncing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getUpiAccounts();
            setAccounts(data);
        } catch(e) { console.error(e) }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSync = async () => {
        if (!confirm('This will scan your entire Prisma database for past deposits and generate exact Ledger matches. Proceed?')) return;
        setSyncing(true);
        const res = await syncHistoricalGateways();
        setSyncing(false);
        if (res.success) {
            alert(`Auto-discovery complete! Discovered and mapped ${res.count} new unique nodes.`);
            fetchData();
        } else {
            alert('Failed to run sync engine.');
        }
    };

    const fetchHistory = async (name: string) => {
        setDrawerLoading(true);
        try {
            const logs = await getGatewayHistory(name);
            setDrawerLogs(logs);
        } catch(e) {}
        setDrawerLoading(false);
    }

    const handleCreateNew = () => {
        setEditingAccount({
            name: '',
            upiId: '',
            providerName: '',
            type: 'MANUAL',
            status: 'ACTIVE',
            limitAmount: 0,
            feePercent: 0,
        });
        setShowForm(true);
    };

    const handleEdit = (acc: any) => {
        setEditingAccount({ ...acc });
        setShowForm(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await upsertUpiAccount(editingAccount);
        setSaving(false);
        setShowForm(false);
        setEditingAccount(null);
        fetchData();
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}? This will stop future tracking.`)) return;
        await deleteUpiAccount(id);
        fetchData();
    };

    const openDrawer = (acc: any) => {
        setViewingDrawer(acc);
        setDrawerLogs([]);
        fetchHistory(acc.name);
    }

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

    // Compute Global Metrics
    const totalLinkedNodes = accounts.length;
    let netCapitalHeld = 0;
    let totalInwardsAll = 0;
    let totalOutwardsAll = 0;
    accounts.forEach(a => {
        netCapitalHeld += a.currentBalance;
        totalInwardsAll += a.totalDeposits;
        totalOutwardsAll += a.totalWithdrawals;
    });

    return (
        <div className="space-y-6">
            
            {/* Global Strip */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2"><Server className="text-emerald-400"/> Gateway Control Center</h3>
                    <p className="text-slate-400 text-sm mt-1">Real-time health, load distribution, and tracking for all internal nodes.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-slate-800 border border-slate-700/60 rounded-xl px-4 py-2">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Held Capital</p>
                        <p className={`text-xl font-bold font-mono ${netCapitalHeld >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(netCapitalHeld)}</p>
                    </div>
                    <button onClick={handleCreateNew} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 text-white px-5 py-3 rounded-xl text-sm flex items-center gap-2 font-bold tracking-wide transition-colors">
                        <Plus size={16}/> Map New Node
                    </button>
                </div>
            </div>

            {/* Editing Form */}
            {showForm && editingAccount && (
                <div className="bg-slate-800 p-6 rounded-2xl border border-emerald-500/30 animate-in fade-in slide-in-from-top-4 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Server size={120} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-5 relative z-10 flex items-center gap-2">
                        {editingAccount._id ? <Edit2 size={18} className="text-blue-400"/> : <Plus size={18} className="text-emerald-400"/>} 
                        {editingAccount._id ? 'Reconfigure Payment Node' : 'Initialize Target Node'}
                    </h3>
                    
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-5 relative z-10">
                        <div className="col-span-1 md:col-span-2 space-y-1">
                            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Internal Reference Name *</label>
                            <input type="text" value={editingAccount.name} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-colors" placeholder="e.g. NekPay Node 01" required 
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2 space-y-1">
                            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">UPI ID / Address / Endpoint URI *</label>
                            <input type="text" value={editingAccount.upiId} onChange={e => setEditingAccount({...editingAccount, upiId: e.target.value})} 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-emerald-400 font-mono focus:border-emerald-500 outline-none transition-colors" placeholder="e.g. gateway@hdfc" required 
                            />
                        </div>
                        
                        <div className="col-span-1 space-y-1">
                            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Provider/Brand</label>
                            <input type="text" value={editingAccount.providerName || ''} onChange={e => setEditingAccount({...editingAccount, providerName: e.target.value})} 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-colors" placeholder="e.g. Razorpay" 
                            />
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Node Category</label>
                            <select value={editingAccount.type} onChange={e => setEditingAccount({...editingAccount, type: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none">
                                <option value="MANUAL">Manual Settlement Bank</option>
                                <option value="GATEWAY">Automated Server API</option>
                            </select>
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Status</label>
                            <select value={editingAccount.status} onChange={e => setEditingAccount({...editingAccount, status: e.target.value})}
                                className={`w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none ${editingAccount.status === 'ACTIVE' ? 'text-emerald-400' : editingAccount.status === 'MAINTENANCE' ? 'text-amber-400' : 'text-slate-500'}`}>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="MAINTENANCE">MAINTENANCE</option>
                                <option value="DISABLED">DISABLED</option>
                            </select>
                        </div>
                        <div className="col-span-1 space-y-1">
                            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Fee Overlay (%)</label>
                            <div className="relative">
                                <input type="number" step="0.01" value={editingAccount.feePercent || 0} onChange={e => setEditingAccount({...editingAccount, feePercent: parseFloat(e.target.value) || 0})} 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-8 py-3 text-sm text-white font-mono focus:border-amber-500 outline-none" placeholder="0" 
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-1">
                            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1"><Shield size={12}/> Capacity Tracking Limit (₹) <span className="font-normal normal-case text-slate-600">(visual progress)</span></label>
                            <input type="number" value={editingAccount.limitAmount || 0} onChange={e => setEditingAccount({...editingAccount, limitAmount: parseFloat(e.target.value) || 0})} 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-emerald-500 outline-none transition-colors" placeholder="e.g. 5000000" 
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 flex items-end gap-3 pt-5">
                            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 border border-slate-700 rounded-xl text-slate-400 font-bold hover:bg-slate-700 hover:text-white transition-colors text-sm tracking-wide">CANCEL</button>
                            <button type="submit" disabled={saving} className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded-xl text-white font-bold tracking-widest text-sm disabled:opacity-50 transition-all uppercase flex items-center justify-center gap-2">
                                {saving ? <Loader2 size={16} className="animate-spin"/> : <><Server size={16}/> Initialize Node</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Gateway Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {loading ? (
                    <div className="col-span-full py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
                ) : accounts.length === 0 ? (
                    <div className="col-span-full py-24 border-2 border-dashed border-slate-700/50 rounded-2xl flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <CloudLightning size={200} />
                        </div>
                        <Server size={48} className="mb-4 opacity-20" />
                        <h4 className="text-lg font-bold text-white mb-2 relative z-10">No active nodes located.</h4>
                        <p className="text-sm mb-6 relative z-10">Click "Map New Node" or let the engine pull your historical deposits to automatically map previous activity.</p>
                        
                        <button 
                            onClick={handleSync} 
                            disabled={syncing}
                            className="relative z-10 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50 text-sm uppercase"
                        >
                            {syncing ? <Loader2 size={18} className="animate-spin" /> : <CloudLightning size={18} />}
                            {syncing ? 'Scanning Prisma History...' : 'Auto-Discover Historical Data'}
                        </button>
                    </div>
                ) : (
                    accounts.map(acc => {
                        const usageRatio = acc.limitAmount && acc.limitAmount > 0 ? Math.min((acc.totalDeposits / acc.limitAmount) * 100, 100) : 0;
                        const isNearingLimit = usageRatio > 80;
                        const isMaxedOut = usageRatio === 100;

                        return (
                        <div key={acc._id} onClick={() => openDrawer(acc)} className="bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-2xl p-5 cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all group overflow-hidden relative">
                            {/* Card Status Indicator */}
                            <div className="absolute top-0 left-0 w-full h-1">
                                <div className={`h-full ${acc.status === 'ACTIVE' ? 'bg-gradient-to-r from-emerald-500 to-emerald-300' : acc.status === 'MAINTENANCE' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                            </div>

                            <div className="flex justify-between items-start mb-4">
                                <div className="max-w-[80%]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-white text-lg truncate" title={acc.name}>
                                            {acc.name} 
                                        </h4>
                                        {acc.type === 'GATEWAY' && <span title="Automated API Gateway Node"><Activity size={14} className="text-blue-400 shrink-0"/></span>}
                                    </div>
                                    <p className="text-[11px] text-emerald-300/80 font-mono tracking-wider truncate">{acc.upiId}</p>
                                </div>
                                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-700 group-hover:bg-slate-700 transition-colors">
                                    <LinkIcon size={14} className="text-slate-400 group-hover:text-emerald-400" />
                                </div>
                            </div>

                            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700 mb-5 relative group-hover:bg-slate-900 transition-colors">
                                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1.5 flex items-center gap-1.5">
                                    {acc.status === 'ACTIVE' ? <CheckCircle size={10} className="text-emerald-500"/> : acc.status === 'MAINTENANCE' ? <Loader2 size={10} className="text-amber-500 animate-spin"/> : <XCircle size={10} className="text-slate-500"/>}
                                    Live Settlement Status 
                                </p>
                                <p className={`text-2xl font-bold font-mono tracking-tight ${acc.currentBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                    {formatCurrency(acc.currentBalance)}
                                </p>
                            </div>

                            {/* Capacity Tracking Bar */}
                            {acc.limitAmount > 0 && (
                                <div className="mb-5">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                                            {isMaxedOut ? <AlertTriangle size={10} className="text-red-400"/> : isNearingLimit ? <Battery size={10} className="text-amber-400"/> : <BatteryCharging size={10} className="text-emerald-400"/>}
                                            Traffic Load Threshold
                                        </p>
                                        <span className="text-[10px] text-slate-300 font-mono">{usageRatio.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700/50">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${isMaxedOut ? 'bg-red-500' : isNearingLimit ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                            style={{ width: `${usageRatio}%`}}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex bg-slate-900/40 rounded-lg p-2 divide-x divide-slate-700/50 border border-slate-700/30">
                                <div className="w-1/2 px-2">
                                    <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1"><Download size={10} className="text-emerald-400"/> Total IN</p>
                                    <p className="text-xs text-slate-300 font-mono font-medium truncate" title={acc.totalDeposits.toString()}>{formatCurrencyParts({ fiat: acc.totalDeposits, crypto: 0 })}</p>
                                </div>
                                <div className="w-1/2 px-2">
                                    <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1"><Upload size={10} className="text-amber-400"/> Total OUT</p>
                                    <p className="text-xs text-slate-300 font-mono font-medium truncate" title={acc.totalWithdrawals.toString()}>{formatCurrencyParts({ fiat: acc.totalWithdrawals, crypto: 0 })}</p>
                                </div>
                            </div>
                        </div>
                        )
                    })
                )}
            </div>

            {/* Master Detail Side Drawer */}
            {viewingDrawer && (
                <>
                    <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity" onClick={() => setViewingDrawer(null)} />
                    <div className="fixed top-0 right-0 h-[100dvh] w-full md:w-[500px] bg-slate-900 border-l border-slate-700 flex flex-col z-50 animate-in slide-in-from-right shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        {/* Drawer Header */}
                        <div className="px-6 py-5 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Server size={18} className="text-emerald-400" /> Node Trace Center
                                </h3>
                                <p className="text-[11px] text-slate-400 font-mono tracking-widest mt-1 uppercase">ID: {viewingDrawer._id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { handleEdit(viewingDrawer); setViewingDrawer(null); }} className="p-2 bg-slate-700/50 hover:bg-slate-700 text-emerald-400 rounded-lg transition-colors border border-emerald-500/20" title="Reconfigure Node">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => { handleDelete(viewingDrawer._id, viewingDrawer.name); setViewingDrawer(null); }} className="p-2 bg-slate-700/50 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20" title="Delete Node">
                                    <Trash2 size={16} />
                                </button>
                                <button onClick={() => setViewingDrawer(null)} className="p-2 text-slate-500 hover:text-white transition-colors ml-2">
                                    <XCircle size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Drawer Core Info */}
                        <div className="p-6 border-b border-slate-800 bg-slate-800/20">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Target Name</p>
                                    <p className="text-lg font-bold text-white leading-tight">{viewingDrawer.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Current Balance</p>
                                    <p className={`text-xl font-mono font-bold ${viewingDrawer.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(viewingDrawer.currentBalance)}</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 rounded-xl p-3 border border-slate-700">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Provider Config</p>
                                    <p className="text-sm text-slate-300 font-medium">{viewingDrawer.providerName || 'Generic Core'}</p>
                                </div>
                                <div className="bg-slate-900 rounded-xl p-3 border border-slate-700">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Processing Overhead</p>
                                    <p className="text-sm text-amber-400 font-mono font-bold">{viewingDrawer.feePercent}% Base Fee</p>
                                </div>
                            </div>
                        </div>

                        {/* Transaction History Log Component */}
                        <div className="flex-1 overflow-y-auto bg-slate-900 relative">
                            <div className="sticky top-0 bg-slate-900 px-6 py-4 border-b border-slate-800 z-10 flex justify-between items-center shadow-md">
                                <p className="text-xs text-white uppercase tracking-widest font-bold flex items-center gap-2">
                                    <Activity size={12} className="text-emerald-500"/> Activity Trace Log
                                </p>
                                <p className="text-[10px] text-slate-500 italic">Last 100 entries</p>
                            </div>

                            <div className="px-6 py-2">
                                {drawerLoading ? (
                                    <div className="flex justify-center flex-col items-center py-20 text-slate-500">
                                        <Loader2 className="animate-spin mb-3 text-emerald-500" size={32} />
                                        <p className="text-xs uppercase tracking-wider">Accessing Node Database...</p>
                                    </div>
                                ) : drawerLogs.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Banknote size={48} className="mx-auto text-slate-700 mb-4" />
                                        <p className="text-sm text-slate-400">Node has not seen any authenticated traffic.</p>
                                    </div>
                                ) : (
                                    <div className="relative border-l-2 border-slate-800 ml-4 space-y-6 py-6">
                                        {drawerLogs.map((log, idx) => {
                                            const isDeposit = log.destination === viewingDrawer.name; // User dropped money IN
                                            return (
                                                <div key={log._id || idx} className="relative pl-6">
                                                    {/* Timeline Dot */}
                                                    <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-slate-900 ${isDeposit ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    
                                                    <div className="bg-slate-800 border-l border-b border-r border-slate-700 rounded-r-xl rounded-b-xl p-4 shadow-xl -mt-2">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${isDeposit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                    {isDeposit ? 'INWARD CLEARING' : 'OUTWARD SETTLEMENT'}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                                                            </div>
                                                            <p className={`font-mono font-bold ${isDeposit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {isDeposit ? '+' : '-'}{formatCurrency(log.amount)}
                                                            </p>
                                                        </div>
                                                        <p className="text-white text-sm font-medium mb-1">{log.title}</p>
                                                        <div className="bg-slate-900/50 p-2.5 rounded-lg -mx-1 mt-2 border border-slate-700/50">
                                                            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                                                                <span className="text-slate-500 uppercase font-bold tracking-wider">{isDeposit ? 'From Sender:' : 'To Profile:'}</span> 
                                                                <span className="text-slate-200">{isDeposit ? log.source : log.destination}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </>
            )}

        </div>
    );
}
