"use client";

import React, { useEffect, useState } from 'react';
import {
  getEscalationRules,
  createEscalationRule,
  updateEscalationRule,
  deleteEscalationRule,
  toggleEscalationRule,
} from '@/actions/chatbot';
import {
  AlertTriangle, Plus, Pencil, Trash2, Power, X, Search, RefreshCw,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EscalationRule {
  id: number;
  name: string;
  triggerType: string;
  triggerConfig: any;
  routeTo?: string | null;
  priorityLevel: string;
  slaMinutes?: number | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const TRIGGER_TYPES = ['low_confidence', 'keyword', 'user_request', 'timeout', 'sentiment'] as const;
const PRIORITY_LEVELS = ['low', 'normal', 'high', 'urgent'] as const;

export default function EscalationPage() {
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    triggerType: 'low_confidence',
    triggerConfig: '{}',
    routeTo: '',
    priorityLevel: 'normal',
    slaMinutes: 30,
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const result = await getEscalationRules();
      setRules((result?.success ? result.data || [] : []) as any);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', triggerType: 'low_confidence', triggerConfig: '{}', routeTo: '', priorityLevel: 'normal', slaMinutes: 30 });
    setShowModal(true);
  };

  const openEdit = (r: EscalationRule) => {
    setEditId(String(r.id));
    setForm({
      name: r.name,
      triggerType: r.triggerType,
      triggerConfig: typeof r.triggerConfig === 'string' ? r.triggerConfig : JSON.stringify(r.triggerConfig || {}, null, 2),
      routeTo: r.routeTo || '',
      priorityLevel: r.priorityLevel,
      slaMinutes: r.slaMinutes ?? 30,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');
    let parsedConfig: any;
    try {
      parsedConfig = JSON.parse(form.triggerConfig);
    } catch {
      return toast.error('Trigger Config must be valid JSON');
    }
    const payload = {
      name: form.name,
      triggerType: form.triggerType,
      triggerConfig: parsedConfig,
      routeTo: form.routeTo,
      priorityLevel: form.priorityLevel,
      slaMinutes: form.slaMinutes,
    };
    try {
      if (editId) {
        await updateEscalationRule(editId, payload);
        toast.success('Rule updated');
      } else {
        await createEscalationRule(payload);
        toast.success('Rule created');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try { await deleteEscalationRule(id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleToggle = async (id: string) => {
    try { await toggleEscalationRule(id); toast.success('Toggled'); load(); }
    catch { toast.error('Failed to toggle'); }
  };

  const priorityColor = (p: string) => {
    const map: Record<string, string> = {
      low: 'bg-gray-500/15 text-gray-400',
      normal: 'bg-blue-500/15 text-blue-400',
      high: 'bg-yellow-500/15 text-yellow-400',
      urgent: 'bg-red-500/15 text-red-400',
    };
    return map[p] || 'bg-white/10 text-white/40';
  };

  const triggerBadgeColor = (t: string) => {
    const map: Record<string, string> = {
      low_confidence: 'bg-purple-500/15 text-purple-400',
      keyword: 'bg-blue-500/15 text-blue-400',
      user_request: 'bg-emerald-500/15 text-emerald-400',
      timeout: 'bg-orange-500/15 text-orange-400',
      sentiment: 'bg-pink-500/15 text-pink-400',
    };
    return map[t] || 'bg-white/10 text-white/40';
  };

  const filtered = rules.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle size={24} /> Escalation Rules</h1>
          <p className="text-sm text-white/50 mt-1">Configure when and how conversations escalate to humans</p>
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
              <th className="text-left p-3 font-medium text-white/60">Name</th>
              <th className="text-left p-3 font-medium text-white/60">Trigger Type</th>
              <th className="text-left p-3 font-medium text-white/60">Route To</th>
              <th className="text-left p-3 font-medium text-white/60">Priority Level</th>
              <th className="text-left p-3 font-medium text-white/60">SLA Minutes</th>
              <th className="text-left p-3 font-medium text-white/60">Status</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">No rules found</td></tr>
            ) : filtered.map(r => (
              <tr key={String(r.id)} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${triggerBadgeColor(r.triggerType)}`}>
                    {r.triggerType.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-white/60 text-xs">{r.routeTo || '-'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${priorityColor(r.priorityLevel)}`}>
                    {r.priorityLevel}
                  </span>
                </td>
                <td className="p-3">
                  <span className="flex items-center gap-1 text-white/50"><Clock size={12} /> {r.slaMinutes}m</span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.isEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {r.isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleToggle(String(r.id))} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Power size={14} className={r.isEnabled ? 'text-emerald-400' : 'text-red-400'} /></button>
                    <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Pencil size={14} className="text-blue-400" /></button>
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
                <label className="block text-xs text-white/50 mb-1">Trigger Type</label>
                <select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {TRIGGER_TYPES.map(t => <option key={t} value={t} className="bg-[#161921]">{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Trigger Config (JSON)</label>
                <textarea value={form.triggerConfig} onChange={e => setForm({ ...form, triggerConfig: e.target.value })} rows={4} placeholder='{"threshold": 0.5, "keywords": ["help"]}' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Route To</label>
                <input value={form.routeTo} onChange={e => setForm({ ...form, routeTo: e.target.value })} placeholder="e.g. support_queue, agent_name" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Priority Level</label>
                  <select value={form.priorityLevel} onChange={e => setForm({ ...form, priorityLevel: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                    {PRIORITY_LEVELS.map(p => <option key={p} value={p} className="bg-[#161921]">{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">SLA (minutes)</label>
                  <input type="number" value={form.slaMinutes} onChange={e => setForm({ ...form, slaMinutes: Number(e.target.value) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
                </div>
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
