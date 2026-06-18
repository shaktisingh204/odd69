"use client";

import React, { useEffect, useState } from 'react';
import {
  getAutoReplyRules,
  createAutoReplyRule,
  updateAutoReplyRule,
  deleteAutoReplyRule,
  reorderAutoReplyRules,
  toggleAutoReplyRule,
} from '@/actions/chatbot';
import {
  Zap, Plus, Pencil, Trash2, Power, X, Search, RefreshCw,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AutoReplyRule {
  id: number;
  name: string;
  description?: string | null;
  conditionType: string;
  conditionValue: any;
  responseTemplateId?: number | null;
  responseText?: string | null;
  responseRich?: any;
  priority: number;
  channels: string[];
  isFallback: boolean;
  isEnabled: boolean;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONDITION_TYPES = ['keyword', 'regex', 'intent'] as const;

export default function AutoReplyPage() {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    conditionType: 'keyword' as string,
    conditionValue: '{}',
    responseText: '',
    priority: 0,
    channels: 'web',
    isFallback: false,
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const result = await getAutoReplyRules();
      const data = result?.success ? result.data : [];
      setRules(((data || []) as any[]).sort((a: AutoReplyRule, b: AutoReplyRule) => a.priority - b.priority));
    } catch { toast.error('Failed to load rules'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({
      name: '', description: '', conditionType: 'keyword', conditionValue: '{}',
      responseText: '', priority: rules.length, channels: 'web', isFallback: false,
    });
    setShowModal(true);
  };

  const openEdit = (r: AutoReplyRule) => {
    setEditId(String(r.id));
    setForm({
      name: r.name,
      description: r.description ?? '',
      conditionType: r.conditionType,
      conditionValue: typeof r.conditionValue === 'string' ? r.conditionValue : JSON.stringify(r.conditionValue, null, 2),
      responseText: r.responseText ?? '',
      priority: r.priority,
      channels: Array.isArray(r.channels) ? r.channels.join(', ') : (r.channels || 'web'),
      isFallback: r.isFallback || false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');
    let parsedConditionValue: any;
    try {
      parsedConditionValue = JSON.parse(form.conditionValue);
    } catch {
      return toast.error('Condition Value must be valid JSON');
    }
    const payload = {
      name: form.name,
      description: form.description,
      conditionType: form.conditionType,
      conditionValue: parsedConditionValue,
      responseText: form.responseText,
      priority: form.priority,
      channels: form.channels.split(',').map(c => c.trim()).filter(Boolean),
      isFallback: form.isFallback,
    };
    try {
      if (editId) {
        await updateAutoReplyRule(editId, payload);
        toast.success('Rule updated');
      } else {
        await createAutoReplyRule(payload);
        toast.success('Rule created');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try { await deleteAutoReplyRule(id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleToggle = async (id: string) => {
    try { await toggleAutoReplyRule(id); toast.success('Toggled'); load(); }
    catch { toast.error('Failed to toggle'); }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newRules = [...rules];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newRules.length) return;
    [newRules[index], newRules[swapIdx]] = [newRules[swapIdx], newRules[index]];
    const order = newRules.map((r) => String(r.id));
    try {
      await reorderAutoReplyRules(order);
      setRules(newRules.map((r, i) => ({ ...r, priority: i })));
      toast.success('Reordered');
    } catch { toast.error('Failed to reorder'); }
  };

  const conditionBadgeColor = (type: string) => {
    const map: Record<string, string> = {
      keyword: 'bg-blue-500/15 text-blue-400',
      regex: 'bg-purple-500/15 text-purple-400',
      intent: 'bg-orange-500/15 text-orange-400',
    };
    return map[type] || 'bg-white/10 text-white/40';
  };

  const filtered = rules.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Zap size={24} /> Auto-Reply Rules</h1>
          <p className="text-sm text-white/50 mt-1">Manage automatic response rules ordered by priority</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Rule
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rules..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-3 font-medium text-white/60 w-20">Priority</th>
              <th className="text-left p-3 font-medium text-white/60">Name</th>
              <th className="text-left p-3 font-medium text-white/60">Condition Type</th>
              <th className="text-left p-3 font-medium text-white/60">Status</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-white/30">No rules found</td></tr>
            ) : filtered.map((r, idx) => (
              <tr key={String(r.id)} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-white/60 font-mono text-xs w-8">#{r.priority}</span>
                    <div className="flex flex-col">
                      <button onClick={() => handleMove(idx, 'up')} disabled={idx === 0} className="p-0.5 hover:bg-white/10 rounded disabled:opacity-20"><ArrowUp size={10} /></button>
                      <button onClick={() => handleMove(idx, 'down')} disabled={idx === filtered.length - 1} className="p-0.5 hover:bg-white/10 rounded disabled:opacity-20"><ArrowDown size={10} /></button>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="font-medium">{r.name}</div>
                  {r.description && <p className="text-xs text-white/40 mt-0.5">{r.description}</p>}
                  {r.isFallback && <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/15 text-yellow-400 mt-1 inline-block">fallback</span>}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${conditionBadgeColor(r.conditionType)}`}>{r.conditionType}</span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.isEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {r.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Pencil size={14} className="text-blue-400" /></button>
                    <button onClick={() => handleToggle(String(r.id))} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Power size={14} className={r.isEnabled ? 'text-emerald-400' : 'text-red-400'} /></button>
                    <button onClick={() => handleDelete(String(r.id))} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editId ? 'Edit Rule' : 'Create Rule'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Condition Type</label>
                <select value={form.conditionType} onChange={e => setForm({ ...form, conditionType: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {CONDITION_TYPES.map(c => <option key={c} value={c} className="bg-[#161921]">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Condition Value (JSON)</label>
                <textarea value={form.conditionValue} onChange={e => setForm({ ...form, conditionValue: e.target.value })} rows={4} placeholder='{"keywords": ["hello", "hi"]}' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Response Text</label>
                <textarea value={form.responseText} onChange={e => setForm({ ...form, responseText: e.target.value })} rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Priority</label>
                <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Channels (comma-separated)</label>
                <input value={form.channels} onChange={e => setForm({ ...form, channels: e.target.value })} placeholder="web, mobile, whatsapp" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isFallback"
                  checked={form.isFallback}
                  onChange={e => setForm({ ...form, isFallback: e.target.checked })}
                  className="w-4 h-4 rounded border-white/10 bg-white/5"
                />
                <label htmlFor="isFallback" className="text-sm text-white/70">Is Fallback Rule</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">{editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
