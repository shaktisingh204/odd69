"use client";

import React, { useEffect, useState, useRef } from 'react';
import { getAllTickets, getTicket, closeTicket, reopenTicket, getStats } from '@/actions/support';
import { SupportTicket, SupportMessage } from '../../../services/support.service';
import socket from '../../../services/socket';
import {
    ArrowLeft, MessageSquare, Send, Search, CheckCircle, XCircle, RefreshCw,
    RotateCcw, Inbox, Clock, BarChart2, User
} from 'lucide-react';

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const isOpen = status === 'OPEN';
    return (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isOpen ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
            {status}
        </span>
    );
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────
function StatsBar({ stats }: { stats: { total: number; open: number; closed: number } }) {
    return (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
                { label: 'Total', val: stats.total, icon: BarChart2, color: 'text-indigo-400' },
                { label: 'Open', val: stats.open, icon: Inbox, color: 'text-emerald-400' },
                { label: 'Closed', val: stats.closed, icon: CheckCircle, color: 'text-slate-400' },
            ].map(({ label, val, icon: Icon, color }) => (
                <div key={label} className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
                    <Icon size={18} className={color} />
                    <div>
                        <p className={`font-black text-xl ${color}`}>{val}</p>
                        <p className="text-slate-500 text-[10px] uppercase tracking-wide">{label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SupportPage() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, open: 0, closed: 0 });
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
    const [search, setSearch] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pendingRef = useRef<Set<number>>(new Set());

    // ── Load ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        loadAll();
        socket.emit('adminJoinSupport');

        socket.on('newMessage', (msg: SupportMessage & { userId?: number }) => {
            // Add message to current chat if viewing this ticket
            if (selectedTicket && msg.ticketId === selectedTicket.id) {
                setMessages(prev => {
                    // Replace optimistic pending message if match found
                    if (pendingRef.current.size > 0) {
                        const pendingId = Array.from(pendingRef.current).find(pid => {
                            const pendingMsg = prev.find(m => m.id === pid);
                            return pendingMsg && pendingMsg.message === msg.message && pendingMsg.sender === msg.sender;
                        });
                        if (pendingId !== undefined) {
                            pendingRef.current.delete(pendingId);
                            return prev.map(m => m.id === pendingId ? msg : m);
                        }
                    }
                    // Skip if already present
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                scrollToBottom();
            }
            // Bump ticket to top in list
            setTickets(prev => {
                const idx = prev.findIndex(t => t.id === msg.ticketId);
                if (idx === -1) {
                    // New ticket we haven't seen — reload list
                    loadAll();
                    return prev;
                }
                const updated = [...prev];
                updated[idx] = { ...updated[idx], updatedAt: new Date().toISOString() };
                return [updated[idx], ...updated.filter((_, i) => i !== idx)];
            });
        });

        return () => { socket.off('newMessage'); };
    }, [selectedTicket]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [ticketRes, statsRes] = await Promise.all([getAllTickets(), getStats()]);
            if (ticketRes.success && ticketRes.data) setTickets(ticketRes.data);
            if (statsRes.success && statsRes.data) setStats(statsRes.data);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTicket = async (ticket: any) => {
        setSelectedTicket(ticket);
        const res = await getTicket(ticket.id);
        if (res.success && res.data) {
            setSelectedTicket(res.data);
            setMessages(res.data.messages || []);
            scrollToBottom();
        }
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket || !newMessage.trim()) return;
        const text = newMessage.trim();

        // Optimistic update with negative temp id
        const tempId = -Date.now();
        const tempMsg: any = { id: tempId, ticketId: selectedTicket.id, message: text, sender: 'ADMIN', createdAt: new Date().toISOString() };
        pendingRef.current.add(tempId);
        setMessages(prev => [...prev, tempMsg]);
        setNewMessage('');
        scrollToBottom();

        // Send via socket — gateway saves + broadcasts to both rooms
        socket.emit('sendMessage', { ticketId: selectedTicket.id, message: text, sender: 'ADMIN' });
    };

    const handleCloseTicket = async () => {
        if (!selectedTicket) return;
        setActionLoading(true);
        await closeTicket(selectedTicket.id);
        setSelectedTicket(prev => prev ? { ...prev, status: 'CLOSED' } : prev);
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'CLOSED' } : t));
        setStats(prev => ({ ...prev, open: prev.open - 1, closed: prev.closed + 1 }));
        setActionLoading(false);
    };

    const handleReopenTicket = async () => {
        if (!selectedTicket) return;
        setActionLoading(true);
        await reopenTicket(selectedTicket.id);
        setSelectedTicket(prev => prev ? { ...prev, status: 'OPEN' } : prev);
        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'OPEN' } : t));
        setStats(prev => ({ ...prev, open: prev.open + 1, closed: prev.closed - 1 }));
        setActionLoading(false);
    };

    const scrollToBottom = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    // ── Derived ───────────────────────────────────────────────────────────────
    const filteredTickets = tickets.filter(t => {
        const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
        const matchSearch = !search || t.subject?.toLowerCase().includes(search.toLowerCase()) || t.user?.username?.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
    });

    const hasUnread = (ticket: SupportTicket) => {
        const msgs = (ticket as any).messages as SupportMessage[] | undefined;
        if (!msgs?.length) return false;
        return msgs[msgs.length - 1]?.sender === 'USER';
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-[calc(100dvh-6rem)] flex-col gap-4">
            {/* Stats */}
            <StatsBar stats={stats} />

            <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
                {/* Left: Ticket List */}
                <div className={`${selectedTicket ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800 md:w-[340px]`}>
                    {/* Toolbar */}
                    <div className="p-3 border-b border-slate-700 space-y-2">
                        <div className="flex items-center justify-between">
                            <h2 className="font-black text-white text-sm">Support Tickets</h2>
                            <button onClick={loadAll} className="text-slate-400 hover:text-white transition-colors p-1">
                                <RefreshCw size={14} />
                            </button>
                        </div>
                        {/* Search */}
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search tickets or users..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white pl-8 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        {/* Status Filter */}
                        <div className="flex gap-1">
                            {(['ALL', 'OPEN', 'CLOSED'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`flex-1 text-[10px] font-bold py-1 rounded-md transition-all ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ticket List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading && (
                            <div className="p-8 text-center text-slate-500 text-sm">Loading...</div>
                        )}
                        {!loading && filteredTickets.length === 0 && (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                <Inbox size={32} className="mx-auto mb-2 opacity-40" />
                                No tickets found
                            </div>
                        )}
                        {filteredTickets.map(ticket => {
                            const isSelected = selectedTicket?.id === ticket.id;
                            const unread = hasUnread(ticket);
                            const lastMsg = (ticket as any).messages?.[0] as SupportMessage | undefined;
                            return (
                                <div
                                    key={ticket.id}
                                    onClick={() => handleSelectTicket(ticket)}
                                    className={`p-3.5 border-b border-slate-700/50 cursor-pointer transition-all ${isSelected ? 'bg-indigo-900/30 border-l-2 border-l-indigo-500' : 'hover:bg-slate-750 border-l-2 border-l-transparent'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`font-bold text-sm max-w-[70%] truncate ${unread ? 'text-white' : 'text-slate-300'}`}>
                                            {unread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5 mb-0.5" />}
                                            {ticket.subject || 'No Subject'}
                                        </span>
                                        <StatusBadge status={ticket.status} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <User size={11} />
                                            {ticket.user?.username || `User #${ticket.userId}`}
                                        </span>
                                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                            <Clock size={10} />
                                            {new Date(ticket.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {lastMsg && (
                                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                                            {lastMsg.sender === 'ADMIN' ? '↳ You: ' : '↳ User: '}{lastMsg.message}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Chat Area */}
                <div className={`${selectedTicket ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800`}>
                    {selectedTicket ? (
                        <>
                            {/* Chat Header */}
                            <div className="shrink-0 border-b border-slate-700 bg-slate-900/50 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <button
                                            onClick={() => setSelectedTicket(null)}
                                            className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white md:hidden"
                                        >
                                            <ArrowLeft size={12} />
                                            Back to tickets
                                        </button>
                                        <h3 className="font-black text-white text-sm">{selectedTicket.subject || 'No Subject'}</h3>
                                        <p className="text-xs text-slate-400">
                                            <span className="text-indigo-400">{selectedTicket.user?.username}</span>
                                            {' '} · Ticket #{selectedTicket.id}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <StatusBadge status={selectedTicket.status} />
                                        {selectedTicket.status === 'OPEN' ? (
                                            <button
                                                onClick={handleCloseTicket}
                                                disabled={actionLoading}
                                                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 transition-all hover:bg-red-500/30 disabled:opacity-50"
                                            >
                                                <XCircle size={12} />
                                                Close Ticket
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleReopenTicket}
                                                disabled={actionLoading}
                                                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/30 disabled:opacity-50"
                                            >
                                                <RotateCcw size={12} />
                                                Reopen
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {messages.map((msg, idx) => {
                                    const isAdmin = msg.sender === 'ADMIN';
                                    return (
                                        <div key={idx} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`flex max-w-[90%] flex-col gap-1 sm:max-w-[80%] ${isAdmin ? 'items-end' : 'items-start'}`}>
                                                {!isAdmin && <span className="text-[9px] font-bold text-slate-500 uppercase px-1">User</span>}
                                                {isAdmin && <span className="text-[9px] font-bold text-indigo-400 uppercase px-1">You (Support)</span>}
                                                <div className={`px-4 py-2.5 rounded-xl text-sm ${isAdmin ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-700 text-slate-100 rounded-bl-sm'}`}>
                                                    {msg.message}
                                                </div>
                                                <p className={`text-[9px] px-1 ${isAdmin ? 'text-indigo-300' : 'text-slate-500'}`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            {selectedTicket.status === 'OPEN' ? (
                                <form onSubmit={handleSendMessage} className="shrink-0 border-t border-slate-700 bg-slate-900 p-3">
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        type="text"
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                                        placeholder="Type your reply..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className="rounded-xl bg-indigo-600 p-2.5 text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        <Send size={18} />
                                    </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="p-3 border-t border-slate-700 shrink-0 text-center text-slate-500 text-xs bg-slate-900">
                                    This ticket is closed. Reopen to reply.
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <MessageSquare size={48} className="mb-3 opacity-30" />
                            <p className="text-sm">Select a ticket to start chatting</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
