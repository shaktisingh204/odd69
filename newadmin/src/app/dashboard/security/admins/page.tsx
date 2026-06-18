"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { getAdminStaff, updateUserRole } from '@/actions/admins';
import { useAuth } from '@/context/AuthContext';
import { UserCog, Edit2, Loader2 } from 'lucide-react';

interface AdminUser {
    id: number;
    username: string;
    email: string | null;
    role: string;
}

export default function AdminUsersPage() {
    const { user: adminUser } = useAuth();
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [selectedRole, setSelectedRole] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        try {
            const res = await getAdminStaff();
            if (res.success) setAdmins(res.data);
        } catch (error) {
            console.error("Failed to fetch admins", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async () => {
        if (!editingUser || !selectedRole) return;
        setError('');
        startTransition(async () => {
            const res = await updateUserRole(editingUser.id, selectedRole);
            if (res.success) {
                setEditingUser(null);
                fetchAdmins();
            } else {
                setError(res.error || 'Failed to update role');
            }
        });
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'TECH_MASTER': return <span className="bg-purple-500/10 text-purple-400 px-2 py-1 rounded text-xs font-bold border border-purple-500/20">TECH MASTER</span>;
            case 'SUPER_ADMIN': return <span className="bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/20">SUPER ADMIN</span>;
            case 'MANAGER': return <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-500/20">MANAGER</span>;
            case 'MASTER': return <span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs font-bold border border-amber-500/20">MASTER</span>;
            case 'AGENT': return <span className="bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded text-xs font-bold border border-cyan-500/20">AGENT</span>;
            default: return <span className="bg-slate-500/10 text-slate-400 px-2 py-1 rounded text-xs font-bold">USER</span>;
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Loading staff...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Staff Management</h1>
                    <p className="text-slate-400 mt-1">Manage admin roles and permissions.</p>
                </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-[640px] w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 uppercase font-medium text-xs">
                            <tr>
                                <th className="px-4 py-4 sm:px-6">User</th>
                                <th className="px-4 py-4 sm:px-6">Role</th>
                                <th className="px-4 py-4 text-right sm:px-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {admins.map(user => (
                                <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-4 sm:px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-900 rounded-full">
                                                <UserCog size={20} className="text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{user.username}</p>
                                                <p className="text-xs text-slate-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 sm:px-6">
                                        {getRoleBadge(user.role)}
                                    </td>
                                    <td className="px-4 py-4 text-right sm:px-6">
                                        <button
                                            onClick={() => { setEditingUser(user); setSelectedRole(user.role); setError(''); }}
                                            className="p-2 text-blue-400 hover:bg-slate-700 rounded transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {admins.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No staff users found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Role Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-4 sm:p-6">
                        <h3 className="text-xl font-bold text-white">Change Role</h3>
                        <p className="text-slate-400 text-sm">Update role for <span className="text-white font-bold">{editingUser.username}</span></p>

                        {error && (
                            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
                        )}

                        <div className="space-y-2">
                            {['TECH_MASTER', 'SUPER_ADMIN', 'MANAGER', 'MASTER', 'AGENT', 'USER'].map(role => (
                                <label key={role} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedRole === role ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
                                    <span className="text-sm font-medium text-white">{role.replace(/_/g, ' ')}</span>
                                    <input type="radio" name="role" value={role} checked={selectedRole === role} onChange={(e) => setSelectedRole(e.target.value)} className="accent-indigo-500" />
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
                            <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                            <button onClick={handleRoleChange} disabled={isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50">
                                {isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
