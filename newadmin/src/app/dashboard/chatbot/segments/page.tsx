"use client";

import React, { useEffect, useState } from 'react';
import {
  getChatbotSegments,
  createChatbotSegment,
  updateChatbotSegment,
  deleteChatbotSegment,
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
} from '@/actions/chatbot';
import {
  Users, Plus, Pencil, Trash2, X, Search, RefreshCw,
  Shield, UserX,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Segment {
  id: number;
  name: string;
  description?: string | null;
  conditions: any;
  botConfigOverrides?: any;
  autoReplyOverrides?: any;
  createdAt: string;
  updatedAt: string;
}

interface BlacklistEntry {
  id: number;
  userId: number;
  reason?: string | null;
  createdAt: string;
}

type TabId = 'segments' | 'blacklist';

export default function SegmentsPage() {
  const [tab, setTab] = useState<TabId>('segments');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', conditions: '{}' });
  const [blForm, setBlForm] = useState({ userId: '', reason: '' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [segsRes, blRes] = await Promise.all([getChatbotSegments(), getBlacklist()]);
      setSegments((segsRes?.success ? segsRes.data || [] : []) as any);
      setBlacklist((blRes?.success ? blRes.data || [] : []) as any);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', description: '', conditions: '{}' });
    setShowModal(true);
  };

  const openEdit = (s: Segment) => {
    setEditId(String(s.id));
    setForm({
      name: s.name,
      description: s.description ?? '',
      conditions: typeof s.conditions === 'string' ? s.conditions : JSON.stringify(s.conditions, null, 2),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');
    try {
      JSON.parse(form.conditions);
    } catch { return toast.error('Invalid JSON in conditions'); }
    try {
      if (editId) {
        await updateChatbotSegment(editId, form);
        toast.success('Segment updated');
      } else {
        await createChatbotSegment(form);
        toast.success('Segment created');
      }
      setShowModal(false);
      loadAll();
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this segment?')) return;
    try { await deleteChatbotSegment(id); toast.success('Deleted'); loadAll(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleAddBlacklist = async () => {
    if (!blForm.userId) return toast.error('User ID required');
    const userId = Number(blForm.userId);
    if (isNaN(userId)) return toast.error('User ID must be a number');
    try {
      await addToBlacklist(String(userId), blForm.reason || undefined);
      toast.success('User blacklisted');
      setBlForm({ userId: '', reason: '' });
      loadAll();
    } catch { toast.error('Failed to blacklist'); }
  };

  const handleRemoveBlacklist = async (id: string) => {
    if (!confirm('Remove from blacklist?')) return;
    try { await removeFromBlacklist(id); toast.success('Removed'); loadAll(); }
    catch { toast.error('Failed to remove'); }
  };

  const truncateJson = (val: any) => {
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    return str.length > 60 ? str.slice(0, 60) + '...' : str;
  };

  const filteredSegments = segments.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredBlacklist = blacklist.filter(b =>
    String(b.userId).includes(search) || b.reason?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users size={24} /> User Segments</h1>
          <p className="text-sm text-white/50 mt-1">Manage user targeting segments and blacklist</p>
        </div>
        <button onClick={loadAll} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1 w-fit">
        {([
          { id: 'segments' as TabId, label: 'Segments', icon: Shield },
          { id: 'blacklist' as TabId, label: 'Blacklist', icon: UserX },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${tab === t.id ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white/80'}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      {tab === 'segments' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
              <Plus size={16} /> Create Segment
            </button>
          </div>
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left p-3 font-medium text-white/60">Name</th>
                  <th className="text-left p-3 font-medium text-white/60">Description</th>
                  <th className="text-left p-3 font-medium text-white/60">Conditions</th>
                  <th className="text-right p-3 font-medium text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-white/30">Loading...</td></tr>
                ) : filteredSegments.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-white/30">No segments found</td></tr>
                ) : filteredSegments.map(s => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-white/50">{s.description || '-'}</td>
                    <td className="p-3">
                      <code className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded max-w-[250px] truncate block">
                        {truncateJson(s.conditions)}
                      </code>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Pencil size={14} className="text-blue-400" /></button>
                        <button onClick={() => handleDelete(String(s.id))} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Trash2 size={14} className="text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'blacklist' && (
        <>
          {/* Add to blacklist form */}
          <div className="border border-white/10 rounded-xl p-4 mb-4 bg-white/5">
            <h3 className="text-sm font-medium mb-3">Add User to Blacklist</h3>
            <div className="flex gap-2">
              <input
                type="number"
                value={blForm.userId}
                onChange={e => setBlForm({ ...blForm, userId: e.target.value })}
                placeholder="User ID (number)"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
              />
              <input
                value={blForm.reason}
                onChange={e => setBlForm({ ...blForm, reason: e.target.value })}
                placeholder="Reason"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
              />
              <button onClick={handleAddBlacklist} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition">Block</button>
            </div>
          </div>

          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left p-3 font-medium text-white/60">User ID</th>
                  <th className="text-left p-3 font-medium text-white/60">Reason</th>
                  <th className="text-left p-3 font-medium text-white/60">Date</th>
                  <th className="text-right p-3 font-medium text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-white/30">Loading...</td></tr>
                ) : filteredBlacklist.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-white/30">No blacklisted users</td></tr>
                ) : filteredBlacklist.map(b => (
                  <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="p-3 font-mono text-xs">{b.userId}</td>
                    <td className="p-3 text-white/50">{b.reason || '-'}</td>
                    <td className="p-3 text-white/40 text-xs">{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleRemoveBlacklist(String(b.id))} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Trash2 size={14} className="text-red-400" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editId ? 'Edit Segment' : 'Create Segment'}</h2>
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
                <label className="block text-xs text-white/50 mb-1">Conditions (JSON)</label>
                <textarea value={form.conditions} onChange={e => setForm({ ...form, conditions: e.target.value })} rows={6} placeholder='{"minBalance": 100, "registeredAfter": "2024-01-01"}' className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
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
