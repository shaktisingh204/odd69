import React, { useState } from 'react';
import { setRGLimitsAction } from '@/actions/users';
import { ShieldAlert, Save, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface ResponsibleGamblingTabProps {
    user: any;
    onUpdate: () => void;
}

export default function ResponsibleGamblingTab({ user, onUpdate }: ResponsibleGamblingTabProps) {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [formData, setFormData] = useState({
        depositLimit: user.depositLimit?.toString() || '',
        lossLimit: user.lossLimit?.toString() || '',
        selfExclusionUntil: user.selfExclusionUntil
            ? new Date(user.selfExclusionUntil).toISOString().split('T')[0]
            : ''
    });

    const handleSave = async () => {
        setLoading(true);
        setMsg(null);
        try {
            const res = await setRGLimitsAction(user.id, {
                depositLimit: formData.depositLimit ? Number(formData.depositLimit) : null,
                lossLimit: formData.lossLimit ? Number(formData.lossLimit) : null,
                selfExclusionUntil: formData.selfExclusionUntil || null,
            });
            if (res.success) {
                setMsg({ text: 'Limits updated successfully.', ok: true });
                onUpdate();
            } else {
                setMsg({ text: res.error || 'Failed to update limits.', ok: false });
            }
        } catch {
            setMsg({ text: 'Unexpected error occurred.', ok: false });
        } finally {
            setLoading(false);
        }
    };

    const currency = user.currency || 'INR';

    return (
        <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><ShieldAlert size={22} /></div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Responsible Gambling Limits</h3>
                        <p className="text-slate-400 text-sm">Set monthly deposit and loss caps for this player.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1.5">Monthly Deposit Limit ({currency})</label>
                        <input
                            type="number"
                            min="0"
                            value={formData.depositLimit}
                            onChange={(e) => setFormData(f => ({ ...f, depositLimit: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                            placeholder="No limit"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1.5">Monthly Loss Limit ({currency})</label>
                        <input
                            type="number"
                            min="0"
                            value={formData.lossLimit}
                            onChange={(e) => setFormData(f => ({ ...f, lossLimit: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                            placeholder="No limit"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-red-500/10 rounded-lg text-red-400"><Calendar size={22} /></div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Temporary Self-Exclusion</h3>
                        <p className="text-slate-400 text-sm">Lock the account until a specific date.</p>
                    </div>
                </div>
                <label className="block text-sm text-slate-400 mb-1.5">Exclusion End Date</label>
                <input
                    type="date"
                    value={formData.selfExclusionUntil}
                    onChange={(e) => setFormData(f => ({ ...f, selfExclusionUntil: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm max-w-sm"
                />
                <p className="text-xs text-slate-500 mt-2">User cannot log in or place bets until this date. Leave empty to clear exclusion.</p>
            </div>

            {msg && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {msg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />} {msg.text}
                </div>
            )}

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={16} /> {loading ? 'Saving...' : 'Save Restrictions'}
                </button>
            </div>
        </div>
    );
}
