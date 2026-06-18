"use client";

import React, { useEffect, useState } from 'react';
import {
  getGreetings,
  createGreeting,
  updateGreeting,
  deleteGreeting,
  toggleGreeting,
} from '@/actions/chatbot';
import {
  HandMetal, Plus, Pencil, Trash2, Power, X, Search, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Greeting {
  id: number;
  name: string;
  greetingType: string;
  channel: string;
  content: string;
  richMedia?: any;
  conditions?: any;
  isEnabled: boolean;
  priority: number;
}

const GREETING_TYPES = ['welcome', 'returning', 'time_based', 'event_based'];
const CHANNELS = ['support', 'whatsapp', 'webwidget'];

const typeBadgeColor: Record<string, string> = {
  welcome: 'bg-emerald-500/15 text-emerald-400',
  returning: 'bg-blue-500/15 text-blue-400',
  time_based: 'bg-amber-500/15 text-amber-400',
  event_based: 'bg-purple-500/15 text-purple-400',
};

export default function GreetingsPage() {
  const [greetings, setGreetings] = useState<Greeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    greetingType: 'welcome',
    channel: 'support',
    content: '',
    richMedia: '',
    conditions: '',
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getGreetings();
      if (res.success) setGreetings(res.data || []);
      else toast.error(res.error || 'Failed to load greetings');
    } catch { toast.error('Failed to load greetings'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', greetingType: 'welcome', channel: 'support', content: '', richMedia: '', conditions: '' });
    setShowModal(true);
  };

  const openEdit = (g: Greeting) => {
    setEditId(g.id);
    setForm({
      name: g.name,
      greetingType: g.greetingType,
      channel: g.channel,
      content: g.content,
      richMedia: g.richMedia ? JSON.stringify(g.richMedia, null, 2) : '',
      conditions: g.conditions ? JSON.stringify(g.conditions, null, 2) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');
    if (!form.content) return toast.error('Content required');

    let richMedia = undefined;
    let conditions = undefined;
    try {
      if (form.richMedia.trim()) richMedia = JSON.parse(form.richMedia);
    } catch { return toast.error('Invalid Rich Media JSON'); }
    try {
      if (form.conditions.trim()) conditions = JSON.parse(form.conditions);
    } catch { return toast.error('Invalid Conditions JSON'); }

    const payload = {
      name: form.name,
      greetingType: form.greetingType,
      channel: form.channel,
      content: form.content,
      richMedia,
      conditions,
    };

    try {
      if (editId !== null) {
        const res = await updateGreeting(String(editId), payload);
        if (res.success) toast.success('Greeting updated');
        else toast.error(res.error || 'Failed to update');
      } else {
        const res = await createGreeting(payload);
        if (res.success) toast.success('Greeting created');
        else toast.error(res.error || 'Failed to create');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this greeting?')) return;
    try {
      const res = await deleteGreeting(String(id));
      if (res.success) { toast.success('Deleted'); load(); }
      else toast.error(res.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await toggleGreeting(String(id));
      if (res.success) { toast.success('Toggled'); load(); }
      else toast.error(res.error || 'Failed to toggle');
    } catch { toast.error('Failed to toggle'); }
  };

  const filtered = greetings.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.greetingType.toLowerCase().includes(search.toLowerCase()) ||
    g.channel.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><HandMetal size={24} /> Greetings</h1>
          <p className="text-sm text-white/50 mt-1">Manage automated greeting messages for different channels</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Greeting
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search greetings..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-3 font-medium text-white/60">Name</th>
              <th className="text-left p-3 font-medium text-white/60">Greeting Type</th>
              <th className="text-left p-3 font-medium text-white/60">Channel</th>
              <th className="text-left p-3 font-medium text-white/60">Status</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-white/30">No greetings found</td></tr>
            ) : filtered.map(g => (
              <tr key={g.id} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="p-3 font-medium">{g.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${typeBadgeColor[g.greetingType] || 'bg-gray-500/15 text-gray-400'}`}>
                    {g.greetingType.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-3 text-white/60 capitalize">{g.channel.replace('_', ' ')}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${g.isEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {g.isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleToggle(g.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Power size={14} className={g.isEnabled ? 'text-emerald-400' : 'text-red-400'} /></button>
                    <button onClick={() => openEdit(g)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Pencil size={14} className="text-blue-400" /></button>
                    <button onClick={() => handleDelete(g.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Trash2 size={14} className="text-red-400" /></button>
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
              <h2 className="text-lg font-bold">{editId !== null ? 'Edit Greeting' : 'Create Greeting'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Greeting Type</label>
                <select value={form.greetingType} onChange={e => setForm({ ...form, greetingType: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {GREETING_TYPES.map(t => <option key={t} value={t} className="bg-[#161921]">{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Channel</label>
                <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {CHANNELS.map(c => <option key={c} value={c} className="bg-[#161921]">{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Content</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Rich Media (JSON, optional)</label>
                <textarea value={form.richMedia} onChange={e => setForm({ ...form, richMedia: e.target.value })} rows={3} placeholder='{"type": "image", "url": "..."}' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Conditions (JSON, optional)</label>
                <textarea value={form.conditions} onChange={e => setForm({ ...form, conditions: e.target.value })} rows={3} placeholder='{"timeRange": "09:00-17:00"}' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
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
