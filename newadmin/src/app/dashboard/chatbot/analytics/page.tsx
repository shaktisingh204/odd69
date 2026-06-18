"use client";

import React, { useEffect, useState } from 'react';
import {
  getChatbotDashboard,
  getConversationAnalytics,
  getIntentAnalytics,
} from '@/actions/chatbot';
import {
  BarChart3, RefreshCw, MessageSquare, Users, AlertTriangle, Star,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardData {
  totalConversations?: number;
  activeNow?: number;
  escalationRate?: number;
  avgSatisfaction?: number;
  conversationVolume?: any[];
  intentDistribution?: any[];
}

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<DashboardData>({});
  const [conversationData, setConversationData] = useState<any>(null);
  const [intentData, setIntentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const params: { from?: string; to?: string } = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;

      const [dashRes, convRes, intentRes] = await Promise.all([
        getChatbotDashboard(params),
        getConversationAnalytics(params),
        getIntentAnalytics(params),
      ]);

      if (dashRes.success) setDashboard(dashRes.data || {});
      else toast.error(dashRes.error || 'Failed to load dashboard');

      if (convRes.success) setConversationData(convRes.data);
      if (intentRes.success) setIntentData(intentRes.data);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  const stats = [
    { label: 'Total Conversations', value: dashboard.totalConversations ?? 0, icon: MessageSquare, color: 'text-blue-400' },
    { label: 'Active Now', value: dashboard.activeNow ?? 0, icon: Users, color: 'text-emerald-400' },
    { label: 'Escalation Rate', value: `${((dashboard.escalationRate ?? 0) * 100).toFixed(1)}%`, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Avg Satisfaction', value: (dashboard.avgSatisfaction ?? 0).toFixed(1), icon: Star, color: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 size={24} /> Analytics Dashboard</h1>
          <p className="text-sm text-white/50 mt-1">Chatbot performance metrics and insights</p>
        </div>
        <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
        <Calendar size={16} className="text-white/40" />
        <span className="text-sm text-white/50">Date Range:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
        />
        <span className="text-white/30">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
        />
        <button onClick={load} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
          Apply
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white/5 ${s.color}`}>
                <s.icon size={20} />
              </div>
              <div>
                <p className="text-xs text-white/50">{s.label}</p>
                <p className="text-xl font-bold">{loading ? '...' : s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="p-6 bg-white/5 border border-white/10 rounded-xl min-h-[300px] flex flex-col">
          <h3 className="text-sm font-bold mb-4 text-white/80">Conversation Volume Chart</h3>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-white/20">Loading...</div>
          ) : conversationData?.volume && conversationData.volume.length > 0 ? (
            <div className="flex-1 flex items-end gap-1 px-2 pb-2">
              {conversationData.volume.slice(0, 30).map((item: any, idx: number) => {
                const maxVal = Math.max(...conversationData.volume.map((v: any) => v.count || 0), 1);
                const height = ((item.count || 0) / maxVal) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div className="absolute -top-6 hidden group-hover:block bg-black/80 text-xs px-2 py-1 rounded whitespace-nowrap">
                      {item.date}: {item.count}
                    </div>
                    <div
                      className="w-full bg-blue-500/60 rounded-t hover:bg-blue-500/80 transition"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
              No conversation volume data available. Data will appear once conversations are tracked.
            </div>
          )}
        </div>

        <div className="p-6 bg-white/5 border border-white/10 rounded-xl min-h-[300px] flex flex-col">
          <h3 className="text-sm font-bold mb-4 text-white/80">Intent Distribution</h3>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-white/20">Loading...</div>
          ) : intentData?.distribution && intentData.distribution.length > 0 ? (
            <div className="flex-1 space-y-2 overflow-y-auto">
              {intentData.distribution.map((item: any, idx: number) => {
                const maxVal = Math.max(...intentData.distribution.map((d: any) => d.count || 0), 1);
                const pct = ((item.count || 0) / maxVal) * 100;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">{item.intent || item.name}</span>
                      <span className="text-white/40">{item.count}</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500/70 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
              No intent distribution data available. Data will appear once intents are matched.
            </div>
          )}
        </div>
      </div>

      {/* Summary Table */}
      {(conversationData || intentData) && (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="bg-white/5 border-b border-white/10 p-3">
            <h3 className="text-sm font-bold text-white/80">Raw Data Summary</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {conversationData && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Conversation Metrics</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Total</span>
                    <span>{conversationData.total ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Resolved</span>
                    <span>{conversationData.resolved ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Escalated</span>
                    <span>{conversationData.escalated ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/60">Avg Duration</span>
                    <span>{conversationData.avgDuration ?? '-'}</span>
                  </div>
                </div>
              </div>
            )}
            {intentData && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Intent Metrics</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Total Matched</span>
                    <span>{intentData.totalMatched ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Unmatched</span>
                    <span>{intentData.unmatched ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/60">Top Intent</span>
                    <span>{intentData.topIntent ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/60">Avg Confidence</span>
                    <span>{intentData.avgConfidence != null ? `${(intentData.avgConfidence * 100).toFixed(1)}%` : '-'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
