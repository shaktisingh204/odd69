"use client";

import React, { useEffect, useState } from 'react';
import {
  getChatbotProfiles,
  createChatbotProfile,
  updateChatbotProfile,
  deleteChatbotProfile,
  toggleChatbotProfile,
} from '@/actions/chatbot';
import {
  Bot, Plus, Pencil, Trash2, Power, X, Search, RefreshCw, Clock, MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BotProfile {
  id: number;
  name: string;
  slug: string;
  personality: string | null;
  tone: string;
  responseDelay: number;
  typingIndicator: boolean;
  isEnabled: boolean;
  workingHoursOnly: boolean;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  workingTimezone: string | null;
}

const TONES = ['professional', 'casual', 'formal', 'friendly'];
const TIMEZONES = [
  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
  'Australia/Sydney',
];

const EMPTY_FORM = {
  name: '',
  slug: '',
  personality: '',
  tone: 'professional',
  responseDelay: 1000,
  typingIndicator: true,
  workingHoursOnly: false,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  workingTimezone: 'Asia/Kolkata',
};

export default function BotProfilesPage() {
  const [profiles, setProfiles] = useState<BotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getChatbotProfiles();
      if (res?.success && Array.isArray(res.data)) {
        setProfiles(res.data as BotProfile[]);
      } else {
        setProfiles([]);
      }
    } catch { toast.error('Failed to load profiles'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (p: BotProfile) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      slug: p.slug,
      personality: p.personality || '',
      tone: p.tone,
      responseDelay: p.responseDelay,
      typingIndicator: p.typingIndicator,
      workingHoursOnly: p.workingHoursOnly,
      workingHoursStart: p.workingHoursStart || '09:00',
      workingHoursEnd: p.workingHoursEnd || '18:00',
      workingTimezone: p.workingTimezone || 'Asia/Kolkata',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) return toast.error('Name and slug are required');
    try {
      setSaving(true);
      const payload = {
        name: form.name,
        slug: form.slug,
        personality: form.personality || null,
        tone: form.tone,
        responseDelay: form.responseDelay,
        typingIndicator: form.typingIndicator,
        workingHoursOnly: form.workingHoursOnly,
        workingHoursStart: form.workingHoursOnly ? form.workingHoursStart : null,
        workingHoursEnd: form.workingHoursOnly ? form.workingHoursEnd : null,
        workingTimezone: form.workingHoursOnly ? form.workingTimezone : null,
      };
      if (editId) {
        const res = await updateChatbotProfile(String(editId), payload);
        if (res?.success) toast.success('Profile updated');
        else toast.error(res?.error || 'Failed to update');
      } else {
        const res = await createChatbotProfile(payload);
        if (res?.success) toast.success('Profile created');
        else toast.error(res?.error || 'Failed to create');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save profile'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this profile?')) return;
    try {
      const res = await deleteChatbotProfile(String(id));
      if (res?.success) { toast.success('Profile deleted'); load(); }
      else toast.error(res?.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await toggleChatbotProfile(String(id));
      if (res?.success) { toast.success('Toggled'); load(); }
      else toast.error(res?.error || 'Failed to toggle');
    } catch { toast.error('Failed to toggle'); }
  };

  const filtered = profiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bot size={24} /> Bot Profiles</h1>
          <p className="text-sm text-white/50 mt-1">Manage chatbot personalities and settings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Profile
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search profiles..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-3 font-medium text-white/60">Name</th>
              <th className="text-left p-3 font-medium text-white/60">Slug</th>
              <th className="text-left p-3 font-medium text-white/60">Tone</th>
              <th className="text-left p-3 font-medium text-white/60">Response Delay</th>
              <th className="text-left p-3 font-medium text-white/60">Typing</th>
              <th className="text-left p-3 font-medium text-white/60">Status</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">No profiles found</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-white/60 font-mono text-xs">{p.slug}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-400 capitalize">{p.tone}</span>
                </td>
                <td className="p-3">
                  <span className="flex items-center gap-1 text-white/60 text-xs"><Clock size={12} /> {p.responseDelay}ms</span>
                </td>
                <td className="p-3">
                  <span className="flex items-center gap-1 text-white/60 text-xs">
                    <MessageSquare size={12} /> {p.typingIndicator ? 'On' : 'Off'}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.isEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {p.isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleToggle(p.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Toggle">
                      <Power size={14} className={p.isEnabled ? 'text-emerald-400' : 'text-red-400'} />
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Edit">
                      <Pencil size={14} className="text-blue-400" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Delete">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editId ? 'Edit Profile' : 'Create Profile'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Slug</label>
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Personality</label>
                <textarea value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })} rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" placeholder="Describe the bot's personality..." />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Tone</label>
                <select value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {TONES.map(t => <option key={t} value={t} className="bg-[#161921]">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Response Delay (ms)</label>
                <input type="number" value={form.responseDelay} onChange={e => setForm({ ...form, responseDelay: Number(e.target.value) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.typingIndicator} onChange={e => setForm({ ...form, typingIndicator: e.target.checked })} className="accent-blue-500" />
                  Typing Indicator
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.workingHoursOnly} onChange={e => setForm({ ...form, workingHoursOnly: e.target.checked })} className="accent-blue-500" />
                  Working Hours Only
                </label>
              </div>
              {form.workingHoursOnly && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Start Time</label>
                      <input type="time" value={form.workingHoursStart} onChange={e => setForm({ ...form, workingHoursStart: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">End Time</label>
                      <input type="time" value={form.workingHoursEnd} onChange={e => setForm({ ...form, workingHoursEnd: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Timezone</label>
                    <select value={form.workingTimezone} onChange={e => setForm({ ...form, workingTimezone: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                      {TIMEZONES.map(tz => <option key={tz} value={tz} className="bg-[#161921]">{tz}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
