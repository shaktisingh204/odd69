"use client";

import React, { useEffect, useState } from 'react';
import {
  getChatbotProfiles,
  getAutoReplyRules,
  getKBArticles,
  getIntents,
  getChatwootConfig,
} from '@/actions/chatbot';
import {
  Bot, Brain, FileText, Zap, MessageCircle, Layers,
  Send, Layout, Shield, Users, BarChart3, TestTube,
  GitBranch, AlertTriangle, MessageSquare, ArrowRight,
  RefreshCw, Wifi, WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface DashboardData {
  totalProfiles: number;
  activeRules: number;
  knowledgeArticles: number;
  intentsConfigured: number;
  chatwootConnected: boolean;
  chatwootUrl: string;
}

const QUICK_LINKS = [
  { label: 'Bot Profiles', href: '/dashboard/chatbot/profiles', icon: Bot, color: 'from-blue-500 to-cyan-500' },
  { label: 'Knowledge Base', href: '/dashboard/chatbot/knowledge-base', icon: FileText, color: 'from-emerald-500 to-teal-500' },
  { label: 'Intents', href: '/dashboard/chatbot/intents', icon: Brain, color: 'from-purple-500 to-violet-500' },
  { label: 'Entities', href: '/dashboard/chatbot/entities', icon: Layers, color: 'from-orange-500 to-amber-500' },
  { label: 'Responses', href: '/dashboard/chatbot/responses', icon: MessageCircle, color: 'from-pink-500 to-rose-500' },
  { label: 'Auto-Reply Rules', href: '/dashboard/chatbot/auto-reply', icon: Zap, color: 'from-yellow-500 to-orange-500' },
  { label: 'Quick Replies', href: '/dashboard/chatbot/quick-replies', icon: Send, color: 'from-indigo-500 to-blue-500' },
  { label: 'Flows', href: '/dashboard/chatbot/flows', icon: GitBranch, color: 'from-teal-500 to-green-500' },
  { label: 'Segments', href: '/dashboard/chatbot/segments', icon: Users, color: 'from-red-500 to-pink-500' },
  { label: 'Conversations', href: '/dashboard/chatbot/conversations', icon: MessageSquare, color: 'from-sky-500 to-indigo-500' },
  { label: 'Escalation', href: '/dashboard/chatbot/escalation', icon: AlertTriangle, color: 'from-amber-500 to-red-500' },
  { label: 'Greetings', href: '/dashboard/chatbot/greetings', icon: Layout, color: 'from-lime-500 to-emerald-500' },
  { label: 'Workflows', href: '/dashboard/chatbot/workflows', icon: Shield, color: 'from-fuchsia-500 to-purple-500' },
  { label: 'Analytics', href: '/dashboard/chatbot/analytics', icon: BarChart3, color: 'from-cyan-500 to-blue-500' },
  { label: 'Testing', href: '/dashboard/chatbot/testing', icon: TestTube, color: 'from-violet-500 to-fuchsia-500' },
  { label: 'A/B Tests', href: '/dashboard/chatbot/ab-tests', icon: GitBranch, color: 'from-rose-500 to-orange-500' },
];

export default function ChatbotDashboardPage() {
  const [data, setData] = useState<DashboardData>({
    totalProfiles: 0,
    activeRules: 0,
    knowledgeArticles: 0,
    intentsConfigured: 0,
    chatwootConnected: false,
    chatwootUrl: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [profilesRes, rulesRes, articlesRes, intentsRes, chatwootRes] = await Promise.all([
        getChatbotProfiles(),
        getAutoReplyRules(),
        getKBArticles(),
        getIntents(),
        getChatwootConfig(),
      ]);

      const profiles = profilesRes?.success ? profilesRes.data : [];
      const rules = rulesRes?.success ? rulesRes.data : [];
      const articles = articlesRes?.success ? articlesRes.data : [];
      const intents = intentsRes?.success ? intentsRes.data : [];
      const chatwoot = chatwootRes?.success ? chatwootRes.data : null;

      setData({
        totalProfiles: Array.isArray(profiles) ? profiles.length : 0,
        activeRules: Array.isArray(rules) ? rules.filter((r: any) => r.isActive || r.isEnabled).length : 0,
        knowledgeArticles: Array.isArray(articles) ? articles.length : 0,
        intentsConfigured: Array.isArray(intents) ? intents.length : 0,
        chatwootConnected: !!chatwoot?.isEnabled,
        chatwootUrl: chatwoot?.instanceUrl || '',
      });
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Profiles', value: data.totalProfiles, icon: Bot, gradient: 'from-blue-500 to-cyan-500' },
    { label: 'Active Rules', value: data.activeRules, icon: Zap, gradient: 'from-yellow-500 to-orange-500' },
    { label: 'Knowledge Articles', value: data.knowledgeArticles, icon: FileText, gradient: 'from-emerald-500 to-teal-500' },
    { label: 'Intents Configured', value: data.intentsConfigured, icon: Brain, gradient: 'from-purple-500 to-pink-500' },
  ];

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Chatbot Dashboard</h1>
          <p className="text-sm text-white/50 mt-1">Manage your AI chatbot system</p>
        </div>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition text-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="relative rounded-xl overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-r ${card.gradient} opacity-10`} />
            <div className="relative border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <card.icon size={20} className="text-white/60" />
                <div className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${card.gradient}`} />
              </div>
              <p className="text-2xl font-bold">{loading ? '...' : card.value}</p>
              <p className="text-xs text-white/40 mt-1 uppercase tracking-wide">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chatwoot Status */}
      <div className="border border-white/10 rounded-xl p-5 bg-white/5 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.chatwootConnected ? (
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Wifi size={20} className="text-emerald-400" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-red-500/20">
                <WifiOff size={20} className="text-red-400" />
              </div>
            )}
            <div>
              <h3 className="font-semibold">Chatwoot Status</h3>
              <p className="text-sm text-white/50">
                {loading
                  ? 'Checking...'
                  : data.chatwootConnected
                    ? `Connected to ${data.chatwootUrl}`
                    : 'Not connected'}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              data.chatwootConnected
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-red-500/15 text-red-400'
            }`}
          >
            {data.chatwootConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Quick Links Grid */}
      <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group relative rounded-xl overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-r ${link.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
            <div className="relative border border-white/10 group-hover:border-white/20 rounded-xl p-4 flex items-center gap-3 transition">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${link.color} bg-opacity-20`}>
                <link.icon size={18} className="text-white" />
              </div>
              <span className="text-sm font-medium flex-1">{link.label}</span>
              <ArrowRight size={14} className="text-white/30 group-hover:text-white/60 transition" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
