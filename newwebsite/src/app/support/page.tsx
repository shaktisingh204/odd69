'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
    Headphones, MessageCircle, Mail, ChevronDown,
    Clock, Shield, Zap, BookOpen, Search, Send, X, CheckCircle,
    PhoneCall, FileText, HelpCircle, AlertCircle, Globe,
    ArrowLeft, Plus, Ticket, Lock, Loader2, ChevronRight,
    ExternalLink, Home, Image, Youtube, Video, Link2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
    supportApi, SupportTicket, SupportMessage,
    joinSupportRoom, sendSocketMessage, onNewMessage
} from '@/services/support';
import api from '@/services/api';
import ChatwootWidget from '@/components/shared/ChatwootWidget';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactSettings {
    whatsappNumber: string;
    whatsappLabel: string;
    whatsappDefaultMessage: string;
    telegramHandle: string;
    telegramLink: string;
    emailAddress: string;
    whatsappEnabled: boolean;
    telegramEnabled: boolean;
    emailEnabled: boolean;
}

// ─── FAQ Types & Category Config ─────────────────────────────────────────────

interface FaqMediaItem {
    type: 'image' | 'video' | 'youtube' | 'link';
    url: string;
    caption?: string;
}

interface FaqEntry {
    _id: string;
    question: string;
    answer: string;
    category: string;
    media?: FaqMediaItem[];
    order: number;
}

const CATEGORY_META: Record<string, { icon: React.ComponentType<{ size: number }>; color: string; bg: string; label: string }> = {
    account: { icon: Shield, color: 'text-brand-gold', bg: 'bg-brand-gold/10', label: 'Account & Security' },
    payments: { icon: Zap, color: 'text-brand-gold', bg: 'bg-brand-gold/10', label: 'Deposits & Withdrawals' },
    bonuses: { icon: BookOpen, color: 'text-pink-400', bg: 'bg-pink-400/10', label: 'Bonuses & Promotions' },
    sports: { icon: Globe, color: 'text-teal-400', bg: 'bg-teal-400/10', label: 'Sports Betting' },
    casino: { icon: Zap, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Casino' },
    technical: { icon: FileText, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Technical' },
    general: { icon: HelpCircle, color: 'text-slate-400', bg: 'bg-slate-400/10', label: 'General' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
}

function parseSubject(subject: string) {
    const match = subject?.match(/^\[(.+?)\]\s*(.*)/);
    if (match) return { category: match[1], subject: match[2] };
    return { category: null, subject: subject || 'No Subject' };
}

function highlight(text: string, query: string) {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className="bg-brand-gold/30 text-brand-gold rounded px-0.5">{part}</mark>
            : part
    );
}

// ─── YouTube ID helper ──────────────────────────────────────────────────────

function getYoutubeId(url: string) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([^&?\s]+)/);
    return match?.[1] || null;
}

// ─── FAQ Media Renderer ─────────────────────────────────────────────────────

function FaqMediaRenderer({ media }: { media: FaqMediaItem[] }) {
    if (!media?.length) return null;
    return (
        <div className="mt-3 space-y-3">
            {media.map((item, i) => {
                switch (item.type) {
                    case 'image':
                        return (
                            <div key={i} className="rounded-xl overflow-hidden border border-white/[0.04]">
                                <img src={item.url} alt={item.caption || ''} className="w-full max-h-72 object-cover" loading="lazy" />
                                {item.caption && <p className="text-xs text-text-muted px-3 py-2 bg-bg-odd69">{item.caption}</p>}
                            </div>
                        );
                    case 'youtube': {
                        const ytId = getYoutubeId(item.url);
                        return ytId ? (
                            <div key={i} className="rounded-xl overflow-hidden border border-white/[0.04]">
                                <div className="aspect-video">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${ytId}`}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        loading="lazy"
                                    />
                                </div>
                                {item.caption && <p className="text-xs text-text-muted px-3 py-2 bg-bg-odd69">{item.caption}</p>}
                            </div>
                        ) : null;
                    }
                    case 'video':
                        return (
                            <div key={i} className="rounded-xl overflow-hidden border border-white/[0.04]">
                                <video src={item.url} controls className="w-full max-h-72" preload="metadata" />
                                {item.caption && <p className="text-xs text-text-muted px-3 py-2 bg-bg-odd69">{item.caption}</p>}
                            </div>
                        );
                    case 'link':
                        return (
                            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 bg-bg-odd69 border border-white/[0.04] rounded-xl text-sm hover:border-brand-gold/30 transition-all group">
                                <div className="p-2 rounded-lg bg-brand-gold/10 text-brand-gold group-hover:bg-brand-gold/20 transition-colors">
                                    <Link2 size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">{item.caption || item.url}</p>
                                    {item.caption && <p className="text-text-disabled text-xs truncate">{item.url}</p>}
                                </div>
                                <ExternalLink size={14} className="text-text-muted flex-shrink-0" />
                            </a>
                        );
                    default:
                        return null;
                }
            })}
        </div>
    );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ faq, searchQuery = '' }: { faq: FaqEntry; searchQuery?: string }) {
    const [open, setOpen] = useState(!!searchQuery);
    useEffect(() => { if (searchQuery) setOpen(true); }, [searchQuery]);
    return (
        <div className={`border border-white/[0.04] rounded-xl overflow-hidden transition-all duration-200 ${open ? 'bg-bg-modal' : 'bg-bg-odd69 hover:bg-bg-modal'}`}>
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
                <span className="text-white font-semibold text-sm leading-snug">{highlight(faq.question, searchQuery)}</span>
                <ChevronDown size={18} className={`text-text-muted flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-brand-gold' : ''}`} />
            </button>
            {open && (
                <div className="px-5 pb-4 border-t border-white/[0.04] pt-3">
                    <div className="text-text-muted text-sm leading-relaxed whitespace-pre-wrap">{highlight(faq.answer, searchQuery)}</div>
                    {faq.media && faq.media.length > 0 && <FaqMediaRenderer media={faq.media} />}
                </div>
            )}
        </div>
    );
}

// ─── WhatsApp / Contact Cards ────────────────────────────────────────────────

interface ContactCardsProps {
    contacts: ContactSettings | null;
    onOpenTicket: () => void;
}

function ContactCards({ contacts, onOpenTicket }: ContactCardsProps) {
    const cards = [];

    // WhatsApp
    if (contacts?.whatsappEnabled && contacts.whatsappNumber) {
        const waUrl = `https://wa.me/${contacts.whatsappNumber.replace(/\D/g, '')}${contacts.whatsappDefaultMessage ? `?text=${encodeURIComponent(contacts.whatsappDefaultMessage)}` : ''}`;
        cards.push(
            <a key="wa" href={waUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col gap-4 p-5 rounded-2xl border border-green-500/20 bg-green-500/5 hover:scale-[1.01] transition-all">
                <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-white/[0.04] text-green-400">
                        <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                    </div>
                    <span className="text-[10px] font-black text-white px-2 py-1 rounded-full bg-green-500">Online Now</span>
                </div>
                <div>
                    <p className="text-white font-bold text-base">WhatsApp {contacts.whatsappLabel}</p>
                    <p className="text-text-muted text-sm mt-0.5">Chat with us instantly on WhatsApp</p>
                </div>
                <div className="w-full py-2.5 rounded-xl font-bold text-sm border border-green-500/20 text-green-400 hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2">
                    <ExternalLink size={14} /> Open WhatsApp
                </div>
            </a>
        );
    }

    // Telegram  
    if (contacts?.telegramEnabled && (contacts.telegramHandle || contacts.telegramLink)) {
        const tgUrl = contacts.telegramLink || `https://t.me/${contacts.telegramHandle?.replace('@', '')}`;
        cards.push(
            <a key="tg" href={tgUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col gap-4 p-5 rounded-2xl border border-brand-gold/20 bg-sky-400/5 hover:scale-[1.01] transition-all">
                <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-white/[0.04] text-brand-gold"><PhoneCall size={22} /></div>
                    <span className="text-[10px] font-black text-white px-2 py-1 rounded-full bg-sky-500">Fast</span>
                </div>
                <div>
                    <p className="text-white font-bold text-base">Telegram</p>
                    <p className="text-text-muted text-sm mt-0.5">{contacts.telegramHandle || 'Our support channel'}</p>
                </div>
                <div className="w-full py-2.5 rounded-xl font-bold text-sm border border-brand-gold/20 text-brand-gold hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2">
                    <ExternalLink size={14} /> Open Telegram
                </div>
            </a>
        );
    }

    // Email
    if (contacts?.emailEnabled && contacts.emailAddress) {
        cards.push(
            <a key="email" href={`mailto:${contacts.emailAddress}`}
                className="flex flex-col gap-4 p-5 rounded-2xl border border-brand-gold/20 bg-blue-400/5 hover:scale-[1.01] transition-all">
                <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-white/[0.04] text-brand-gold"><Mail size={22} /></div>
                    <span className="text-[10px] font-black text-white px-2 py-1 rounded-full bg-brand-gold">&lt; 24h reply</span>
                </div>
                <div>
                    <p className="text-white font-bold text-base">Email Support</p>
                    <p className="text-text-muted text-sm mt-0.5">{contacts.emailAddress}</p>
                </div>
                <div className="w-full py-2.5 rounded-xl font-bold text-sm border border-brand-gold/20 text-brand-gold hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2">
                    <ExternalLink size={14} /> Send Email
                </div>
            </a>
        );
    }

    // Live Support ticket (always shown)
    cards.push(
        <button key="ticket" onClick={onOpenTicket}
            className="flex flex-col gap-4 p-5 rounded-2xl border border-brand-gold/20 bg-brand-gold/5 hover:scale-[1.01] transition-all text-left">
            <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-white/[0.04] text-brand-gold"><MessageCircle size={22} /></div>
                <span className="text-[10px] font-black text-white px-2 py-1 rounded-full bg-brand-gold text-text-inverse">24/7</span>
            </div>
            <div>
                <p className="text-white font-bold text-base">Live Support Ticket</p>
                <p className="text-text-muted text-sm mt-0.5">Open a ticket — we reply within minutes</p>
            </div>
            <div className="w-full py-2.5 rounded-xl font-bold text-sm border border-brand-gold/20 text-brand-gold hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2">
                <Plus size={14} /> Open Ticket
            </div>
        </button>
    );

    const cols = cards.length === 1 ? 'grid-cols-1 max-w-sm' : cards.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    return <div className={`grid ${cols} gap-4`}>{cards}</div>;
}

// ─── Live Chat View ──────────────────────────────────────────────────────────

function LiveChat({ ticket, userId, onBack }: { ticket: SupportTicket; userId: number; onBack: () => void }) {
    const [messages, setMessages] = useState<SupportMessage[]>(ticket.messages || []);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pendingRef = useRef<Set<number>>(new Set());
    const { category, subject } = parseSubject(ticket.subject);

    useEffect(() => {
        joinSupportRoom(userId);
        supportApi.getTicket(ticket.id).then(t => {
            if (t?.messages) setMessages(t.messages);
            scrollToBottom();
        });
        const unsub = onNewMessage((msg) => {
            if (msg.ticketId === ticket.id) {
                setMessages(prev => {
                    // If this is a real message replacing a pending one, swap it
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
                    // Otherwise add if not duplicate
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                scrollToBottom();
            }
        });
        return unsub;
    }, [ticket.id, userId]);

    const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || sending) return;
        const text = input.trim();
        setInput('');
        setSending(true);
        // Optimistic update with temp negative id
        const tempId = -Date.now();
        const tempMsg: SupportMessage = { id: tempId, ticketId: ticket.id, sender: 'USER', message: text, createdAt: new Date().toISOString() };
        pendingRef.current.add(tempId);
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();
        // Send via socket — gateway saves + broadcasts to both rooms
        sendSocketMessage(ticket.id, text);
        setSending(false);
    };

    const isClosed = ticket.status === 'CLOSED';

    return (
        <div className="flex flex-col bg-bg-deep rounded-2xl border border-white/[0.04] overflow-hidden" style={{ minHeight: '520px' }}>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] bg-bg-odd69 shrink-0">
                <button onClick={onBack} className="text-text-muted hover:text-white transition-colors p-1"><ArrowLeft size={18} /></button>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{subject}</p>
                    <div className="flex items-center gap-2">
                        {category && <span className="text-[10px] bg-brand-gold/20 text-brand-gold px-1.5 py-0.5 rounded">{category}</span>}
                        <span className={`text-[10px] font-bold ${isClosed ? 'text-text-muted' : 'text-green-400'}`}>
                            ● {isClosed ? 'Closed' : 'Open'} · #{ticket.id}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-text-muted text-sm">
                        <MessageCircle size={32} className="mb-2 opacity-30" />Start the conversation below
                    </div>
                )}
                {messages.map((msg) => {
                    const isUser = msg.sender === 'USER';
                    return (
                        <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                {!isUser && <span className="text-[10px] text-text-disabled px-1 font-bold uppercase">Support</span>}
                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-snug ${isUser ? 'bg-brand-gold text-text-inverse rounded-br-sm font-medium' : 'bg-bg-modal text-white border border-white/[0.04] rounded-bl-sm'}`}>
                                    {msg.message}
                                </div>
                                <span className="text-[9px] text-text-disabled px-1">{timeAgo(msg.createdAt)}</span>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>
            <div className="shrink-0 p-3 border-t border-white/[0.04]">
                {isClosed ? (
                    <div className="flex items-center justify-center gap-2 py-2 text-text-muted text-sm"><Lock size={14} />This ticket is closed</div>
                ) : (
                    <form onSubmit={handleSend} className="flex gap-2">
                        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Type your message..."
                            className="flex-1 bg-bg-modal border border-white/[0.06] focus:border-brand-gold/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-text-disabled outline-none transition-all" />
                        <button type="submit" disabled={!input.trim() || sending}
                            className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${input.trim() && !sending ? 'bg-brand-gold text-text-inverse' : 'bg-white/[0.04] text-text-disabled cursor-not-allowed'}`}>
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── New Ticket Form ──────────────────────────────────────────────────────────

function NewTicketForm({ onCreated }: { onCreated: (ticket: SupportTicket) => void }) {
    const [form, setForm] = useState({ subject: '', category: '', message: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.subject || !form.message) return;
        setSubmitting(true); setError('');
        try {
            const ticket = await supportApi.createTicket({ subject: form.subject, category: form.category || undefined, message: form.message });
            onCreated(ticket);
        } catch { setError('Failed to submit. Please try again.'); }
        finally { setSubmitting(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="flex items-center gap-2 p-3 bg-danger-alpha-10 border border-danger/20 rounded-xl text-danger text-sm"><AlertCircle size={15} />{error}</div>}
            <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-bg-odd69 border border-white/[0.06] focus:border-brand-gold/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all appearance-none">
                    <option value="">General</option>
                    <option value="Account">Account & Verification</option>
                    <option value="Deposit">Deposits</option>
                    <option value="Withdrawal">Withdrawals</option>
                    <option value="Bonus">Bonuses & Promotions</option>
                    <option value="Sports">Sports Betting</option>
                    <option value="Casino">Casino</option>
                    <option value="Technical">Technical Issue</option>
                </select>
            </div>
            <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block">Subject</label>
                <input type="text" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief description of your issue" required
                    className="w-full bg-bg-odd69 border border-white/[0.06] focus:border-brand-gold/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-text-disabled outline-none transition-all" />
            </div>
            <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block">Message</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Describe your issue in detail..." rows={4} required
                    className="w-full bg-bg-odd69 border border-white/[0.06] focus:border-brand-gold/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-text-disabled outline-none transition-all resize-none" />
            </div>
            <button type="submit" disabled={submitting}
                className="w-full py-3 bg-brand-gold hover:bg-brand-gold-hover text-text-inverse font-black text-sm uppercase rounded-xl flex items-center justify-center gap-2 shadow-glow-gold transition-all disabled:opacity-70">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
        </form>
    );
}

// ─── My Tickets Panel ────────────────────────────────────────────────────────

function MyTickets({ onOpen }: { onOpen: (ticket: SupportTicket) => void }) {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { supportApi.getMyTickets().then(setTickets).catch(() => setTickets([])).finally(() => setLoading(false)); }, []);
    if (loading) return <div className="flex items-center justify-center py-10"><Loader2 size={22} className="animate-spin text-brand-gold" /></div>;
    if (tickets.length === 0) return <div className="flex flex-col items-center justify-center py-10 text-text-muted text-sm gap-2"><Ticket size={32} className="opacity-30 mb-1" />No support tickets yet.</div>;
    return (
        <div className="space-y-2">
            {tickets.map(ticket => {
                const { category, subject } = parseSubject(ticket.subject);
                const lastMsg = ticket.messages?.[0];
                return (
                    <button key={ticket.id} onClick={() => onOpen(ticket)}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-bg-odd69 border border-white/[0.04] hover:bg-bg-modal hover:border-brand-gold/20 transition-all text-left">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ticket.status === 'OPEN' ? 'bg-green-400' : 'bg-text-muted'}`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm truncate">{subject}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                {category && <span className="text-[9px] bg-brand-gold/15 text-brand-gold px-1.5 py-0.5 rounded font-bold">{category}</span>}
                                {lastMsg && <span className="text-text-disabled text-[10px] truncate">{lastMsg.sender === 'ADMIN' ? '🔵 Support: ' : 'You: '}{lastMsg.message}</span>}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${ticket.status === 'OPEN' ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.04] text-text-muted'}`}>{ticket.status}</span>
                            <span className="text-[9px] text-text-disabled">{timeAgo(ticket.updatedAt)}</span>
                        </div>
                        <ChevronRight size={14} className="text-text-muted flex-shrink-0" />
                    </button>
                );
            })}
        </div>
    );
}

// ─── Search Result Item (dropdown row) ───────────────────────────────────────

function SearchResultItem({ faq, searchQuery, isLast }: {
    faq: FaqEntry; searchQuery: string; isLast: boolean;
}) {
    const [open, setOpen] = useState(false);
    const meta = CATEGORY_META[faq.category] || CATEGORY_META.general;
    const Icon = meta.icon;
    return (
        <div className={`px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer ${!isLast ? 'border-b border-white/[0.04]' : ''}`} onClick={() => setOpen(o => !o)}>
            <div className={`inline-flex items-center gap-1.5 ${meta.color} text-[9px] font-black uppercase tracking-widest mb-1.5`}>
                <div className={`p-0.5 rounded ${meta.bg}`}><Icon size={9} /></div>
                {meta.label}
            </div>
            <p className="text-white text-sm font-semibold leading-snug">{highlight(faq.question, searchQuery)}</p>
            {open && <p className="text-text-muted text-xs mt-2 leading-relaxed">{highlight(faq.answer, searchQuery)}</p>}
            <p className="text-text-disabled text-[10px] mt-1">{open ? 'Click to collapse' : 'Click to read answer'}</p>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type View = 'home' | 'new-ticket' | 'chat';
type FaqTab = 'all' | string;

export default function SupportPage() {
    const { user, isAuthenticated } = useAuth();
    const [view, setView] = useState<View>('home');
    const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
    const [contacts, setContacts] = useState<ContactSettings | null>(null);

    // FAQ state
    const [faqs, setFaqs] = useState<FaqEntry[]>([]);
    const [faqLoading, setFaqLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [faqTab, setFaqTab] = useState<FaqTab>('all');
    const searchRef = useRef<HTMLDivElement>(null);

    // Load contact settings + FAQs
    useEffect(() => {
        api.get('/contact-settings').then(res => setContacts(res.data)).catch(() => { });
        supportApi.getFaqs()
            .then((res: any) => {
                const data = Array.isArray(res) ? res : res?.data || [];
                setFaqs(data);
            })
            .catch(() => setFaqs([]))
            .finally(() => setFaqLoading(false));
    }, []);

    // Close dropdown on outside click or Escape
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
        };
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSearchOpen(false); };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
    }, []);

    const handleOpenTicket = useCallback((ticket: SupportTicket) => {
        setActiveTicket(ticket); setView('chat');
    }, []);

    const handleTicketCreated = useCallback((ticket: SupportTicket) => {
        setActiveTicket(ticket); setView('chat');
    }, []);

    // FAQ: search results (used in dropdown)
    const searchResults = search.trim()
        ? faqs.filter(f => f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase()))
        : [];

    // FAQ: unique categories from dynamic data
    const faqCategories = Array.from(new Set(faqs.map(f => f.category)));

    // FAQ: filtered by category tab
    const filteredFaqs = faqTab === 'all' ? faqs : faqs.filter(f => f.category === faqTab);

    // Group filtered FAQs by category for rendering
    const groupedFaqs = faqCategories
        .filter(cat => faqTab === 'all' || cat === faqTab)
        .map(cat => ({
            category: cat,
            meta: CATEGORY_META[cat] || CATEGORY_META.general,
            items: filteredFaqs.filter(f => f.category === cat),
        }))
        .filter(g => g.items.length > 0);

    const faqTabs: { id: FaqTab; label: string }[] = [
        { id: 'all', label: 'All' },
        ...faqCategories.map(cat => ({
            id: cat as FaqTab,
            label: (CATEGORY_META[cat] || CATEGORY_META.general).label,
        })),
    ];

    return (
        <div className="min-h-[calc(100vh-64px)] bg-bg-odd69-3 text-white pb-24">

            {/* ── Hero ── */}
            <div className="relative bg-gradient-to-b from-brand-gold/10 via-[#0F1016] to-[#0C0D12] border-b border-white/[0.04]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255, 122, 26,0.025),transparent_60%)]" />
                <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-8 text-center">
                    {/* Back to website — PC only */}
                    <div className="hidden md:flex absolute top-6 left-4">
                        <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] px-4 py-2 rounded-full">
                            <Home size={14} />
                            Back to Home
                        </Link>
                    </div>

                    <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-1.5 text-brand-gold text-xs font-black uppercase tracking-widest mb-5">
                        <Headphones size={13} />24/7 Support
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
                        How can we <span className="text-brand-gold">help you?</span>
                    </h1>
                    <p className="text-text-muted text-sm mb-7">Browse FAQs, open a live chat ticket, or reach us via WhatsApp.</p>

                    {/* Search with inline dropdown */}
                    <div ref={searchRef} className="relative max-w-lg mx-auto">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
                            onFocus={() => { if (search) setSearchOpen(true); }}
                            placeholder="Search FAQs..."
                            className="w-full bg-bg-modal border border-white/[0.06] focus:border-brand-gold/50 rounded-2xl pl-11 pr-10 py-3.5 text-sm text-white placeholder:text-text-disabled outline-none transition-all shadow-lg"
                        />
                        {search && <button onClick={() => { setSearch(''); setSearchOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors z-10"><X size={16} /></button>}

                        {/* Floating search results dropdown */}
                        {searchOpen && search.trim() && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-bg-modal border border-white/[0.06] rounded-2xl shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
                                {searchResults.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-text-muted text-sm">
                                        <HelpCircle size={28} className="mb-2 opacity-30" />
                                        No results for &ldquo;<span className="text-white">{search}</span>&rdquo;
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                                            </span>
                                            <button onClick={() => setSearchOpen(false)} className="text-text-muted hover:text-white transition-colors"><X size={13} /></button>
                                        </div>
                                        {searchResults.map((faq, idx) => (
                                            <SearchResultItem
                                                key={faq._id}
                                                faq={faq}
                                                searchQuery={search}
                                                isLast={idx === searchResults.length - 1}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-center gap-6 mt-7 flex-wrap">
                        {[
                            { icon: Clock, label: 'Avg. Response', val: '< 2 min' },
                            { icon: CheckCircle, label: 'Issues Resolved', val: '98.5%' },
                            { icon: AlertCircle, label: 'Uptime', val: '99.9%' },
                        ].map(({ icon: Icon, label, val }) => (
                            <div key={label} className="flex items-center gap-2">
                                <Icon size={14} className="text-brand-gold" />
                                <div><p className="text-white font-black text-sm">{val}</p><p className="text-text-disabled text-[10px]">{label}</p></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">

                {/* Contact Cards */}
                <section>
                    <h2 className="text-sm font-black text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                        <MessageCircle size={16} className="text-brand-gold" />Contact Us
                    </h2>
                    <ContactCards contacts={contacts} onOpenTicket={() => setView('new-ticket')} />
                </section>

                {/* Ticket Panel */}
                <section>
                    <div className="bg-bg-deep border border-white/[0.04] rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.04] bg-gradient-to-r from-brand-gold/10 to-transparent">
                            <div className="p-2 rounded-xl bg-brand-gold/10 text-brand-gold">
                                {view === 'chat' ? <MessageCircle size={18} /> : view === 'new-ticket' ? <Plus size={18} /> : <Ticket size={18} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-black text-sm">
                                    {view === 'chat' ? 'Live Chat' : view === 'new-ticket' ? 'New Ticket' : 'Support Tickets'}
                                </p>
                                <p className="text-text-muted text-xs">
                                    {view === 'home' ? 'Your conversation history' : view === 'new-ticket' ? 'Tell us how we can help' : 'Real-time support'}
                                </p>
                            </div>
                            {view !== 'home' && (
                                <button onClick={() => setView('home')} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-white transition-colors">
                                    <ArrowLeft size={14} /> Back
                                </button>
                            )}
                            {view === 'home' && isAuthenticated && (
                                <button onClick={() => setView('new-ticket')} className="flex items-center gap-1.5 text-xs font-bold bg-brand-gold text-text-inverse px-3 py-1.5 rounded-lg">
                                    <Plus size={13} /> New Ticket
                                </button>
                            )}
                        </div>
                        <div className="p-6">
                            {!isAuthenticated ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold"><Lock size={28} /></div>
                                    <p className="text-white font-black text-lg">Login to access support</p>
                                    <p className="text-text-muted text-sm max-w-xs">Create an account or log in to open support tickets and chat with our team.</p>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('openLogin'))}
                                        className="mt-2 px-8 py-3 bg-brand-gold text-text-inverse font-black text-sm uppercase rounded-xl shadow-glow-gold">
                                        Log In
                                    </button>
                                </div>
                            ) : view === 'home' ? (
                                <MyTickets onOpen={handleOpenTicket} />
                            ) : view === 'new-ticket' ? (
                                <NewTicketForm onCreated={handleTicketCreated} />
                            ) : activeTicket ? (
                                <LiveChat ticket={activeTicket} userId={user?.id} onBack={() => setView('home')} />
                            ) : null}
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section>
                    <h2 className="text-sm font-black text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                        <HelpCircle size={16} className="text-brand-gold" />Frequently Asked Questions
                    </h2>

                    {/* Tab Bar */}
                    {faqCategories.length > 1 && (
                        <div className="flex gap-2 flex-wrap mb-6">
                            {faqTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFaqTab(tab.id)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${faqTab === tab.id ? 'bg-brand-gold text-text-inverse' : 'bg-white/[0.04] text-text-muted hover:text-white'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {faqLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-brand-gold" />
                        </div>
                    ) : groupedFaqs.length === 0 ? (
                        <div className="text-center py-16 text-text-muted"><HelpCircle size={40} className="mx-auto mb-3 opacity-30" /><p>No FAQs available yet.</p></div>
                    ) : (
                        <div className="space-y-8">
                            {groupedFaqs.map(group => {
                                const SectionIcon = group.meta.icon;
                                return (
                                    <div key={group.category}>
                                        <div className={`inline-flex items-center gap-2 ${group.meta.color} text-xs font-black uppercase tracking-widest mb-3`}>
                                            <div className={`p-1.5 rounded-lg ${group.meta.bg}`}><SectionIcon size={13} /></div>
                                            {group.meta.label}
                                        </div>
                                        <div className="space-y-2">
                                            {group.items.map(faq => <FaqItem key={faq._id} faq={faq} />)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
            <ChatwootWidget />
        </div>
    );
}
