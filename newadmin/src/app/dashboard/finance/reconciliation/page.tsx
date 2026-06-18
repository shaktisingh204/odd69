"use client";

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

// Reconciliation is a pure client-side CSV parse — no backend needed.
// We compare the uploaded CSV against rows fetched via a server action.

interface ReconcileResult {
    matched: number;
    mismatched: { txnId: string; csvStatus: string }[];
    unknown: string[];
    total: number;
}

export default function ReconciliationPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ReconcileResult | null>(null);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
            setError('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError('');

        try {
            const text = await file.text();
            const lines = text.split('\n').filter(Boolean);
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            const txnIdIdx = headers.findIndex(h => h.includes('transaction') || h.includes('txn') || h.includes('id'));
            const statusIdx = headers.findIndex(h => h.includes('status'));

            if (txnIdIdx === -1) {
                setError('CSV must have a column containing "transaction", "txn", or "id".');
                return;
            }

            const csvRows = lines.slice(1).map(line => {
                const cols = line.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
                return {
                    txnId: cols[txnIdIdx] || '',
                    csvStatus: statusIdx !== -1 ? cols[statusIdx] : 'UNKNOWN',
                };
            }).filter(r => r.txnId);

            // Fetch transactions from the server for validation
            const { getTransactionsByIds } = await import('@/actions/finance');
            const txnIds = csvRows.map(r => r.txnId);
            const dbRows = await getTransactionsByIds(txnIds);

            const dbMap = new Map(dbRows.map((t: any) => [t.transactionId, t.status]));
            let matched = 0;
            const mismatched: { txnId: string; csvStatus: string }[] = [];
            const unknown: string[] = [];

            for (const row of csvRows) {
                if (!dbMap.has(row.txnId)) {
                    unknown.push(row.txnId);
                } else {
                    const dbStatus = String(dbMap.get(row.txnId)).toUpperCase();
                    const csvStatus = String(row.csvStatus).toUpperCase();
                    if (dbStatus === csvStatus || (dbStatus === 'APPROVED' && csvStatus === 'COMPLETED') || (dbStatus === 'COMPLETED' && csvStatus === 'APPROVED')) {
                        matched++;
                    } else {
                        mismatched.push({ txnId: row.txnId, csvStatus: row.csvStatus });
                    }
                }
            }

            setResult({ matched, mismatched, unknown, total: csvRows.length });
        } catch (err: any) {
            setError(err?.message || 'Failed to process file.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Reconciliation</h1>
                <p className="text-slate-400 mt-1">Compare internal records with payment gateway CSV reports.</p>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center max-w-2xl mx-auto">
                <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Upload size={32} className="text-indigo-400" />
                </div>

                <h3 className="text-xl font-semibold text-white mb-2">Upload Gateway Report</h3>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                    Upload a CSV file containing transaction IDs and statuses. The system will match them against internal records.
                </p>

                <div className="flex justify-center mb-6">
                    <label className="relative cursor-pointer bg-slate-900 border border-slate-600 hover:border-indigo-500 rounded-lg px-6 py-4 flex items-center gap-3 transition-colors group">
                        <FileText className="text-slate-400 group-hover:text-white" />
                        <span className="text-slate-300 group-hover:text-white font-medium">
                            {file ? file.name : "Select CSV File"}
                        </span>
                        <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                    </label>
                </div>

                {error && (
                    <p className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>
                )}

                <button
                    onClick={handleUpload}
                    disabled={!file || loading}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                    Start Reconciliation
                </button>
            </div>

            {result && (
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <AlertTriangle className="text-amber-400" size={20} />
                        Reconciliation Result
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-emerald-400">{result.matched}</p>
                            <p className="text-xs text-slate-400 mt-1">Matched</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-red-400">{result.mismatched.length}</p>
                            <p className="text-xs text-slate-400 mt-1">Mismatched</p>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-amber-400">{result.unknown.length}</p>
                            <p className="text-xs text-slate-400 mt-1">Not Found</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">{result.total} total rows processed.</p>

                    {result.mismatched.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-white mb-2">Mismatched Transactions</h4>
                            <div className="bg-slate-900 rounded-lg overflow-hidden">
                                {result.mismatched.slice(0, 20).map((m, i) => (
                                    <div key={i} className="flex justify-between items-center px-4 py-2 border-b border-slate-800 last:border-0 text-sm">
                                        <span className="font-mono text-slate-300">{m.txnId}</span>
                                        <span className="text-red-400">{m.csvStatus}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
