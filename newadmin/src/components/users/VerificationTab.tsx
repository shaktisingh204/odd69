import React, { useState } from 'react';
import { verifyKyc } from '@/actions/users';
import { CheckCircle, XCircle, Clock, FileText, AlertTriangle } from 'lucide-react';

interface VerificationTabProps {
    user: any;
    onUpdate: () => void;
}

export default function VerificationTab({ user, onUpdate }: VerificationTabProps) {
    const [loading, setLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

    const handleStatusUpdate = async (status: 'VERIFIED' | 'REJECTED') => {
        if (status === 'REJECTED' && !showRejectInput) { setShowRejectInput(true); return; }
        if (status === 'REJECTED' && !rejectReason.trim()) { setMsg({ text: 'Please provide a rejection reason.', ok: false }); return; }
        if (!confirm(`Are you sure you want to mark this user as ${status}?`)) return;

        setLoading(true);
        setMsg(null);
        try {
            const res = await verifyKyc(user.id, status as any);
            if (res.success) {
                setShowRejectInput(false);
                setRejectReason('');
                setMsg({ text: `KYC marked as ${status}.`, ok: true });
                onUpdate();
            } else {
                setMsg({ text: res.error || 'Failed to update status.', ok: false });
            }
        } catch {
            setMsg({ text: 'Unexpected error occurred.', ok: false });
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'VERIFIED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'REJECTED': return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'PENDING': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'VERIFIED': return <CheckCircle size={18} />;
            case 'REJECTED': return <XCircle size={18} />;
            case 'PENDING': return <Clock size={18} />;
            default: return <AlertTriangle size={18} />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-white">KYC Status</h3>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${getStatusColor(user.kycStatus || 'NONE')}`}>
                        {getStatusIcon(user.kycStatus || 'NONE')}
                        {user.kycStatus || 'UNVERIFIED'}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => handleStatusUpdate('VERIFIED')}
                        disabled={loading || user.kycStatus === 'VERIFIED'}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={16} /> Approve KYC
                    </button>
                    <button
                        onClick={() => handleStatusUpdate('REJECTED')}
                        disabled={loading || user.kycStatus === 'REJECTED'}
                        className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <XCircle size={16} /> Reject KYC
                    </button>
                </div>

                {showRejectInput && (
                    <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm text-slate-400">Rejection Reason *</label>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 text-sm resize-none"
                            rows={3}
                            placeholder="Why is this being rejected?"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowRejectInput(false)} className="px-3 py-1.5 text-slate-400 hover:text-white text-sm">Cancel</button>
                            <button onClick={() => handleStatusUpdate('REJECTED')} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-500">Confirm Rejection</button>
                        </div>
                    </div>
                )}

                {msg && (
                    <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {msg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />} {msg.text}
                    </div>
                )}
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Submitted Documents</h3>
                {user.kycDocuments && user.kycDocuments.length > 0 ? (
                    <div className="space-y-3">
                        {user.kycDocuments.map((doc: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><FileText size={22} /></div>
                                    <div>
                                        <p className="text-white font-medium capitalize text-sm">{doc.type?.replace(/_/g, ' ')}</p>
                                        <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                                        {doc.reason && <p className="text-xs text-red-400 mt-0.5">Reason: {doc.reason}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${doc.status === 'VERIFIED' ? 'text-emerald-400 bg-emerald-500/10' : doc.status === 'REJECTED' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                                        {doc.status}
                                    </span>
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm underline">View</a>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-700 rounded-lg">
                        <FileText size={32} className="mx-auto mb-2 opacity-40" />
                        <p>No documents submitted yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
