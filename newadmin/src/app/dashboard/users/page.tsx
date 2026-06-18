"use client";

import React, { useEffect, useState } from 'react';
import { Search, Filter, Plus, ChevronLeft, ChevronRight, Trash2, ShieldCheck, Ban, Gift, X, CheckCircle, XCircle, Download, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { createUser, performBulkAction as bulkActionServer, getUsers, updateUserStatus, exportUsers } from '@/actions/users';
import Link from 'next/link';
import UserTable from '@/components/users/UserTable';
import * as XLSX from 'xlsx';

type Toast = { msg: string; type: 'success' | 'error' };

const SORT_OPTIONS = [
    { value: 'user', label: 'User' },
    { value: 'role', label: 'Role' },
    { value: 'balance', label: 'Balance' },
    { value: 'exposure', label: 'Exposure' },
    { value: 'status', label: 'Status' },
    { value: 'country', label: 'Country' },
    { value: 'currency', label: 'Currency' },
    { value: 'joined', label: 'Joined' },
];

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('ALL');
    const [status, setStatus] = useState('ALL');
    const [sortBy, setSortBy] = useState('joined');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);

    // Export Modal
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportLoading, setExportLoading] = useState<'emails' | 'numbers' | null>(null);

    // Import Modal
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'create' | 'upsert'>('create');
    const [importDryRun, setImportDryRun] = useState(true);
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState<{
        summary: { total: number; created: number; updated: number; skippedExisting: number; errors: number; dryRun: boolean; mode: string };
        generatedPasswords: Array<{ row: number; username: string | null; email: string | null; password: string }>;
        errorsList: Array<{ row: number; reason: string }>;
    } | null>(null);

    const handleImportSubmit = async () => {
        if (!importFile) return;
        setImportLoading(true);
        setImportResult(null);
        try {
            const fd = new FormData();
            fd.append('file', importFile);
            fd.append('mode', importMode);
            fd.append('dryRun', String(importDryRun));
            const res = await fetch('/api/import/users', { method: 'POST', body: fd });
            const json = await res.json();
            if (!res.ok) {
                showToast(json.error || 'Import failed', 'error');
                return;
            }
            setImportResult(json);
            const s = json.summary;
            const verb = s.dryRun ? 'Dry run' : 'Import';
            showToast(
                `${verb}: created=${s.created} updated=${s.updated} skipped=${s.skippedExisting} errors=${s.errors}`,
                s.errors > 0 ? 'error' : 'success',
            );
            if (!s.dryRun && (s.created > 0 || s.updated > 0)) {
                fetchUsers();
            }
        } catch (e: any) {
            showToast(e.message || 'Import failed', 'error');
        } finally {
            setImportLoading(false);
        }
    };

    const downloadGeneratedPasswords = () => {
        if (!importResult || importResult.generatedPasswords.length === 0) return;
        const header = 'row,username,email,password\n';
        const lines = importResult.generatedPasswords
            .map((g) => [g.row, g.username || '', g.email || '', g.password].map((v) => {
                const s = String(v ?? '');
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(','))
            .join('\n');
        const blob = new Blob([header + lines], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `imported_user_passwords_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Create User Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        username: '', email: '', phoneNumber: '', password: '', role: 'USER'
    });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers(page, 10, search, role, status, sortBy, sortDir);
            setUsers(data.users);
            setPagination(data.pagination);
            setSelectedUsers([]);
        } catch (error: any) {
            console.error("Failed to fetch users", error);
            showToast(`Failed to load users: ${error?.message || 'Unknown error'}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const debounce = setTimeout(fetchUsers, 300);
        return () => clearTimeout(debounce);
    }, [page, search, role, status, sortBy, sortDir]);

    const handleToggleSelect = (userId: number) => {
        setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
    };

    const handleToggleAll = () => {
        setSelectedUsers(prev => prev.length === users.length ? [] : users.map(u => u.id));
    };

    const performBulkAction = async (action: 'BAN' | 'VERIFY' | 'BONUS' | 'DELETE') => {
        if (!selectedUsers.length) return;

        let data: any = {};
        if (action === 'BONUS') {
            const amount = window.prompt("Enter bonus amount:");
            if (!amount) return;
            data.amount = amount;
        }

        if (action === 'DELETE') {
            const confirmed = window.confirm(
                `⚠️ PERMANENTLY DELETE ${selectedUsers.length} user(s)?\n\nThis action cannot be undone. All their data will be removed from the database.`
            );
            if (!confirmed) return;
        }

        setIsActionLoading(true);
        try {
            const res = await bulkActionServer(selectedUsers, action, data);
            if (res.success) {
                showToast(`Bulk ${action.toLowerCase()} applied to ${selectedUsers.length} users.`, 'success');
                fetchUsers();
            } else {
                showToast(res.error || 'Bulk action failed.', 'error');
            }
        } catch (error) {
            showToast('Bulk action failed.', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleExport = async (type: 'emails' | 'numbers') => {
        setExportLoading(type);
        try {
            const res = await exportUsers(search, role, status);
            if (!res.success) { showToast('Export failed.', 'error'); return; }

            let wsData: any[][];
            let fileName: string;

            if (type === 'emails') {
                wsData = [['Username', 'Email'], ...res.users.map(u => [u.username, u.email])];
                fileName = 'users_emails.xlsx';
            } else {
                wsData = [['Username', 'Phone Number'], ...res.users
                    .filter(u => u.phoneNumber)
                    .map(u => [u.username, u.phoneNumber.replace(/^\+/, '')])];
                fileName = 'users_numbers.xlsx';
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, type === 'emails' ? 'Emails' : 'Numbers');
            XLSX.writeFile(wb, fileName);
            showToast(`Exported ${res.users.length} records successfully.`, 'success');
            setShowExportModal(false);
        } catch (err) {
            showToast('Export failed.', 'error');
        } finally {
            setExportLoading(null);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        setCreateError('');
        try {
            const res = await createUser(createForm);
            if (res.success) {
                showToast(`User "${createForm.username}" created successfully!`, 'success');
                setShowCreateModal(false);
                setCreateForm({ username: '', email: '', phoneNumber: '', password: '', role: 'USER' });
                fetchUsers();
            } else {
                setCreateError(res.error || 'Failed to create user.');
            }
        } catch (e) {
            setCreateError('Unexpected error occurred.');
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <div className="space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed left-4 right-4 top-4 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg animate-in slide-in-from-top-4 sm:left-auto sm:right-6 sm:top-6 ${toast.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300' : 'bg-red-900/80 border-red-500/40 text-red-300'}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Plus size={20} className="text-indigo-400" /> Create New User
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Username *</label>
                                    <input
                                        type="text"
                                        required
                                        value={createForm.username}
                                        onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                        placeholder="john_doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Role</label>
                                    <select
                                        value={createForm.role}
                                        onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="USER">Player</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="SUPER_ADMIN">Super Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={createForm.email}
                                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Phone Number</label>
                                <input
                                    type="tel"
                                    value={createForm.phoneNumber}
                                    onChange={e => setCreateForm(f => ({ ...f, phoneNumber: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Password *</label>
                                <input
                                    type="password"
                                    required
                                    value={createForm.password}
                                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
                                    placeholder="Min 8 characters"
                                    minLength={8}
                                />
                            </div>
                            {createError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2">
                                    <XCircle size={14} /> {createError}
                                </div>
                            )}
                            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors text-sm">
                                    Cancel
                                </button>
                                <button type="submit" disabled={createLoading} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50">
                                    {createLoading ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={() => setShowExportModal(false)}>
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Download size={20} className="text-indigo-400" /> Export Users
                            </h3>
                            <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-slate-400 text-sm mb-5">
                            Exports all users matching the current filters as an <span className="text-white font-medium">.xlsx</span> file.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleExport('emails')}
                                disabled={exportLoading !== null}
                                className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-60"
                            >
                                {exportLoading === 'emails' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Export Emails
                            </button>
                            <button
                                onClick={() => handleExport('numbers')}
                                disabled={exportLoading !== null}
                                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-60"
                            >
                                {exportLoading === 'numbers' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Export Numbers
                            </button>
                            <button
                                onClick={() => {
                                    // Streams the full `User` table with every column straight from
                                    // the DB through a route handler (no payload limit).
                                    const params = new URLSearchParams();
                                    if (search) params.set('search', search);
                                    if (role && role !== 'ALL') params.set('role', role);
                                    if (status && status !== 'ALL') params.set('status', status);
                                    window.location.href = `/api/export/users?${params.toString()}`;
                                    setShowExportModal(false);
                                }}
                                className="flex items-center justify-center gap-2 w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                                <Download size={16} />
                                Export Full CSV (all columns)
                            </button>
                            <p className="text-[11px] text-slate-500 text-center -mt-1">
                                Streams every column of the User table for all users matching the current filters.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={() => !importLoading && setShowImportModal(false)}>
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Upload size={20} className="text-emerald-400" /> Import Users
                            </h3>
                            <button onClick={() => !importLoading && setShowImportModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-4">
                            <div className="flex gap-2">
                                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-200">
                                    <p className="font-semibold mb-1">CSV format</p>
                                    <ul className="list-disc ml-4 space-y-0.5 text-amber-200/80">
                                        <li>First row = column headers. Compatible with <span className="font-mono">/api/export/users</span> output.</li>
                                        <li>Each row needs at least one of <span className="font-mono">email</span>, <span className="font-mono">phoneNumber</span>, or <span className="font-mono">username</span>.</li>
                                        <li>Include a <span className="font-mono">password</span> column to set passwords. Missing → a random one is generated and you can download it after.</li>
                                        <li>Extra columns like <span className="font-mono">id</span>, <span className="font-mono">createdAt</span>, <span className="font-mono">updatedAt</span> are silently ignored — safe to import a prior export.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* File picker */}
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">CSV File</label>
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-slate-600"
                        />
                        {importFile && (
                            <p className="text-[11px] text-slate-500 mt-1.5">{importFile.name} · {(importFile.size / 1024).toFixed(1)} KB</p>
                        )}

                        {/* Mode */}
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <button
                                type="button"
                                onClick={() => setImportMode('create')}
                                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${importMode === 'create' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                            >
                                Create only
                                <span className="block text-[10px] text-slate-500 normal-case">skip existing</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setImportMode('upsert')}
                                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${importMode === 'upsert' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                            >
                                Upsert
                                <span className="block text-[10px] text-slate-500 normal-case">create new + update existing</span>
                            </button>
                        </div>

                        {/* Dry run */}
                        <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 mt-4 text-sm text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={importDryRun}
                                onChange={(e) => setImportDryRun(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span>
                                Dry run (validate only, don&apos;t write)
                                <span className="block text-xs text-slate-500">
                                    Recommended for your first pass. Reports what would happen without changing any data.
                                </span>
                            </span>
                        </label>

                        <button
                            onClick={handleImportSubmit}
                            disabled={!importFile || importLoading}
                            className={`mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${importDryRun ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                        >
                            {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            {importLoading ? 'Processing…' : importDryRun ? 'Run Dry Run' : 'Import Users'}
                        </button>

                        {/* Result */}
                        {importResult && (
                            <div className="mt-5 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    {importResult.summary.errors > 0 ? <XCircle size={16} className="text-red-400" /> : <CheckCircle size={16} className="text-emerald-400" />}
                                    {importResult.summary.dryRun ? 'Dry run result' : 'Import result'}
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                                    <div className="bg-slate-800 rounded p-2"><div className="text-slate-500 uppercase text-[10px]">Total</div><div className="text-white font-mono">{importResult.summary.total}</div></div>
                                    <div className="bg-slate-800 rounded p-2"><div className="text-slate-500 uppercase text-[10px]">Created</div><div className="text-emerald-300 font-mono">{importResult.summary.created}</div></div>
                                    <div className="bg-slate-800 rounded p-2"><div className="text-slate-500 uppercase text-[10px]">Updated</div><div className="text-indigo-300 font-mono">{importResult.summary.updated}</div></div>
                                    <div className="bg-slate-800 rounded p-2"><div className="text-slate-500 uppercase text-[10px]">Skipped</div><div className="text-slate-300 font-mono">{importResult.summary.skippedExisting}</div></div>
                                    <div className="bg-slate-800 rounded p-2"><div className="text-slate-500 uppercase text-[10px]">Errors</div><div className="text-red-300 font-mono">{importResult.summary.errors}</div></div>
                                </div>

                                {importResult.generatedPasswords.length > 0 && (
                                    <div className="mt-3">
                                        <button
                                            onClick={downloadGeneratedPasswords}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded bg-fuchsia-600/10 border border-fuchsia-500/30 hover:bg-fuchsia-600/20 text-fuchsia-300 text-xs font-medium transition-colors"
                                        >
                                            <Download size={12} />
                                            Download {importResult.generatedPasswords.length} generated password{importResult.generatedPasswords.length !== 1 ? 's' : ''}
                                        </button>
                                        <p className="text-[10px] text-slate-500 text-center mt-1">Save this CSV — these passwords are only shown once.</p>
                                    </div>
                                )}

                                {importResult.errorsList.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-[11px] uppercase tracking-wider text-red-400 font-semibold mb-1.5">Errors (first 20):</p>
                                        <div className="max-h-40 overflow-y-auto rounded bg-slate-950/60 p-2 text-[11px] font-mono text-red-200 space-y-0.5">
                                            {importResult.errorsList.slice(0, 20).map((e, i) => (
                                                <div key={i}>row {e.row}: {e.reason}</div>
                                            ))}
                                            {importResult.errorsList.length > 20 && (
                                                <div className="text-slate-500">… {importResult.errorsList.length - 20} more</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">User Management</h1>
                    <p className="text-slate-400 mt-1">Manage players, agents, and staff members.</p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
                    >
                        <Download size={18} />
                        Export
                    </button>
                    <button
                        onClick={() => { setShowImportModal(true); setImportResult(null); setImportFile(null); }}
                        className="flex items-center justify-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-600/20"
                    >
                        <Upload size={18} />
                        Import
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                        <Plus size={18} />
                        Create User
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by username, email, or phone..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
                    <Filter className="text-slate-500" size={18} />
                    <select
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none sm:flex-none"
                        value={role}
                        onChange={(e) => { setRole(e.target.value); setPage(1); }}
                    >
                        <option value="ALL">All Roles</option>
                        <option value="USER">Players</option>
                        <option value="MANAGER">Managers</option>
                        <option value="SUPER_ADMIN">Admins</option>
                        <option value="TECH_MASTER">Tech Master</option>
                    </select>
                    <select
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none sm:flex-none"
                        value={status}
                        onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="BANNED">Banned</option>
                        <option value="UNVERIFIED">Unverified</option>
                    </select>
                    <select
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none sm:flex-none"
                        value={sortBy}
                        onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{`Sort by ${option.label}`}</option>
                        ))}
                    </select>
                    <select
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none sm:flex-none"
                        value={sortDir}
                        onChange={(e) => { setSortDir(e.target.value as 'asc' | 'desc'); setPage(1); }}
                    >
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-sm overflow-hidden mb-20">
                <UserTable
                    users={users}
                    loading={loading}
                    selectedUsers={selectedUsers}
                    onToggleSelect={handleToggleSelect}
                    onToggleAll={handleToggleAll}
                />

                {/* Pagination */}
                {!loading && users.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-slate-700 p-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                        <span>Showing {((page - 1) * 10) + 1}–{Math.min(page * 10, pagination.total)} of {pagination.total} users</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 hover:bg-slate-700 rounded disabled:opacity-50"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-white font-medium">Page {page} of {pagination.totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="p-2 hover:bg-slate-700 rounded disabled:opacity-50"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Action Bar */}
            {selectedUsers.length > 0 && (
                <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 shadow-2xl animate-in slide-in-from-bottom-6 sm:inset-x-auto sm:left-1/2 sm:flex-row sm:items-center sm:gap-5 sm:rounded-full sm:px-6 sm:py-3 sm:-translate-x-1/2">
                    <span className="text-white font-bold text-sm">{selectedUsers.length} Selected</span>
                    <div className="hidden h-5 w-px bg-slate-700 sm:block" />
                    <div className="flex flex-wrap items-center gap-2">
                        <ActionBtn
                            onClick={() => performBulkAction('VERIFY')}
                            disabled={isActionLoading}
                            icon={ShieldCheck}
                            label="Verify"
                            color="text-emerald-400"
                            hover="hover:bg-emerald-500/10"
                        />
                        <ActionBtn
                            onClick={() => performBulkAction('BAN')}
                            disabled={isActionLoading}
                            icon={Ban}
                            label="Ban"
                            color="text-red-400"
                            hover="hover:bg-red-500/10"
                        />
                        <ActionBtn
                            onClick={() => performBulkAction('BONUS')}
                            disabled={isActionLoading}
                            icon={Gift}
                            label="Bonus"
                            color="text-amber-400"
                            hover="hover:bg-amber-500/10"
                        />
                        <ActionBtn
                            onClick={() => performBulkAction('DELETE')}
                            disabled={isActionLoading}
                            icon={Trash2}
                            label="Delete"
                            color="text-rose-400"
                            hover="hover:bg-rose-500/10"
                        />
                    </div>
                    <button onClick={() => setSelectedUsers([])} className="text-left text-xs text-slate-500 transition-colors hover:text-white sm:ml-2">
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

function ActionBtn({ onClick, disabled, icon: Icon, label, color, hover }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={label}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors disabled:opacity-50 sm:flex-col sm:gap-1 sm:rounded-full sm:px-2.5 ${color} ${hover}`}
        >
            <Icon size={18} />
            <span className="text-[11px] font-medium sm:text-[10px]">{label}</span>
        </button>
    );
}
