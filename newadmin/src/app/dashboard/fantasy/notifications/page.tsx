"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Bell, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAdminNotifications, broadcastNotification } from '@/actions/fantasy-extras';

interface Notif { _id: string; userId?: number; type: string; title: string; body: string; isRead: boolean; matchId?: number; contestId?: string; createdAt: string }

export default function NotificationsAdminPage() {
    const [rows, setRows] = useState<Notif[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Broadcast form
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [userIds, setUserIds] = useState('');
    const [type, setType] = useState('system');
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState('');

    const load = async () => {
        setLoading(true);
        const res = await getAdminNotifications(page, 100);
        if (res.success && res.data) {
            setRows(res.data as Notif[]);
            setPages(res.pagination?.pages || 1);
            setTotal(res.pagination?.total || 0);
        }
        setLoading(false);
    };
    useEffect(() => { load(); }, [page]);

    const send = async () => {
        if (!title || !body) { setMsg('Title & body required'); return; }
        setSending(true);
        const ids = userIds.trim()
            ? userIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
            : undefined;
        const res = await broadcastNotification({ title, body, type, userIds: ids });
        setSending(false);
        setMsg(res.success ? 'Sent.' : (res.error || 'Failed'));
        if (res.success) { setTitle(''); setBody(''); setUserIds(''); await load(); }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-5">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2"><Bell size={18} className="text-brand-gold" /> Notifications</h1>
                <p className="text-sm text-white/40 mt-0.5">Broadcast fantasy-specific notifications. Delivered in-app + via socket.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5 space-y-3">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40">Send broadcast</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title *" className="input" />
                    <input value={type} onChange={e => setType(e.target.value)} placeholder="Type (system | promo | match | …)" className="input" />
                </div>
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Body *" rows={3}
                    className="input w-full" />
                <input value={userIds} onChange={e => setUserIds(e.target.value)}
                    placeholder="Target user IDs (comma-separated, blank = all users)" className="input w-full" />
                {msg && <p className="text-[11px] text-brand-gold/80">{msg}</p>}
                <div className="flex justify-end">
                    <button onClick={send} disabled={sending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90 disabled:opacity-50">
                        {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Broadcast
                    </button>
                </div>
            </div>

            <div>
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-2">Recent ({total})</h2>
                {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-brand-gold" /></div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 text-white/25 text-sm">No notifications.</div>
                ) : (
                    <div className="space-y-1">
                        {rows.map(n => (
                            <div key={n._id} className="rounded-xl border border-white/[0.06] bg-bg-elevated p-3 flex items-start gap-3">
                                <span className="text-[10px] uppercase tracking-widest font-black text-brand-gold bg-brand-gold/10 rounded px-2 py-0.5 mt-0.5">{n.type}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-black truncate">{n.title}</p>
                                    <p className="text-[12px] text-white/60 truncate">{n.body}</p>
                                    <p className="text-[10px] text-white/30 mt-0.5">
                                        {new Date(n.createdAt).toLocaleString('en-IN')}
                                        {n.userId ? ` • user #${n.userId}` : ' • broadcast'}
                                        {n.matchId ? ` • match ${n.matchId}` : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {!loading && rows.length > 0 && (
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/30">Page {page} of {pages}</span>
                    <div className="flex gap-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-2 rounded-lg bg-bg-elevated text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={14} /></button>
                        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-lg bg-bg-elevated text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={14} /></button>
                    </div>
                </div>
            )}

            <style jsx>{`:global(.input){background:#0b0d11;color:white;font-size:13px;font-weight:600;border-radius:12px;border:1px solid rgba(255,255,255,0.1);padding:8px 12px;outline:none}:global(.input:focus){border-color:rgba(234,179,8,0.5)}`}</style>
        </div>
    );
}
