"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard, Users, CreditCard, Clock, Wallet, DollarSign,
    Settings, CheckCircle, Shield, TrendingUp, Gamepad2, List,
    Layers, Trophy, Gift, Star, Tag, Bell, Phone, BookOpen,
    PieChart, HeadphonesIcon, Globe, UserCog, Mail, Send,
    MessageSquare, LogOut, Menu, X, ChevronRight, Calendar,
    Bomb, Swords, Banknote, AlertTriangle, Zap, Radio, FileText, SlidersHorizontal,
    BarChart2, ShieldCheck, Receipt, Bitcoin, Eraser, Crown, Sparkles,
    Bot, Brain, GitBranch, FlaskConical, Split, Workflow, Reply,
    MessagesSquare, Image as ImageIcon,
} from "lucide-react";

interface NavItem {
    name: string;
    href: string;
    icon: React.ElementType;
    badge?: string | number;
}

interface NavGroup {
    title: string;
    icon: React.ElementType;
    items: NavItem[];
}

interface StoredAdminUser {
    username?: string;
    email?: string;
    role?: string;
}

const NAV: NavGroup[] = [
    // ─── Core ────────────────────────────────────────────────────────────
    {
        title: "Overview",
        icon: LayoutDashboard,
        items: [
            { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        ],
    },
    {
        title: "Users",
        icon: Users,
        items: [
            { name: "All Users", href: "/dashboard/users", icon: Users },
            { name: "CRM & Segments", href: "/dashboard/crm", icon: UserCog },
        ],
    },

    // ─── Money ───────────────────────────────────────────────────────────
    {
        title: "Finance",
        icon: DollarSign,
        items: [
            { name: "All Transactions", href: "/dashboard/finance/transactions", icon: CreditCard },
            { name: "Pending Withdrawals", href: "/dashboard/finance/withdrawals", icon: Clock },
            { name: "Pending Deposits", href: "/dashboard/finance/deposits", icon: Clock },
            { name: "Crypto Deposits", href: "/dashboard/finance/deposits?currency=CRYPTO", icon: Bitcoin },
            { name: "Manual Adjustments", href: "/dashboard/finance/adjustments", icon: Wallet },
            { name: "Clear Wagering", href: "/dashboard/finance/wagering", icon: Eraser },
            { name: "Expenses Management", href: "/dashboard/expenses", icon: Receipt },
            { name: "Payment Gateways", href: "/dashboard/finance/gateways", icon: DollarSign },
            { name: "Gateway Settings", href: "/dashboard/finance/deposit-settings", icon: SlidersHorizontal },
            { name: "Reconciliation", href: "/dashboard/finance/reconciliation", icon: CheckCircle },
            { name: "URL Settlement", href: "/dashboard/finance/url-settlement", icon: BarChart2 },
            { name: "Manual Settlement", href: "/dashboard/finance/manual-settlement", icon: Users },
        ],
    },

    // ─── Games ───────────────────────────────────────────────────────────
    {
        title: "Sportsbook",
        icon: Trophy,
        items: [
            { name: "Sports & Competitions", href: "/dashboard/sports", icon: Swords },
            { name: "Sports Page Layout", href: "/dashboard/sports/live-builder", icon: LayoutDashboard },
            { name: "Events", href: "/dashboard/sports/events", icon: List },
            { name: "Leagues & Images", href: "/dashboard/sports/leagues", icon: Layers },
            { name: "Bet Limits", href: "/dashboard/sports/limits", icon: TrendingUp },
            { name: "Risk Management", href: "/dashboard/sports/risk", icon: AlertTriangle },
            { name: "SR Sportradar", href: "/dashboard/sports/api-setup", icon: Radio },
            { name: "Settlement", href: "/dashboard/settlement", icon: CheckCircle },
            { name: "Super Void", href: "/dashboard/sports/super-void", icon: AlertTriangle },
            { name: "Promo Teams", href: "/dashboard/sports/promo-teams", icon: ShieldCheck },
            { name: "Team Icons", href: "/dashboard/sports/team-icons", icon: Star },
        ],
    },
    {
        title: "Casino",
        icon: Gamepad2,
        items: [
            { name: "Zeero Originals Lobby", href: "/dashboard/originals", icon: Bomb },
            { name: "Games", href: "/dashboard/casino/games", icon: Gamepad2 },
            { name: "Providers", href: "/dashboard/casino/providers", icon: Layers },
            { name: "Categories", href: "/dashboard/casino/categories", icon: List },
        ],
    },
    {
        title: "Bets",
        icon: Banknote,
        items: [
            { name: "Casino Bets", href: "/dashboard/bets/casino", icon: Gamepad2 },
            { name: "Verify Casino Txn", href: "/dashboard/bets/casino/verify", icon: ShieldCheck },
            { name: "Sports Bets", href: "/dashboard/bets/sports", icon: Trophy },
        ],
    },
    {
        title: "Fantasy",
        icon: Trophy,
        items: [
            { name: "Overview", href: "/dashboard/fantasy", icon: LayoutDashboard },
            { name: "Matches", href: "/dashboard/fantasy/matches", icon: Calendar },
            { name: "Contests", href: "/dashboard/fantasy/contests", icon: Trophy },
            { name: "Contest Templates", href: "/dashboard/fantasy/templates", icon: Layers },
            { name: "Private Contests", href: "/dashboard/fantasy/private-contests", icon: Shield },
            { name: "User Teams", href: "/dashboard/fantasy/teams", icon: Users },
            { name: "Entries", href: "/dashboard/fantasy/entries", icon: Receipt },
            { name: "Points System", href: "/dashboard/fantasy/points-system", icon: SlidersHorizontal },
            { name: "Player Credits", href: "/dashboard/fantasy/player-credits", icon: BarChart2 },
            { name: "IPL Assets", href: "/dashboard/fantasy/ipl-assets", icon: ImageIcon },
            { name: "Promocodes", href: "/dashboard/fantasy/promocodes", icon: Tag },
            { name: "Bonus Rules", href: "/dashboard/fantasy/bonus-rules", icon: Gift },
            { name: "Streak Rewards", href: "/dashboard/fantasy/streaks", icon: Sparkles },
            { name: "Season Leaderboard", href: "/dashboard/fantasy/season", icon: Crown },
            { name: "Referrals", href: "/dashboard/fantasy/referrals", icon: Users },
            { name: "Notifications", href: "/dashboard/fantasy/notifications", icon: Bell },
            { name: "Activity Log", href: "/dashboard/fantasy/activity", icon: FileText },
            { name: "Global Config", href: "/dashboard/fantasy/config", icon: Settings },
            { name: "Players", href: "/dashboard/fantasy/players", icon: Star },
        ],
    },

    // ─── Engagement & Marketing ──────────────────────────────────────────
    {
        title: "Rewards & Bonuses",
        icon: Sparkles,
        items: [
            { name: "Daily Rewards", href: "/dashboard/marketing/daily-rewards", icon: Sparkles },
            { name: "Bonuses", href: "/dashboard/marketing/bonuses", icon: Gift },
            { name: "Bonus Conversions", href: "/dashboard/marketing/bonus-conversions", icon: CheckCircle },
            { name: "Refer & Earn", href: "/dashboard/affiliates", icon: Users },
            { name: "Referral Rewards", href: "/dashboard/affiliates/rewards", icon: Star },
            { name: "Agents", href: "/dashboard/agents", icon: Users },
        ],
    },
    {
        title: "VIP Management",
        icon: Crown,
        items: [
            { name: "VIP Applications", href: "/dashboard/cms/vip-applications", icon: Star },
            { name: "VIP Members", href: "/dashboard/cms/vip-members", icon: Crown },
            { name: "VIP Settings", href: "/dashboard/cms/vip-settings", icon: Settings },
        ],
    },

    // ─── Content & Communication ─────────────────────────────────────────
    {
        title: "CMS",
        icon: FileText,
        items: [
            { name: "Page Sliders", href: "/dashboard/cms/sliders", icon: Layers },
            { name: "Promo Cards", href: "/dashboard/cms/promo-cards", icon: LayoutDashboard },
            { name: "Promotions", href: "/dashboard/cms/promotions", icon: Tag },
            { name: "Announcements", href: "/dashboard/cms/announcements", icon: Radio },
            { name: "Push Notifications", href: "/dashboard/cms/push-notifications", icon: Bell },
            { name: "Home Categories", href: "/dashboard/cms/categories", icon: List },
            { name: "FAQ Management", href: "/dashboard/cms/faq", icon: BookOpen },
        ],
    },
    {
        title: "Messaging",
        icon: Mail,
        items: [
            { name: "Email Campaigns", href: "/dashboard/messaging/email/campaigns", icon: Mail },
            { name: "Email Templates", href: "/dashboard/messaging/email/templates", icon: BookOpen },
            { name: "WhatsApp Account", href: "/dashboard/messaging/whatsapp/templates", icon: MessageSquare },
            { name: "Bulk Campaigns", href: "/dashboard/messaging/whatsapp/campaigns", icon: Send },
            { name: "Auto Messages", href: "/dashboard/messaging/whatsapp/auto-messages", icon: Zap },
            { name: "Sync Templates", href: "/dashboard/messaging/whatsapp/sync-templates", icon: Globe },
            { name: "Analytics", href: "/dashboard/messaging/analytics", icon: PieChart },
        ],
    },

    // ─── Chatbot Automation ─────────────────────────────────────────────
    {
        title: "Chatbot",
        icon: Bot,
        items: [
            { name: "Bot Dashboard", href: "/dashboard/chatbot", icon: LayoutDashboard },
            { name: "Bot Profiles", href: "/dashboard/chatbot/profiles", icon: UserCog },
            { name: "Knowledge Base", href: "/dashboard/chatbot/knowledge-base", icon: BookOpen },
            { name: "Intents", href: "/dashboard/chatbot/intents", icon: Brain },
            { name: "Entities", href: "/dashboard/chatbot/entities", icon: List },
            { name: "Response Templates", href: "/dashboard/chatbot/responses", icon: MessageSquare },
            { name: "Auto-Reply Rules", href: "/dashboard/chatbot/auto-reply", icon: Zap },
            { name: "Quick Replies", href: "/dashboard/chatbot/quick-replies", icon: Reply },
            { name: "Conversation Flows", href: "/dashboard/chatbot/flows", icon: GitBranch },
            { name: "User Segments", href: "/dashboard/chatbot/segments", icon: Users },
            { name: "Conversations", href: "/dashboard/chatbot/conversations", icon: MessagesSquare },
            { name: "Escalation", href: "/dashboard/chatbot/escalation", icon: AlertTriangle },
            { name: "Greetings", href: "/dashboard/chatbot/greetings", icon: Bell },
            { name: "Workflows", href: "/dashboard/chatbot/workflows", icon: Workflow },
            { name: "Analytics", href: "/dashboard/chatbot/analytics", icon: PieChart },
            { name: "Testing", href: "/dashboard/chatbot/testing", icon: FlaskConical },
            { name: "A/B Tests", href: "/dashboard/chatbot/ab-tests", icon: Split },
        ],
    },

    // ─── Analytics & Support ─────────────────────────────────────────────
    {
        title: "Reports & Support",
        icon: PieChart,
        items: [
            { name: "Reports", href: "/dashboard/reports", icon: PieChart },
            { name: "Support Tickets", href: "/dashboard/support", icon: HeadphonesIcon },
        ],
    },

    // ─── System ──────────────────────────────────────────────────────────
    {
        title: "System",
        icon: Shield,
        items: [
            { name: "Admin Security", href: "/dashboard/security/admins", icon: Shield },
            { name: "Login Logs", href: "/dashboard/security/login-logs", icon: Clock },
            { name: "My Profile", href: "/dashboard/security/profile", icon: UserCog },
            { name: "Site Config", href: "/dashboard/settings/config", icon: Settings },
            { name: "Contact Settings", href: "/dashboard/settings/contact", icon: Phone },
            { name: "Audit Logs", href: "/dashboard/settings/audit", icon: BookOpen },
        ],
    },
];

function isActive(pathname: string, href: string) {
    if (href === "/dashboard") return pathname === href;
    const pathNoQuery = href.split("?")[0];
    return pathname === href || pathname.startsWith(pathNoQuery + "/");
}

function getInitialExpanded(pathname: string) {
    const activeGroups = NAV
        .filter(group => group.items.some(item => isActive(pathname, item.href)))
        .map(group => group.title);
    return activeGroups.length ? activeGroups : ["Finance", "Rewards & Bonuses", "Bets"];
}

function getStoredAdminUser(): StoredAdminUser | null {
    const stored = localStorage.getItem("user");
    if (!stored) return null;
    try {
        return JSON.parse(stored) as StoredAdminUser;
    } catch {
        return null;
    }
}

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<StoredAdminUser | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [expanded, setExpanded] = useState<string[]>(() => getInitialExpanded(pathname));
    const expandedGroups = Array.from(new Set([...expanded, ...getInitialExpanded(pathname)]));

    // Hydrate user from localStorage
    useEffect(() => {
        setUser(getStoredAdminUser());
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = isOpen ? "hidden" : prev;
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    const toggleGroup = (title: string) =>
        setExpanded(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setIsOpen(false);
        router.push("/");
    };

    const close = () => setIsOpen(false);

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="lg:hidden fixed left-3 top-3 z-50 rounded-lg border border-white/10 bg-[#0d0f14] p-2 text-white/70 hover:text-white transition-colors"
                onClick={() => setIsOpen(o => !o)}
                aria-label="Toggle sidebar"
            >
                {isOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
                    onClick={close}
                />
            )}

            {/* Sidebar shell */}
            <aside
                className={`
                    fixed top-0 left-0 z-40 flex h-dvh w-[280px] flex-col
                    bg-[#0b0d11] border-r border-white/[0.05]
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                `}
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
                {/* Logo */}
                <div className="flex flex-shrink-0 items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-violet-900/30 flex-shrink-0">
                        Z
                    </div>
                    <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-white leading-none tracking-tight">Zeero Admin</p>
                        {user && (
                            <p className="text-[11px] text-white/30 mt-1 capitalize tracking-wide">
                                {user.role?.replace(/_/g, " ").toLowerCase()}
                            </p>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-none">
                    {NAV.map((group) => {
                        const hasActive = group.items.some(i => isActive(pathname, i.href));
                        const open = expandedGroups.includes(group.title);

                        // Single-item groups: flat link, no accordion
                        if (group.items.length === 1) {
                            const item = group.items[0];
                            const Icon = item.icon;
                            const active = isActive(pathname, item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={close}
                                    className={`
                                        group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-semibold transition-all duration-150
                                        ${active
                                            ? "bg-violet-600/[0.18] text-white"
                                            : "text-white hover:bg-white/[0.06]"
                                        }
                                    `}
                                >
                                    <Icon
                                        size={18}
                                        className={active ? "text-violet-400 flex-shrink-0" : "text-white flex-shrink-0"}
                                    />
                                    <span className="truncate">{item.name}</span>
                                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />}
                                </Link>
                            );
                        }

                        return (
                            <div key={group.title}>
                                {/* Section toggle */}
                                <button
                                    onClick={() => toggleGroup(group.title)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150
                                        ${hasActive ? "text-violet-400" : "text-white/50 hover:text-white"}
                                    `}
                                >
                                    <group.icon size={15} className="flex-shrink-0" />
                                    <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-widest truncate">
                                        {group.title}
                                    </span>
                                    <ChevronRight
                                        size={13}
                                        className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                                    />
                                </button>

                                {/* Items */}
                                {open && (
                                    <div className="mt-1 mb-1.5 ml-2 pl-3.5 border-l border-white/[0.08] space-y-0.5">
                                        {group.items.map(item => {
                                            const Icon = item.icon;
                                            const active = isActive(pathname, item.href);
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={close}
                                                    className={`
                                                        group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-150
                                                        ${active
                                                            ? "bg-violet-600/[0.18] text-white"
                                                            : "text-white hover:bg-white/[0.06]"
                                                        }
                                                    `}
                                                >
                                                    <Icon
                                                        size={16}
                                                        className={active ? "text-violet-400 flex-shrink-0" : "text-white flex-shrink-0"}
                                                    />
                                                    <span className="truncate flex-1">{item.name}</span>
                                                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />}
                                                    {item.badge !== undefined && (
                                                        <span className="ml-auto text-[10px] font-bold bg-amber-500 text-black px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* User footer */}
                <div className="flex-shrink-0 border-t border-white/[0.05] p-3">
                    {user && (
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-white/[0.02] mb-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
                                {(user.username || user.email || "A")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13px] text-white/80 font-medium truncate">{user.username || user.email}</p>
                                <p className="text-[11px] text-white/30 capitalize">
                                    {user.role?.replace(/_/g, " ").toLowerCase()}
                                </p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
                    >
                        <LogOut size={14} />
                        Sign out
                    </button>
                </div>
            </aside>
        </>
    );
}
