"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { getCrmSegments, getCrmSegmentUsers, sendCrmCampaign } from '@/actions/crm';
import { useAuth } from '@/context/AuthContext';
import { Users, UserPlus, UserMinus, Zap, Send, Loader2, Clock } from 'lucide-react';
import Link from 'next/link';

type CampaignRecord = { segment: string; message: string; type: string; sentAt: string; count: number };

interface CrmSegments {
    vip: number;
    new: number;
    active: number;
    churned: number;
    dormant: number;
}

export default function CrmPage() {
    const { user: adminUser } = useAuth();
    const [segments, setSegments] = useState<CrmSegments | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('');
    const [msgType, setMsgType] = useState<'PUSH' | 'EMAIL'>('PUSH');
    const [sending, setSending] = useState(false);
    const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);

    useEffect(() => {
        fetchSegments();
        const stored = localStorage.getItem('admin_campaigns');
        if (stored) setCampaigns(JSON.parse(stored));
    }, []);

    const fetchSegments = async () => {
        try {
            const res = await getCrmSegments();
            if (res.success) setSegments(res.data);
        } catch (error) {
            console.error("Failed to fetch segments", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSegmentClick = async (segment: string) => {
        setSelectedSegment(segment);
        setUsersLoading(true);
        try {
            const res = await getCrmSegmentUsers(segment);
            if (res.success) setUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setUsersLoading(false);
        }
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSegment || !message) return;

        setSending(true);
        try {
            const res = await sendCrmCampaign(
                selectedSegment,
                title || 'Admin Announcement',
                message,
                (adminUser as any)?.id,
            );

            if (res.success) {
                const record: CampaignRecord = {
                    segment: selectedSegment,
                    message,
                    type: msgType,
                    sentAt: new Date().toISOString(),
                    count: res.sentCount ?? users.length,
                };
                const updated = [record, ...campaigns].slice(0, 10);
                setCampaigns(updated);
                localStorage.setItem('admin_campaigns', JSON.stringify(updated));
                setMessage('');
                setTitle('');
                alert(`✅ Campaign sent to ${res.sentCount ?? users.length} users in ${selectedSegment} segment!`);
            } else {
                alert(res.error || 'Failed to send notification.');
            }
        } catch (error) {
            console.error("Failed to send", error);
            alert("Failed to send notification.");
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin" /> Loading CRM...</div>;

    const cards = [
        { id: 'VIP', title: 'VIP Players', count: segments?.vip || 0, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'hover:border-amber-500/50' },
        { id: 'NEW', title: 'New Registrations', count: segments?.new || 0, icon: UserPlus, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'hover:border-emerald-500/50' },
        { id: 'ACTIVE', title: 'Active Players', count: segments?.active || 0, icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'hover:border-indigo-500/50' },
        { id: 'CHURNED', title: 'Churn Risk', count: segments?.churned || 0, icon: UserMinus, color: 'text-red-400', bg: 'bg-red-500/10', border: 'hover:border-red-500/50' },
        { id: 'DORMANT', title: 'Dormant (30d)', count: segments?.dormant || 0, icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'hover:border-slate-500/50' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">CRM &amp; Segmentation</h1>
                <p className="text-slate-400 mt-1">Analyze player segments and engage with targeted campaigns.</p>
            </div>

            {/* Segment Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {cards.map(card => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.id}
                            onClick={() => handleSegmentClick(card.id)}
                            className={`bg-slate-800 p-5 rounded-xl border transition-all text-left ${selectedSegment === card.id ? 'border-2 border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-700 ' + card.border}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2.5 rounded-lg ${card.bg} ${card.color}`}>
                                    <Icon size={20} />
                                </div>
                                <span className="text-2xl font-bold text-white">{card.count}</span>
                            </div>
                            <h3 className="font-medium text-slate-300 text-sm">{card.title}</h3>
                        </button>
                    );
                })}
            </div>

            {/* Detail View */}
            {selectedSegment && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                    {/* User List */}
                    <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[500px]">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-white">Users in {selectedSegment} Segment</h3>
                            <span className="text-xs text-slate-400 px-2 py-1 bg-slate-900 rounded">{users.length} shown</span>
                        </div>
                        <div className="overflow-y-auto flex-1 p-3 space-y-2">
                            {usersLoading ? (
                                <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin" /></div>
                            ) : (
                                <>
                                    {users.map(user => (
                                        <Link
                                            href={`/dashboard/users/${user.id}`}
                                            key={user.id}
                                            className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg hover:bg-slate-700/50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {user.username?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white group-hover:text-indigo-300 transition-colors text-sm">{user.username}</div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-emerald-400 font-mono">
                                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(user.balance)}
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                    {users.length === 0 && <p className="text-center text-slate-500 py-8">No users found in this segment.</p>}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Campaign Composer */}
                    <div className="space-y-4">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 h-fit">
                            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                <Send size={18} className="text-indigo-400" />
                                Send Campaign
                            </h3>
                            <form onSubmit={handleSendNotification} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Target Audience</label>
                                    <div className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-indigo-400 font-mono text-sm">
                                        {selectedSegment} ({users.length} users)
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Message Type</label>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setMsgType('PUSH')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors border ${msgType === 'PUSH' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>Push Notification</button>
                                        <button type="button" onClick={() => setMsgType('EMAIL')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors border ${msgType === 'EMAIL' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>Email</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Title</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Campaign title..." className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Message *</label>
                                    <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Enter message..." className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white h-28 resize-none focus:border-indigo-500 focus:outline-none text-sm" required />
                                </div>
                                <button type="submit" disabled={sending || !message} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm">
                                    {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                    Send Campaign
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign History */}
            {campaigns.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                        <h3 className="font-bold text-white text-sm">Recent Campaigns</h3>
                    </div>
                    <div className="divide-y divide-slate-700/50">
                        {campaigns.map((c, i) => (
                            <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-700/20">
                                <div>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 mr-2">{c.segment}</span>
                                    <span className="text-slate-300 text-sm">{c.message.substring(0, 80)}{c.message.length > 80 ? '...' : ''}</span>
                                </div>
                                <div className="text-right shrink-0 ml-4">
                                    <p className="text-xs text-slate-400">{new Date(c.sentAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                    <p className="text-xs text-slate-500">{c.count} recipients</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
