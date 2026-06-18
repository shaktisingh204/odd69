"use client";

import React, { useEffect, useState } from 'react';
import {
  getFlows,
  createFlow,
  updateFlow,
  deleteFlow,
  publishFlow,
  unpublishFlow,
  duplicateFlow,
} from '@/actions/chatbot';
import {
  GitBranch, Plus, Pencil, Trash2, X, Search, RefreshCw,
  Copy, Globe, GlobeLock, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Flow {
  id: number;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerValue?: any;
  nodes: any;
  isPublished: boolean;
  isDraft: boolean;
  version: number;
  variables?: any;
  channels: string[];
  createdAt: string;
  updatedAt: string;
}

const TRIGGER_TYPES = ['keyword', 'intent', 'event', 'schedule', 'welcome'] as const;

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerType: 'keyword',
    nodes: '[]',
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const result = await getFlows();
      setFlows((result?.success ? result.data || [] : []) as any);
    } catch { toast.error('Failed to load flows'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', description: '', triggerType: 'keyword', nodes: '[]' });
    setShowModal(true);
  };

  const openEdit = (f: Flow) => {
    setEditId(String(f.id));
    setForm({
      name: f.name,
      description: f.description ?? '',
      triggerType: f.triggerType,
      nodes: JSON.stringify(f.nodes || [], null, 2),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');
    let parsedNodes: any;
    try {
      parsedNodes = JSON.parse(form.nodes);
    } catch {
      return toast.error('Nodes must be valid JSON');
    }
    const payload = {
      name: form.name,
      description: form.description,
      triggerType: form.triggerType,
      nodes: parsedNodes,
    };
    try {
      if (editId) {
        await updateFlow(editId, payload);
        toast.success('Flow updated');
      } else {
        await createFlow(payload);
        toast.success('Flow created');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flow?')) return;
    try { await deleteFlow(id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handlePublish = async (id: string) => {
    try { await publishFlow(id); toast.success('Published'); load(); }
    catch { toast.error('Failed to publish'); }
  };

  const handleUnpublish = async (id: string) => {
    try { await unpublishFlow(id); toast.success('Unpublished'); load(); }
    catch { toast.error('Failed to unpublish'); }
  };

  const handleDuplicate = async (id: string) => {
    try { await duplicateFlow(id); toast.success('Duplicated'); load(); }
    catch { toast.error('Failed to duplicate'); }
  };

  const triggerBadgeColor = (type: string) => {
    const map: Record<string, string> = {
      keyword: 'bg-blue-500/15 text-blue-400',
      intent: 'bg-purple-500/15 text-purple-400',
      event: 'bg-orange-500/15 text-orange-400',
      schedule: 'bg-cyan-500/15 text-cyan-400',
      welcome: 'bg-emerald-500/15 text-emerald-400',
    };
    return map[type] || 'bg-white/10 text-white/40';
  };

  const filtered = flows.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GitBranch size={24} /> Conversation Flows</h1>
          <p className="text-sm text-white/50 mt-1">Design and manage conversation flow templates</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Flow
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flows..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      {loading ? (
        <p className="text-center text-white/30 py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/30 py-12">No flows found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(f => (
            <div key={String(f.id)} className="border border-white/10 rounded-xl p-5 bg-white/5 hover:bg-white/[0.07] transition flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-lg">{f.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${f.isPublished ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'}`}>
                  {f.isPublished ? 'published' : 'draft'}
                </span>
              </div>
              <p className="text-sm text-white/40 mb-4 flex-1">{f.description || 'No description'}</p>
              <div className="flex items-center gap-3 text-xs text-white/40 mb-4">
                <span className={`px-2 py-0.5 rounded-full text-xs ${triggerBadgeColor(f.triggerType)}`}>{f.triggerType}</span>
                <span className="font-mono">v{f.version || 1}</span>
                {f.updatedAt && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {new Date(f.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 border-t border-white/10 pt-3">
                <button onClick={() => openEdit(f)} className="p-2 hover:bg-white/10 rounded-lg transition" title="Edit">
                  <Pencil size={14} className="text-blue-400" />
                </button>
                {!f.isPublished ? (
                  <button onClick={() => handlePublish(String(f.id))} className="p-2 hover:bg-white/10 rounded-lg transition" title="Publish">
                    <Globe size={14} className="text-emerald-400" />
                  </button>
                ) : (
                  <button onClick={() => handleUnpublish(String(f.id))} className="p-2 hover:bg-white/10 rounded-lg transition" title="Unpublish">
                    <GlobeLock size={14} className="text-yellow-400" />
                  </button>
                )}
                <button onClick={() => handleDuplicate(String(f.id))} className="p-2 hover:bg-white/10 rounded-lg transition" title="Duplicate">
                  <Copy size={14} className="text-purple-400" />
                </button>
                <button onClick={() => handleDelete(String(f.id))} className="p-2 hover:bg-white/10 rounded-lg transition ml-auto" title="Delete">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editId ? 'Edit Flow' : 'Create Flow'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Trigger Type</label>
                <select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {TRIGGER_TYPES.map(t => <option key={t} value={t} className="bg-[#161921]">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Nodes (JSON)</label>
                <textarea value={form.nodes} onChange={e => setForm({ ...form, nodes: e.target.value })} rows={8} placeholder='[{"id": "start", "type": "message", "content": "Hello!"}]' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
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
