"use client";

import React, { useEffect, useState } from 'react';
import {
  getChatwootConfig,
  updateChatwootConfig,
  testChatwootConnection,
  syncChatwootUsers,
  getChatwootSyncStatus,
} from '@/actions/chatbot';
import {
  Settings, Save, Plug, RefreshCw, Users, Copy, CheckCircle2,
  XCircle, ExternalLink, Shield, Bot, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ChatwootConfigData {
  id?: number;
  instanceUrl: string;
  apiToken: string;
  accountId: number;
  agentBotToken: string;
  webhookSecret: string;
  autoSyncUsers: boolean;
  defaultInboxId: number | null;
  isEnabled: boolean;
}

interface SyncStatus {
  totalUsers?: number;
  syncableUsers?: number;
  syncedUsers?: number;
  lastSyncAt?: string;
  inProgress?: boolean;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9828/api';

export default function ChatwootSettingsPage() {
  const [form, setForm] = useState<ChatwootConfigData>({
    instanceUrl: '',
    apiToken: '',
    accountId: 0,
    agentBotToken: '',
    webhookSecret: '',
    autoSyncUsers: false,
    defaultInboxId: null,
    isEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [configRes, statusRes] = await Promise.all([
        getChatwootConfig(),
        getChatwootSyncStatus(),
      ]);

      if (configRes.success && configRes.data) {
        setForm({
          id: configRes.data.id,
          instanceUrl: configRes.data.instanceUrl || '',
          apiToken: configRes.data.apiToken || '',
          accountId: configRes.data.accountId || 0,
          agentBotToken: configRes.data.agentBotToken || '',
          webhookSecret: configRes.data.webhookSecret || '',
          autoSyncUsers: configRes.data.autoSyncUsers ?? false,
          defaultInboxId: configRes.data.defaultInboxId ?? null,
          isEnabled: configRes.data.isEnabled ?? true,
        });
      }

      if (statusRes.success && statusRes.data) {
        setSyncStatus(statusRes.data);
      }
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateChatwootConfig({
        instanceUrl: form.instanceUrl,
        apiToken: form.apiToken,
        accountId: form.accountId,
        agentBotToken: form.agentBotToken || undefined,
        webhookSecret: form.webhookSecret || undefined,
        autoSyncUsers: form.autoSyncUsers,
        defaultInboxId: form.defaultInboxId ?? undefined,
        isEnabled: form.isEnabled,
      });
      if (res.success) toast.success('Settings saved');
      else toast.error(res.error || 'Failed to save settings');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testChatwootConnection();
      if (res.success) {
        setTestResult({ success: true, message: 'Connection successful' });
        toast.success('Connection successful');
      } else {
        setTestResult({ success: false, message: res.error || 'Connection failed' });
        toast.error(res.error || 'Connection failed');
      }
    } catch {
      setTestResult({ success: false, message: 'Connection failed' });
      toast.error('Connection failed');
    } finally { setTesting(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncChatwootUsers();
      if (res.success) {
        toast.success('User sync initiated');
        // Refresh sync status after a brief moment
        setTimeout(async () => {
          const statusRes = await getChatwootSyncStatus();
          if (statusRes.success && statusRes.data) setSyncStatus(statusRes.data);
          setSyncing(false);
        }, 2000);
      } else {
        toast.error(res.error || 'Failed to sync');
        setSyncing(false);
      }
    } catch {
      toast.error('Failed to sync users');
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const webhookUrl = `${BACKEND_URL}/chatbot/chatwoot/webhook`;
  const agentBotUrl = `${BACKEND_URL}/chatbot/chatwoot/agent-bot`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0f14] text-white p-6 flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings size={24} /> Chatwoot Settings</h1>
          <p className="text-sm text-white/50 mt-1">Configure Chatwoot integration and agent bot</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition">
          <Save size={16} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Chatwoot Connection */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><Plug size={18} className="text-blue-400" /> Chatwoot Connection</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Instance URL</label>
              <input
                value={form.instanceUrl}
                onChange={e => setForm({ ...form, instanceUrl: e.target.value })}
                placeholder="https://chat.example.com"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">API Token</label>
              <input
                type="password"
                value={form.apiToken}
                onChange={e => setForm({ ...form, apiToken: e.target.value })}
                placeholder="Enter Chatwoot API token"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Account ID</label>
              <input
                type="number"
                value={form.accountId || ''}
                onChange={e => setForm({ ...form, accountId: parseInt(e.target.value) || 0 })}
                placeholder="1"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        </div>

        {/* Agent Bot */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><Bot size={18} className="text-purple-400" /> Agent Bot</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Agent Bot Token</label>
              <input
                type="password"
                value={form.agentBotToken}
                onChange={e => setForm({ ...form, agentBotToken: e.target.value })}
                placeholder="Enter agent bot access token"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Webhook Secret</label>
              <input
                type="password"
                value={form.webhookSecret}
                onChange={e => setForm({ ...form, webhookSecret: e.target.value })}
                placeholder="Enter webhook secret for signature validation"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        </div>

        {/* Automation */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><Zap size={18} className="text-amber-400" /> Automation</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto Sync Users</p>
                <p className="text-xs text-white/40">Automatically sync new users to Chatwoot contacts</p>
              </div>
              <button
                onClick={() => setForm({ ...form, autoSyncUsers: !form.autoSyncUsers })}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.autoSyncUsers ? 'bg-blue-600' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.autoSyncUsers ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Default Inbox ID</label>
              <input
                type="number"
                value={form.defaultInboxId ?? ''}
                onChange={e => setForm({ ...form, defaultInboxId: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Inbox ID for bot conversations"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-white/40">Enable or disable Chatwoot integration</p>
              </div>
              <button
                onClick={() => setForm({ ...form, isEnabled: !form.isEnabled })}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.isEnabled ? 'bg-blue-600' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.isEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Test Connection */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><Shield size={18} className="text-emerald-400" /> Test Connection</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
            >
              <Plug size={16} /> {testing ? 'Testing...' : 'Test Connection'}
            </button>
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Webhook URLs */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><ExternalLink size={18} className="text-cyan-400" /> Webhook URLs</h2>
          <p className="text-xs text-white/40 mb-4">Configure these URLs in your Chatwoot instance</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Webhook URL</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono text-white/70 overflow-x-auto">
                  {webhookUrl}
                </div>
                <button onClick={() => copyToClipboard(webhookUrl)} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Agent Bot URL</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono text-white/70 overflow-x-auto">
                  {agentBotUrl}
                </div>
                <button onClick={() => copyToClipboard(agentBotUrl)} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* User Sync */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2"><Users size={18} className="text-indigo-400" /> User Sync</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-center">
              <p className="text-xs text-white/40">Total Users</p>
              <p className="text-lg font-bold">{syncStatus.totalUsers ?? '-'}</p>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-center">
              <p className="text-xs text-white/40">Syncable</p>
              <p className="text-lg font-bold">{syncStatus.syncableUsers ?? '-'}</p>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-center">
              <p className="text-xs text-white/40">Synced</p>
              <p className="text-lg font-bold">{syncStatus.syncedUsers ?? '-'}</p>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-center">
              <p className="text-xs text-white/40">Last Sync</p>
              <p className="text-sm font-medium">{syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}</p>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
