"use client";

import React, { useState } from 'react';
import { Eye, CheckSquare, Square, AlertTriangle, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { UserPopup } from '@/components/shared/UserPopup';
import { getUsersBySharedIp } from '@/actions/users';

interface UserTableProps {
    users: any[];
    loading: boolean;
    selectedUsers: number[];
    onToggleSelect: (userId: number) => void;
    onToggleAll: () => void;
}

export default function UserTable({ users, loading, selectedUsers, onToggleSelect, onToggleAll }: UserTableProps) {
    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading users...</div>;
    }

    if (users.length === 0) {
        return <div className="p-8 text-center text-slate-500">No users found.</div>;
    }

    const allSelected = users.length > 0 && selectedUsers.length === users.length;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-800 text-slate-200 uppercase font-medium text-[11px] tracking-wide">
                    <tr>
                        <th className="w-12 px-4 py-4 sm:px-6">
                            <button onClick={onToggleAll} className="flex items-center text-slate-400 hover:text-white">
                                {allSelected ? <CheckSquare size={20} className="text-indigo-500" /> : <Square size={20} />}
                            </button>
                        </th>
                        <th className="px-4 py-4 sm:px-6">User</th>
                        <th className="px-4 py-4 sm:px-6">Role</th>
                        <th className="px-4 py-4 text-right sm:px-6">Balance</th>
                        <th className="px-4 py-4 text-right sm:px-6">Deposited</th>
                        <th className="px-4 py-4 text-right sm:px-6">Exposure</th>
                        <th className="px-4 py-4 sm:px-6">Status</th>
                        <th className="px-4 py-4 sm:px-6">IP Trace</th>
                        <th className="px-4 py-4 sm:px-6">Country</th>
                        <th className="px-4 py-4 sm:px-6">Currency</th>
                        <th className="px-4 py-4 sm:px-6">Joined</th>
                        <th className="px-4 py-4 text-right sm:px-6">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {users.map((user) => {
                        const isSelected = selectedUsers.includes(user.id);
                        const riskLevel = getRiskLevel(user);
                        return (
                            <tr
                                key={user.id}
                                className={`transition-colors ${isSelected ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'hover:bg-slate-800/50'}`}
                            >
                                <td className="px-4 py-4 sm:px-6">
                                    <button onClick={() => onToggleSelect(user.id)} className="flex items-center text-slate-400 hover:text-white">
                                        {isSelected ? <CheckSquare size={20} className="text-indigo-500" /> : <Square size={20} />}
                                    </button>
                                </td>

                                {/* User */}
                                <td className="px-4 py-4 sm:px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold flex-shrink-0">
                                            {user.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <UserPopup
                                                userId={user.id}
                                                username={user.username}
                                                email={user.email}
                                                phoneNumber={user.phoneNumber}
                                            />
                                            <p className="text-xs text-slate-400">{user.email || user.phoneNumber}</p>
                                        </div>
                                    </div>
                                </td>

                                {/* Role */}
                                <td className="px-4 py-4 sm:px-6">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        user.role === 'TECH_MASTER' ? 'bg-purple-500/10 text-purple-400' :
                                        user.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-400' :
                                        user.role === 'MANAGER' ? 'bg-blue-500/10 text-blue-400' :
                                        'bg-slate-700 text-slate-300'
                                    }`}>
                                        {user.role}
                                    </span>
                                </td>

                                {/* Balance */}
                                <td className="px-4 py-4 text-right font-medium text-white sm:px-6">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(user.balance)}
                                </td>

                                {/* Deposited */}
                                <td className="px-4 py-4 text-right font-medium text-emerald-400 sm:px-6">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(user.totalDeposited || 0)}
                                </td>

                                {/* Exposure */}
                                <td className="px-4 py-4 text-right text-red-400 sm:px-6">
                                    {user.exposure > 0 ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(user.exposure) : '-'}
                                </td>

                                {/* Status */}
                                <td className="px-4 py-4 sm:px-6">
                                    {user.isBanned ? (
                                        <span className="text-red-400 flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                            Banned
                                        </span>
                                    ) : (
                                        <span className="text-emerald-400 flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            Active
                                        </span>
                                    )}
                                </td>

                                {/* IP Trace */}
                                <td className="px-4 py-4 sm:px-6 min-w-[190px]">
                                    <IpTraceCell user={user} riskLevel={riskLevel} />
                                </td>

                                {/* Country */}
                                <td className="px-4 py-4 sm:px-6">
                                    {user.country ? (
                                        <span className="text-white font-medium">{user.country}</span>
                                    ) : (
                                        <span className="text-slate-600">—</span>
                                    )}
                                </td>

                                {/* Currency */}
                                <td className="px-4 py-4 sm:px-6">
                                    {user.currency ? (
                                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs font-mono">{user.currency}</span>
                                    ) : (
                                        <span className="text-slate-600">—</span>
                                    )}
                                </td>

                                {/* Joined */}
                                <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                                    <p className="text-white text-xs">{new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                    <p className="text-slate-500 text-xs">{new Date(user.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-4 text-right sm:px-6">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/dashboard/users/${user.id}`}
                                            className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                            title="View Profile"
                                        >
                                            <Eye size={16} />
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Risk Level Calculator ────────────────────────────────────────────────────
type RiskLevel = 'high' | 'medium' | 'low' | 'none';

function getRiskLevel(user: any): RiskLevel {
    if (!user.signupIp && !user.lastLoginIp) return 'none';
    if (user.sharedIpCount > 5) return 'high';
    if (user.sharedIpCount > 2 || user.uniqueIpCount > 10) return 'medium';
    if (user.sharedIpCount > 1 || user.uniqueIpCount > 5) return 'low';
    return 'none';
}

// ─── IP Trace Cell ────────────────────────────────────────────────────────────
function IpTraceCell({ user, riskLevel }: { user: any; riskLevel: RiskLevel }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [relatedUsers, setRelatedUsers] = useState<any[]>([]);

    if (!user.signupIp && !user.lastLoginIp) {
        return <span className="text-slate-600 text-xs italic">No data</span>;
    }

    const riskConfig: Record<RiskLevel, { badge: string; badgeCls: string; ipCls: string; icon: string }> = {
        high: {
            badge: 'HIGH RISK',
            badgeCls: 'bg-red-500/15 text-red-400 border border-red-500/30',
            ipCls: 'text-red-400',
            icon: 'text-red-400',
        },
        medium: {
            badge: 'FLAGGED',
            badgeCls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
            ipCls: 'text-amber-400',
            icon: 'text-amber-400',
        },
        low: {
            badge: 'WATCH',
            badgeCls: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
            ipCls: 'text-yellow-400',
            icon: 'text-yellow-500',
        },
        none: {
            badge: '',
            badgeCls: '',
            ipCls: 'text-slate-300',
            icon: '',
        },
    };

    const cfg = riskConfig[riskLevel];
    const sameIp = user.signupIp && user.lastLoginIp && user.signupIp === user.lastLoginIp;

    const openModal = async () => {
        setIsModalOpen(true);
        setIsLoading(true);
        const ipToSearch = user.signupIp || user.lastLoginIp;
        try {
            const data = await getUsersBySharedIp(ipToSearch);
            setRelatedUsers(data);
        } catch (err) {
            console.error("Failed to load related users", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-1 relative">
            {/* Risk badge */}
            {riskLevel !== 'none' && (
                <div className="flex items-center gap-1 mb-1.5 cursor-pointer group" onClick={openModal}>
                    <AlertTriangle size={10} className={cfg.icon} />
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all group-hover:bg-opacity-100 ${cfg.badgeCls}`}>
                        {cfg.badge}
                    </span>
                    {user.sharedIpCount > 1 && (
                        <span className="text-[9px] text-slate-500 group-hover:text-indigo-400 hover:underline">
                            {user.sharedIpCount} accounts
                        </span>
                    )}
                </div>
            )}

            {/* Signup IP */}
            {user.signupIp && (
                <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => user.sharedIpCount > 1 && openModal()}>
                    <span className="text-[9px] text-slate-500 w-[46px] flex-shrink-0 font-medium uppercase tracking-wide">Signup</span>
                    <span className={`text-[10px] font-mono leading-none group-hover:underline ${cfg.ipCls}`}>{user.signupIp}</span>
                </div>
            )}

            {/* Last Login IP */}
            {user.lastLoginIp && !sameIp && (
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500 w-[46px] flex-shrink-0 font-medium uppercase tracking-wide">Login</span>
                    <span className="text-[10px] font-mono leading-none text-slate-300">{user.lastLoginIp}</span>
                </div>
            )}
            {sameIp && (
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500 w-[46px] flex-shrink-0 font-medium uppercase tracking-wide">Login</span>
                    <span className="text-[9px] text-slate-600 italic">same IP</span>
                </div>
            )}

            {/* Stats row */}
            {(user.loginCount > 0 || user.uniqueIpCount > 1) && (
                <div className="flex items-center gap-2 pt-0.5">
                    {user.loginCount > 0 && (
                        <span className="text-[9px] text-slate-500">
                            <span className="text-slate-400 font-semibold">{user.loginCount}</span> logins
                        </span>
                    )}
                    {user.uniqueIpCount > 1 && (
                        <span className="text-[9px] text-slate-500">
                            <span className={`font-semibold ${user.uniqueIpCount > 10 ? 'text-amber-400' : 'text-slate-400'}`}>
                                {user.uniqueIpCount}
                            </span>{' '}
                            unique IPs
                        </span>
                    )}
                </div>
            )}

            {/* Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setIsModalOpen(false); }}>
                    <div className="bg-[#1e2330] rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/30">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} className={cfg.icon} />
                                <h3 className="text-lg font-semibold text-white">Shared IP Alert</h3>
                            </div>
                            <button className="text-slate-400 hover:text-white" onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-5">
                            <div className="mb-4 bg-slate-900/50 rounded-lg p-3 border border-slate-800 flex items-center justify-between">
                                <span className="text-sm text-slate-400">Target IP Address</span>
                                <span className={`font-mono text-sm font-semibold ${cfg.ipCls}`}>{user.signupIp || user.lastLoginIp}</span>
                            </div>
                            
                            <h4 className="text-sm font-medium text-slate-300 mb-3">Associated Accounts ({isLoading ? '...' : relatedUsers.length})</h4>
                            
                            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {isLoading ? (
                                    <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-500">
                                        <Loader2 size={24} className="animate-spin text-indigo-500" />
                                        <p className="text-sm">Scanning accounts...</p>
                                    </div>
                                ) : relatedUsers.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 bg-slate-800/30 rounded-lg border border-slate-700/50">
                                        No other accounts found for this IP.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {relatedUsers.map(rUser => (
                                            <div key={rUser.id} className={`flex items-center justify-between p-3 rounded-lg border ${rUser.id === user.id ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-slate-800/50 border-slate-700'} hover:border-slate-600 transition-colors`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${rUser.id === user.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-300'}`}>
                                                        {rUser.username?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <Link href={`/dashboard/users/${rUser.id}`} className="text-sm font-medium text-white hover:text-indigo-400 hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                {rUser.username}
                                                            </Link>
                                                            {rUser.isBanned && (
                                                                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded leading-none">BANNED</span>
                                                            )}
                                                            {rUser.id === user.id && (
                                                                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded leading-none">CURRENT</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-400 mb-0.5">{rUser.email}</div>
                                                        <div className="text-[10px] text-slate-500 uppercase font-mono">
                                                            ID: {rUser.id} • Joined: {new Date(rUser.createdAt).toLocaleDateString('en-GB')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Link href={`/dashboard/users/${rUser.id}`} className="w-8 h-8 rounded hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors" onClick={(e) => e.stopPropagation()}>
                                                    <Eye size={16} />
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
