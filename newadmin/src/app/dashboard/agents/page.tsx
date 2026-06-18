"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { getAgentStats, getAgentDownline, createAgent } from '@/actions/agents';
import { Users, DollarSign, TrendingUp, Plus, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';

interface DownlineUser {
    id: number;
    username: string;
    role: string;
    balance: number;
    exposure: number;
    referrals?: DownlineUser[];
}

interface AgentStats {
    totalUsers: number;
    totalPlayerBalance: number;
    totalMarketLiability: number;
}

export default function AgentsPage() {
    const [stats, setStats] = useState<AgentStats | null>(null);
    const [downline, setDownline] = useState<DownlineUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, downlineRes] = await Promise.all([
                getAgentStats(),
                getAgentDownline(),
            ]);
            if (statsRes.success) setStats(statsRes.data);
            if (downlineRes.success) setDownline(downlineRes.data as DownlineUser[]);
        } catch (error) {
            console.error("Failed to fetch agent data", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Agent Dashboard</h1>
                    <p className="text-slate-400">Manage your downline and view performance.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                    <Plus size={18} />
                    Create Agent
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    title="Total Downline Users"
                    value={loading ? '...' : (stats?.totalUsers || 0)}
                    icon={<Users className="text-blue-400" />}
                />
                <StatsCard
                    title="Total Player Balance"
                    value={loading ? '...' : `₹${(stats?.totalPlayerBalance || 0).toFixed(2)}`}
                    icon={<DollarSign className="text-emerald-400" />}
                />
                <StatsCard
                    title="Total Market Exposure"
                    value={loading ? '...' : `₹${(stats?.totalMarketLiability || 0).toFixed(2)}`}
                    icon={<TrendingUp className="text-amber-400" />}
                />
            </div>

            {/* Downline Tree */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Your Downline</h2>
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="animate-spin" size={20} /> Loading...
                    </div>
                ) : (
                    <div className="space-y-2">
                        {downline.map(agent => (
                            <DownlineItem key={agent.id} user={agent} />
                        ))}
                        {downline.length === 0 && (
                            <p className="text-slate-500">No agents or users found in your downline.</p>
                        )}
                    </div>
                )}
            </div>

            {isCreateModalOpen && (
                <CreateAgentModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => { setIsCreateModalOpen(false); fetchData(); }}
                />
            )}
        </div>
    );
}

function StatsCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
    return (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-400 font-medium">{title}</h3>
                {icon}
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );
}

function DownlineItem({ user }: { user: DownlineUser }) {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = user.referrals && user.referrals.length > 0;

    return (
        <div className="border border-slate-700 rounded-lg overflow-hidden">
            <div
                className="flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    {hasChildren ? (
                        expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />
                    ) : <div className="w-4" />}
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{user.username}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${user.role === 'MASTER' ? 'bg-purple-500/20 text-purple-400' :
                                user.role === 'AGENT' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-slate-700 text-slate-300'
                                }`}>
                                {user.role}
                            </span>
                        </div>
                        <div className="text-sm text-slate-500 flex gap-4 mt-1">
                            <span>Bal: ₹{user.balance.toFixed(2)}</span>
                            <span>Exp: ₹{user.exposure.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {expanded && hasChildren && (
                <div className="bg-slate-900/50 p-4 pl-8 space-y-2 border-t border-slate-700">
                    {user.referrals!.map(child => (
                        <DownlineItem key={child.id} user={child} />
                    ))}
                </div>
            )}
        </div>
    );
}

function CreateAgentModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
    const [formData, setFormData] = useState({ username: '', password: '', email: '', phoneNumber: '', role: 'AGENT' as 'AGENT' | 'MASTER' });
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        startTransition(async () => {
            const result = await createAgent(formData);
            if (result.success) {
                onSuccess();
            } else {
                setError(result.error || 'Failed to create agent');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">Create New Agent</h2>
                {error && <p className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-slate-400 mb-1">Username</label>
                        <input type="text" required className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-slate-400 mb-1">Password</label>
                        <input type="password" required className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-slate-400 mb-1">Email</label>
                        <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-slate-400 mb-1">Role</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as any })}>
                            <option value="AGENT">Agent</option>
                            <option value="MASTER">Master</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50">
                            {isPending ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
