"use client";

import React, { useEffect, useState } from 'react';
import {
  getResponseTemplates,
  createResponseTemplate,
  updateResponseTemplate,
  deleteResponseTemplate,
  toggleResponseTemplate,
  getIntents,
} from '@/actions/chatbot';
import {
  MessageCircle, Plus, Pencil, Trash2, Power, X, Search, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ResponseTemplate {
  id: number;
  name: string;
  intentId: number | null;
  content: string;
  contentType: string;
  richMedia: any;
  language: string;
  conditions: any;
  abTestGroup: string | null;
  isEnabled: boolean;
  priority: number;
}

interface Intent {
  id: number;
  name: string;
  displayName: string;
}

const CONTENT_TYPES = ['text', 'buttons', 'card', 'carousel', 'quick_reply'];
const LANGUAGES = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn'];

const EMPTY_FORM = {
  name: '',
  intentId: '',
  content: '',
  contentType: 'text',
  language: 'en',
  richMedia: '',
  conditions: '',
  abTestGroup: '',
};

export default function ResponsesPage() {
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
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
      const [tmplRes, intsRes] = await Promise.all([getResponseTemplates(), getIntents()]);
      if (tmplRes?.success && Array.isArray(tmplRes.data)) setTemplates(tmplRes.data as ResponseTemplate[]);
      else setTemplates([]);
      if (intsRes?.success && Array.isArray(intsRes.data)) setIntents(intsRes.data as Intent[]);
      else setIntents([]);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (t: ResponseTemplate) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      intentId: t.intentId ? String(t.intentId) : '',
      content: t.content,
      contentType: t.contentType,
      language: t.language,
      richMedia: t.richMedia ? JSON.stringify(t.richMedia, null, 2) : '',
      conditions: t.conditions ? JSON.stringify(t.conditions, null, 2) : '',
      abTestGroup: t.abTestGroup || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');
    try {
      setSaving(true);
      const payload: any = {
        name: form.name,
        intentId: form.intentId ? Number(form.intentId) : null,
        content: form.content,
        contentType: form.contentType,
        language: form.language,
        abTestGroup: form.abTestGroup || null,
      };
      if (form.richMedia.trim()) {
        try { payload.richMedia = JSON.parse(form.richMedia); }
        catch { return toast.error('Rich Media must be valid JSON'); }
      }
      if (form.conditions.trim()) {
        try { payload.conditions = JSON.parse(form.conditions); }
        catch { return toast.error('Conditions must be valid JSON'); }
      }
      if (editId) {
        const res = await updateResponseTemplate(String(editId), payload);
        if (res?.success) toast.success('Template updated');
        else toast.error(res?.error || 'Failed to update');
      } else {
        const res = await createResponseTemplate(payload);
        if (res?.success) toast.success('Template created');
        else toast.error(res?.error || 'Failed to create');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await deleteResponseTemplate(String(id));
      if (res?.success) { toast.success('Deleted'); load(); }
      else toast.error(res?.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await toggleResponseTemplate(String(id));
      if (res?.success) { toast.success('Toggled'); load(); }
      else toast.error(res?.error || 'Failed to toggle');
    } catch { toast.error('Failed to toggle'); }
  };

  const getIntentName = (id: number | null) => {
    if (!id) return '-';
    const intent = intents.find(i => i.id === id);
    return intent?.displayName || intent?.name || String(id);
  };

  const contentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-cyan-500/15 text-cyan-400',
      buttons: 'bg-blue-500/15 text-blue-400',
      card: 'bg-purple-500/15 text-purple-400',
      carousel: 'bg-pink-500/15 text-pink-400',
      quick_reply: 'bg-amber-500/15 text-amber-400',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs ${colors[type] || 'bg-white/10 text-white/60'}`}>{type}</span>;
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    getIntentName(t.intentId).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle size={24} /> Response Templates</h1>
          <p className="text-sm text-white/50 mt-1">Manage bot response templates linked to intents</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Template
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-3 font-medium text-white/60">Name</th>
              <th className="text-left p-3 font-medium text-white/60">Intent</th>
              <th className="text-left p-3 font-medium text-white/60">Content Type</th>
              <th className="text-left p-3 font-medium text-white/60">Language</th>
              <th className="text-left p-3 font-medium text-white/60">A/B Group</th>
              <th className="text-left p-3 font-medium text-white/60">Status</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">No templates found</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition">
                <td className="p-3 font-medium">{t.name}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/15 text-indigo-400">{getIntentName(t.intentId)}</span>
                </td>
                <td className="p-3">{contentTypeBadge(t.contentType)}</td>
                <td className="p-3 text-white/60 uppercase text-xs">{t.language}</td>
                <td className="p-3 text-white/60 text-xs">{t.abTestGroup || '-'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.isEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {t.isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleToggle(t.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Toggle">
                      <Power size={14} className={t.isEnabled ? 'text-emerald-400' : 'text-red-400'} />
                    </button>
                    <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Edit">
                      <Pencil size={14} className="text-blue-400" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Delete">
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
              <h2 className="text-lg font-bold">{editId ? 'Edit Template' : 'Create Template'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Intent</label>
                <select value={form.intentId} onChange={e => setForm({ ...form, intentId: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  <option value="" className="bg-[#161921]">Select intent (optional)</option>
                  {intents.map(i => <option key={i.id} value={String(i.id)} className="bg-[#161921]">{i.displayName || i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Content</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={5} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Content Type</label>
                  <select value={form.contentType} onChange={e => setForm({ ...form, contentType: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                    {CONTENT_TYPES.map(c => <option key={c} value={c} className="bg-[#161921]">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Language</label>
                  <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                    {LANGUAGES.map(l => <option key={l} value={l} className="bg-[#161921]">{l.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Rich Media (JSON, optional)</label>
                <textarea
                  value={form.richMedia}
                  onChange={e => setForm({ ...form, richMedia: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30"
                  placeholder='{"image_url": "https://...", "buttons": [...]}'
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Conditions (JSON, optional)</label>
                <textarea
                  value={form.conditions}
                  onChange={e => setForm({ ...form, conditions: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30"
                  placeholder='{"segment": "vip", "language": "en"}'
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">A/B Test Group (optional)</label>
                <input value={form.abTestGroup} onChange={e => setForm({ ...form, abTestGroup: e.target.value })} placeholder="e.g. A, B, control" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
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
