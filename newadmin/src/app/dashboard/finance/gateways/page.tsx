"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '@/actions/admins';
import { getSystemConfig, updateSystemConfig } from '@/actions/settings';
import { Plus, Edit2, Trash2, Power, PowerOff, Save, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

interface PaymentMethod {
    id: number;
    name: string;
    type: string;
    minAmount: number;
    maxAmount: number;
    fee: number;
    feeType: string;
    isActive: boolean;
    details: any;
}

// All UPI gateways that can be toggled
const GATEWAY_DEFS = [
    { key: 'UPI1_ENABLED', label: 'UPI Gateway 1', nameKey: 'UPI1_NAME' },
    { key: 'UPI2_ENABLED', label: 'UPI Gateway 2', nameKey: 'UPI2_NAME' },
    { key: 'UPI3_ENABLED', label: 'UPI Gateway 3', nameKey: 'UPI3_NAME' },
    { key: 'UPI4_ENABLED', label: 'UPI Gateway 4', nameKey: 'UPI4_NAME' },
    { key: 'UPI5_ENABLED', label: 'UPI Gateway 5', nameKey: 'UPI5_NAME' },
    { key: 'UPI6_ENABLED', label: 'UPI Gateway 6', nameKey: 'UPI6_NAME' },
    { key: 'UPI9_ENABLED', label: 'UPI Gateway 9 (UltraPay)', nameKey: 'UPI9_NAME' },
    { key: 'CASHFREE_ENABLED', label: 'Cashfree Gateway', nameKey: 'CASHFREE_NAME' },
] as const;

// A-Pay (Gateway 6) payment types that can be toggled individually
const APAY_PAYMENT_TYPES = [
    { key: 'upi_link',     label: 'UPI Link' },
    { key: 'upi_push',     label: 'UPI Push' },
    { key: 'upi_fast_vip', label: 'UPI Fast VIP' },
    { key: 'upi_fast_qr',  label: 'UPI Fast QR' },
    { key: 'imps',         label: 'IMPS' },
    { key: 'paytm',        label: 'Paytm' },
    { key: 'phonepe',      label: 'PhonePe' },
] as const;

export default function PaymentMethodsPage() {
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Gateway toggle state
    const [gatewayStates, setGatewayStates] = useState<Record<string, boolean>>({});
    const [gatewayNames, setGatewayNames] = useState<Record<string, string>>({});
    const [gatewayLoading, setGatewayLoading] = useState(true);
    const [togglingKey, setTogglingKey] = useState<string | null>(null);

    // A-Pay payment type toggles
    const [apayTypes, setApayTypes] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        APAY_PAYMENT_TYPES.forEach((t) => (init[t.key] = true));
        return init;
    });
    const [apayLoading, setApayLoading] = useState(true);
    const [apaySaving, setApaySaving] = useState(false);

    const [formData, setFormData] = useState<Partial<PaymentMethod>>({
        name: '',
        type: 'DEPOSIT',
        minAmount: 0,
        maxAmount: 0,
        fee: 0,
        feeType: 'PERCENTAGE',
        isActive: true,
        details: {}
    });

    const fetchMethods = async () => {
        setLoading(true);
        const res = await getPaymentMethods();
        if (res.success) setMethods(res.data as PaymentMethod[]);
        setLoading(false);
    };

    const fetchGatewayStates = async () => {
        setGatewayLoading(true);
        setApayLoading(true);
        const res = await getSystemConfig();
        if (res.success && res.data) {
            const states: Record<string, boolean> = {};
            const names: Record<string, string> = {};
            for (const gw of GATEWAY_DEFS) {
                states[gw.key] = res.data[gw.key] !== 'false';
                names[gw.key] = res.data[gw.nameKey] || gw.label;
            }
            setGatewayStates(states);
            setGatewayNames(names);

            // Parse A-Pay payment systems config
            if (res.data.APAY_PAYMENT_SYSTEMS) {
                try {
                    const map: Record<string, boolean> = JSON.parse(res.data.APAY_PAYMENT_SYSTEMS);
                    const merged: Record<string, boolean> = {};
                    APAY_PAYMENT_TYPES.forEach((t) => {
                        merged[t.key] = map[t.key] !== false;
                    });
                    setApayTypes(merged);
                } catch { /* use defaults */ }
            }
        }
        setGatewayLoading(false);
        setApayLoading(false);
    };

    const toggleGateway = async (key: string) => {
        setTogglingKey(key);
        const newValue = !gatewayStates[key];
        const res = await updateSystemConfig({ [key]: newValue ? 'true' : 'false' });
        if (res.success) {
            setGatewayStates(prev => ({ ...prev, [key]: newValue }));
        } else {
            alert('Failed to update gateway');
        }
        setTogglingKey(null);
    };

    const toggleApayType = (key: string) => {
        setApayTypes(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const saveApayTypes = async () => {
        setApaySaving(true);
        const res = await updateSystemConfig({
            APAY_PAYMENT_SYSTEMS: JSON.stringify(apayTypes),
        });
        if (!res.success) alert('Failed to save A-Pay payment types');
        setApaySaving(false);
    };

    useEffect(() => { fetchMethods(); fetchGatewayStates(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            let res;
            if (editingId) {
                res = await updatePaymentMethod(editingId, formData);
            } else {
                res = await createPaymentMethod({
                    name: formData.name!,
                    type: formData.type!,
                    minAmount: formData.minAmount!,
                    maxAmount: formData.maxAmount!,
                    fee: formData.fee,
                    feeType: formData.feeType,
                    isActive: formData.isActive,
                    details: formData.details,
                });
            }
            if (!res.success) {
                alert(res.error || 'Failed to save method');
                return;
            }
            setShowForm(false);
            setEditingId(null);
            fetchMethods();
        });
    };

    const handleEdit = (method: PaymentMethod) => {
        setFormData(method);
        setEditingId(method.id);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this method?")) return;
        const res = await deletePaymentMethod(id);
        if (res.success) fetchMethods();
        else alert(res.error || 'Failed to delete');
    };

    const toggleActive = async (method: PaymentMethod) => {
        const res = await updatePaymentMethod(method.id, { isActive: !method.isActive });
        if (res.success) fetchMethods();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Payment Gateways</h1>
                    <p className="text-slate-400 mt-1">Configure deposit and withdrawal methods.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ name: '', type: 'DEPOSIT', minAmount: 0, maxAmount: 0, fee: 0, feeType: 'PERCENTAGE', isActive: true, details: {} });
                        setShowForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    Add Method
                </button>
            </div>

            {/* ── UPI Gateway Quick Toggles ──────────────────────────── */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">UPI Gateway Controls</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Toggle gateways on/off. Disabled gateways won't appear for users.
                            <span className="text-emerald-400 font-medium ml-2">
                                {Object.values(gatewayStates).filter(Boolean).length} active
                            </span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-slate-400">{GATEWAY_DEFS.length} total</span>
                        </p>
                    </div>
                </div>
                {gatewayLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 py-4">
                        <Loader2 className="animate-spin" size={18} /> Loading gateway states...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {GATEWAY_DEFS.map((gw) => {
                            const enabled = gatewayStates[gw.key] ?? false;
                            const isToggling = togglingKey === gw.key;
                            const displayName = gatewayNames[gw.key] || gw.label;
                            return (
                                <button
                                    key={gw.key}
                                    onClick={() => toggleGateway(gw.key)}
                                    disabled={isToggling}
                                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-all ${
                                        enabled
                                            ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                                            : 'bg-slate-900 border-slate-700 hover:border-slate-600 opacity-60 hover:opacity-80'
                                    } ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                >
                                    <div className="text-left min-w-0">
                                        <div className={`text-sm font-medium truncate ${enabled ? 'text-emerald-300' : 'text-slate-400'}`}>
                                            {displayName}
                                        </div>
                                        <div className={`text-xs mt-0.5 ${enabled ? 'text-emerald-400/70' : 'text-slate-500'}`}>
                                            {enabled ? 'Active' : 'Disabled'}
                                        </div>
                                    </div>
                                    {isToggling ? (
                                        <Loader2 className="animate-spin text-slate-400 shrink-0" size={22} />
                                    ) : enabled ? (
                                        <ToggleRight className="text-emerald-400 shrink-0" size={28} />
                                    ) : (
                                        <ToggleLeft className="text-slate-500 shrink-0" size={28} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── A-Pay (Gateway 6) Payment Type Controls ─────────────── */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">A-Pay Payment Types (Gateway 6)</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Choose which payment methods are sent to A-Pay.
                            Disabled types won't appear on the A-Pay checkout page.
                            <span className="text-emerald-400 font-medium ml-2">
                                {Object.values(apayTypes).filter(Boolean).length} active
                            </span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-slate-400">{APAY_PAYMENT_TYPES.length} total</span>
                        </p>
                    </div>
                    <button
                        onClick={saveApayTypes}
                        disabled={apaySaving}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                        {apaySaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Save
                    </button>
                </div>
                {apayLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 py-4">
                        <Loader2 className="animate-spin" size={18} /> Loading...
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                        {APAY_PAYMENT_TYPES.map((pt) => {
                            const enabled = apayTypes[pt.key] ?? true;
                            return (
                                <button
                                    key={pt.key}
                                    onClick={() => toggleApayType(pt.key)}
                                    className={`flex items-center justify-between gap-2 px-4 py-3 rounded-lg border transition-all cursor-pointer ${
                                        enabled
                                            ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                                            : 'bg-slate-900 border-slate-700 hover:border-slate-600 opacity-60 hover:opacity-80'
                                    }`}
                                >
                                    <span className={`text-sm font-medium ${enabled ? 'text-emerald-300' : 'text-slate-400'}`}>
                                        {pt.label}
                                    </span>
                                    {enabled ? (
                                        <ToggleRight className="text-emerald-400 shrink-0" size={22} />
                                    ) : (
                                        <ToggleLeft className="text-slate-500 shrink-0" size={22} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {showForm && (
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit Method' : 'Add New Method'}</h3>
                        <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Method Name</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" required />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Type</label>
                            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white">
                                <option value="DEPOSIT">Deposit</option>
                                <option value="WITHDRAWAL">Withdrawal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Min Amount</label>
                            <input type="number" value={formData.minAmount} onChange={e => setFormData({ ...formData, minAmount: parseFloat(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" required />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Max Amount</label>
                            <input type="number" value={formData.maxAmount} onChange={e => setFormData({ ...formData, maxAmount: parseFloat(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" required />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Fee</label>
                            <input type="number" value={formData.fee} onChange={e => setFormData({ ...formData, fee: parseFloat(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Fee Type</label>
                            <select value={formData.feeType} onChange={e => setFormData({ ...formData, feeType: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white">
                                <option value="PERCENTAGE">Percentage</option>
                                <option value="FIXED">Fixed Amount</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-slate-400 mb-1">Details (JSON)</label>
                            <textarea
                                value={JSON.stringify(formData.details || {}, null, 2)}
                                onChange={e => {
                                    try { setFormData({ ...formData, details: JSON.parse(e.target.value) }); } catch { /* typing */ }
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono h-24"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                            <button type="submit" disabled={isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-2 disabled:opacity-50">
                                {isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Method
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={20} /> Loading...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {methods.map(method => (
                        <div key={method.id} className={`bg-slate-800 rounded-lg border ${method.isActive ? 'border-slate-700' : 'border-slate-700 opacity-75'} overflow-hidden relative group`}>
                            {!method.isActive && (
                                <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10 pointer-events-none">
                                    <span className="bg-slate-900 text-slate-400 px-3 py-1 rounded-full text-xs font-bold border border-slate-700">INACTIVE</span>
                                </div>
                            )}
                            <div className="p-4 border-b border-slate-700 flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-white text-lg">{method.name}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${method.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{method.type}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => toggleActive(method)} className={`p-1.5 rounded transition-colors ${method.isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-400 hover:text-white bg-slate-700'}`}>
                                        {method.isActive ? <Power size={16} /> : <PowerOff size={16} />}
                                    </button>
                                    <button onClick={() => handleEdit(method)} className="p-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(method.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div className="p-4 space-y-2 text-sm text-slate-300">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Limits</span>
                                    <span>{method.minAmount} – {method.maxAmount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Fee</span>
                                    <span>{method.fee} {method.feeType === 'PERCENTAGE' ? '%' : 'Flat'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {methods.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-500 bg-slate-800 rounded-lg border border-slate-700">
                    <p>No payment methods configured.</p>
                </div>
            )}
        </div>
    );
}
