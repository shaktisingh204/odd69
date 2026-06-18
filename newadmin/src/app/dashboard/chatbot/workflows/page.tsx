"use client";

import React, { useEffect, useState } from 'react';
import {
  getWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
} from '@/actions/chatbot';
import {
  Workflow, Plus, Pencil, Trash2, Power, X, Search, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WorkflowItem {
  id: number;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: any;
  actions: any;
  conditions?: any;
  isEnabled: boolean;
  schedule?: string;
}

const TRIGGER_TYPES = ['user_action', 'time_based', 'event_based', 'webhook'];

const triggerBadgeColor: Record<string, string> = {
  user_action: 'bg-blue-500/15 text-blue-400',
  time_based: 'bg-amber-500/15 text-amber-400',
  event_based: 'bg-purple-500/15 text-purple-400',
  webhook: 'bg-emerald-500/15 text-emerald-400',
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerType: 'user_action',
    triggerConfig: '',
    actions: '',
    conditions: '',
    schedule: '',
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getWorkflows();
      if (res.success) setWorkflows((res.data || []) as any);
      else toast.error(res.error || 'Failed to load workflows');
    } catch { toast.error('Failed to load workflows'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', description: '', triggerType: 'user_action', triggerConfig: '{}', actions: '[]', conditions: '', schedule: '' });
    setShowModal(true);
  };

  const openEdit = (w: WorkflowItem) => {
    setEditId(w.id);
    setForm({
      name: w.name,
      description: w.description || '',
      triggerType: w.triggerType,
      triggerConfig: w.triggerConfig ? JSON.stringify(w.triggerConfig, null, 2) : '{}',
      actions: w.actions ? JSON.stringify(w.actions, null, 2) : '[]',
      conditions: w.conditions ? JSON.stringify(w.conditions, null, 2) : '',
      schedule: w.schedule || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');

    let triggerConfig: any;
    let actions: any;
    let conditions: any = undefined;

    try { triggerConfig = JSON.parse(form.triggerConfig || '{}'); }
    catch { return toast.error('Invalid Trigger Config JSON'); }

    try { actions = JSON.parse(form.actions || '[]'); }
    catch { return toast.error('Invalid Actions JSON'); }

    try {
      if (form.conditions.trim()) conditions = JSON.parse(form.conditions);
    } catch { return toast.error('Invalid Conditions JSON'); }

    const payload = {
      name: form.name,
      description: form.description || undefined,
      triggerType: form.triggerType,
      triggerConfig,
      actions,
      conditions,
      schedule: form.schedule || undefined,
    };

    try {
      if (editId !== null) {
        const res = await updateWorkflow(String(editId), payload);
        if (res.success) toast.success('Workflow updated');
        else toast.error(res.error || 'Failed to update');
      } else {
        const res = await createWorkflow(payload);
        if (res.success) toast.success('Workflow created');
        else toast.error(res.error || 'Failed to create');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this workflow?')) return;
    try {
      const res = await deleteWorkflow(String(id));
      if (res.success) { toast.success('Deleted'); load(); }
      else toast.error(res.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await toggleWorkflow(String(id));
      if (res.success) { toast.success('Toggled'); load(); }
      else toast.error(res.error || 'Failed to toggle');
    } catch { toast.error('Failed to toggle'); }
  };

  const filtered = workflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.description || '').toLowerCase().includes(search.toLowerCase()) ||
    w.triggerType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Workflow size={24} /> Workflows</h1>
          <p className="text-sm text-white/50 mt-1">Manage automation workflows and triggers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Workflow
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-3 font-medium text-white/60">Name</th>
              <th className="text-left p-3 font-medium text-white/60">Description</th>
              <th className="text-left p-3 font-medium text-white/60">Trigger Type</th>
              <th className="text-left p-3 font-medium text-white/60">Schedule</th>
              <th className="text-left p-3 font-medium text-white/60">Status</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-white/30">No workflows found</td></tr>
            ) : filtered.map(w => (
              <tr key={w.id} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="p-3 font-medium">{w.name}</td>
                <td className="p-3 text-white/60 max-w-[200px] truncate">{w.description || '-'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${triggerBadgeColor[w.triggerType] || 'bg-gray-500/15 text-gray-400'}`}>
                    {w.triggerType.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-3 text-white/60 font-mono text-xs">{w.schedule || 'manual'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${w.isEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {w.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleToggle(w.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Power size={14} className={w.isEnabled ? 'text-emerald-400' : 'text-red-400'} /></button>
                    <button onClick={() => openEdit(w)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Pencil size={14} className="text-blue-400" /></button>
                    <button onClick={() => handleDelete(w.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Trash2 size={14} className="text-red-400" /></button>
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
              <h2 className="text-lg font-bold">{editId !== null ? 'Edit Workflow' : 'Create Workflow'}</h2>
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
                <label className="block text-xs text-white/50 mb-1">Trigger Type</label>
                <select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {TRIGGER_TYPES.map(t => <option key={t} value={t} className="bg-[#161921]">{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Trigger Config (JSON)</label>
                <textarea value={form.triggerConfig} onChange={e => setForm({ ...form, triggerConfig: e.target.value })} rows={3} placeholder='{"event": "user_signup"}' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Actions (JSON Array)</label>
                <textarea value={form.actions} onChange={e => setForm({ ...form, actions: e.target.value })} rows={4} placeholder='[{"type": "send_message", "content": "..."}]' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Conditions (JSON, optional)</label>
                <textarea value={form.conditions} onChange={e => setForm({ ...form, conditions: e.target.value })} rows={3} placeholder='{"userSegment": "vip"}' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Schedule (cron expression, optional)</label>
                <input value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })} placeholder="0 9 * * * (every day at 9am)" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">{editId !== null ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
