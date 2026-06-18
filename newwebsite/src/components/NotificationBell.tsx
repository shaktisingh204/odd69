"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, CheckCheck, X, ArrowUpRight, BellRing } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import api from '@/services/api';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
    _id: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
}

interface ToastNotif {
    id: string;       // unique key for animation
    _id: string;      // MongoDB id
    title: string;
    body: string;
}

// ─── Toast component ──────────────────────────────────────────────────────────

function NotifToast({ toast, onDismiss }: { toast: ToastNotif; onDismiss: (id: string) => void }) {
    const [visible, setVisible] = useState(false);

    // Slide-in on mount
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(t);
    }, []);

    const dismiss = () => {
        setVisible(false);
        setTimeout(() => onDismiss(toast.id), 320);
    };

    return (
        <div
            style={{
                transform: visible ? 'translateX(0)' : 'translateX(110%)',
                opacity: visible ? 1 : 0,
                transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
            }}
            className="pointer-events-auto w-[320px] bg-accent-purple-soft border border-white/[0.06] rounded-2xl shadow-xl overflow-hidden"
        >
            {/* Glow bar */}
            <div className="h-[2px] w-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 animate-pulse" />

            <div className="flex items-start gap-3 px-4 py-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-warning-alpha-12 flex items-center justify-center">
                    <BellRing size={15} className="text-warning" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-white leading-tight truncate">{toast.title}</p>
                    <p className="text-[11px] text-white/55 mt-0.5 leading-relaxed line-clamp-2">{toast.body}</p>
                </div>

                {/* Close */}
                <button
                    onClick={dismiss}
                    className="flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                    <X size={11} />
                </button>
            </div>
        </div>
    );
}

// ─── Toast host (fixed portal) ────────────────────────────────────────────────

function ToastHost({ toasts, onDismiss }: { toasts: ToastNotif[]; onDismiss: (id: string) => void }) {
    if (toasts.length === 0) return null;
    return (
        <div className="fixed top-[72px] right-4 z-[500] flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <NotifToast key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

// ─── Main bell component ──────────────────────────────────────────────────────

export default function NotificationBell() {
    const { user, token, isAuthenticated } = useAuth();
    const { socket, isConnected } = useSocket();

    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const [toasts, setToasts] = useState<ToastNotif[]>([]);
    const [ringing, setRinging] = useState(false);

    const ref = useRef<HTMLDivElement>(null);

    // ── API helpers ────────────────────────────────────────────────────────

    const fetchCount = useCallback(async () => {
        if (!user || !token) return;
        try {
            const res = await api.get(`/notifications/unread-count/${user.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const count = res?.data?.count;
            setUnread(typeof count === 'number' ? count : 0);
        } catch { /* API not available yet — silently ignore */ }
    }, [user, token]);

    const fetchNotifications = useCallback(async () => {
        if (!user || !token) return;
        try {
            const res = await api.get(`/notifications/my/${user.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = Array.isArray(res?.data) ? res.data : [];
            setNotifications(data);
            setUnread(data.filter((n: Notification) => !n.isRead).length);
        } catch { /* silent */ }
    }, [user, token]);

    // ── Poll unread count every 60 s (safety net; socket is primary) ───────

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchCount();
        const interval = setInterval(fetchCount, 60_000);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchCount]);

    // ── Real-time socket: listen for newNotification ───────────────────────

    useEffect(() => {
        if (!socket || !isConnected || !isAuthenticated) return;

        const handleNew = (notif: { _id: string; title: string; body: string; createdAt: string }) => {
            // 1. Prepend to notification list
            const newEntry: Notification = {
                _id: notif._id,
                title: notif.title,
                body: notif.body,
                isRead: false,
                createdAt: notif.createdAt || new Date().toISOString(),
            };
            setNotifications(prev => [newEntry, ...prev].slice(0, 50));
            setUnread(prev => prev + 1);

            // 2. Show toast
            const toastId = `${notif._id}-${Date.now()}`;
            setToasts(prev => [...prev, { id: toastId, _id: notif._id, title: notif.title, body: notif.body }]);
            // Auto-dismiss after 5 s
            setTimeout(() => dismissToast(toastId), 5000);

            // 3. Ring the bell briefly
            setRinging(true);
            setTimeout(() => setRinging(false), 1000);
        };

        socket.on('newNotification', handleNew);
        return () => { socket.off('newNotification', handleNew); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, isConnected, isAuthenticated]);

    // ── Toast dismiss ──────────────────────────────────────────────────────

    const dismissToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // ── Open / close & fetch on open ──────────────────────────────────────

    const toggle = async () => {
        const willOpen = !open;
        setOpen(willOpen);
        if (willOpen) await fetchNotifications();
    };

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── CRUD ───────────────────────────────────────────────────────────────

    const markRead = async (id: string) => {
        if (!token || !id) return;
        try {
            await api.patch(`/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnread(prev => Math.max(0, prev - 1));
        } catch { /* silent */ }
    };

    const markAllRead = async () => {
        if (!user || !token) return;
        try {
            await api.patch(`/notifications/mark-all-read/${user.id}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnread(0);
        } catch { /* silent */ }
    };

    // ── Render guard ───────────────────────────────────────────────────────

    if (!isAuthenticated) return null;

    return (
        <>
            {/* ── Toast host ── */}
            <ToastHost toasts={toasts} onDismiss={dismissToast} />

            {/* ── Bell + Dropdown ── */}
            <div className="relative" ref={ref}>
                {/* Bell button */}
                <button
                    onClick={toggle}
                    aria-label="Notifications"
                    className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.05] transition-colors"
                >
                    <Bell
                        size={18}
                        style={{
                            animation: ringing ? 'bellRing 0.5s ease-in-out 2' : 'none',
                        }}
                    />
                    {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 shadow-[0_0_6px_rgba(239,68,68,0.6)]">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </button>

                {/* Dropdown panel */}
                {open && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-bg-modal border border-white/[0.07] rounded-2xl shadow-xl overflow-hidden z-[200]"
                        style={{ animation: 'dropIn 0.2s cubic-bezier(0.22,1,0.36,1)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                <Bell size={12} className="text-warning" /> Notifications
                                {unread > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-danger-alpha-16 text-danger text-[9px] font-bold rounded-full">
                                        {unread} new
                                    </span>
                                )}
                            </h3>
                            {unread > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white transition-colors"
                                >
                                    <CheckCheck size={11} /> Mark all read
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.03]">
                            {notifications.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Bell size={24} className="mx-auto mb-2 text-white/10" />
                                    <p className="text-white/20 text-xs">No notifications yet</p>
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <div
                                        key={n._id}
                                        className={`px-4 py-3 transition-colors cursor-pointer group ${n.isRead ? 'opacity-50' : 'bg-orange-500/[0.03] hover:bg-white/[0.02]'}`}
                                        onClick={() => { if (!n.isRead) markRead(n._id); }}
                                    >
                                        <div className="flex items-start gap-2">
                                            {/* Unread dot */}
                                            <span className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.6)]'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-bold text-white truncate">{n.title}</p>
                                                <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                                                <p className="text-[9px] text-white/20 mt-1">
                                                    {new Date(n.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2.5 border-t border-white/[0.05]">
                            <Link
                                href="/profile/transactions"
                                onClick={() => setOpen(false)}
                                className="flex items-center justify-center gap-1 text-[10px] text-white/30 hover:text-warning transition-colors"
                            >
                                View all transactions <ArrowUpRight size={10} />
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Keyframe styles */}
            <style>{`
                @keyframes bellRing {
                    0%   { transform: rotate(0deg); }
                    25%  { transform: rotate(-15deg); }
                    50%  { transform: rotate(15deg); }
                    75%  { transform: rotate(-10deg); }
                    100% { transform: rotate(0deg); }
                }
                @keyframes dropIn {
                    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </>
    );
}
