"use client";

import React, { useEffect, useState } from 'react';
import {
  getIntents,
  createIntent,
  deleteIntent,
  addTrainingPhrase,
  deleteTrainingPhrase,
  toggleIntent,
} from '@/actions/chatbot';
import {
  Brain, Plus, Trash2, Power, X, Search, RefreshCw,
  ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TrainingPhrase {
  id: number;
  phrase: string;
  language: string;
}

interface Intent {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  category: string | null;
  confidenceThreshold: number;
  isEnabled: boolean;
  priority: number;
  trainingPhrases?: TrainingPhrase[];
  _count?: { trainingPhrases: number };
}

const CATEGORIES = ['general', 'support', 'billing', 'account', 'sports', 'casino', 'promotions', 'other'];

const EMPTY_FORM = {
  name: '',
  displayName: '',
  description: '',
  category: 'general',
  confidenceThreshold: 0.7,
};

export default function IntentsPage() {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedPhrases, setExpandedPhrases] = useState<TrainingPhrase[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getIntents();
      if (res?.success && Array.isArray(res.data)) {
        setIntents(res.data as Intent[]);
      } else {
        setIntents([]);
      }
    } catch { toast.error('Failed to load intents'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.displayName) return toast.error('Name and display name are required');
    try {
      setSaving(true);
      const payload = {
        name: form.name,
        displayName: form.displayName,
        description: form.description || null,
        category: form.category,
        confidenceThreshold: form.confidenceThreshold,
      };
      const res = await createIntent(payload);
      if (res?.success) {
        toast.success('Intent created');
        setShowModal(false);
        load();
      } else {
        toast.error(res?.error || 'Failed to create');
      }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this intent and all its training phrases?')) return;
    try {
      const res = await deleteIntent(String(id));
      if (res?.success) { toast.success('Deleted'); load(); }
      else toast.error(res?.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await toggleIntent(String(id));
      if (res?.success) { toast.success('Toggled'); load(); }
      else toast.error(res?.error || 'Failed to toggle');
    } catch { toast.error('Failed to toggle'); }
  };

  const toggleExpand = async (intent: Intent) => {
    if (expandedId === intent.id) {
      setExpandedId(null);
      setExpandedPhrases([]);
      return;
    }
    setExpandedId(intent.id);
    setExpandedPhrases(intent.trainingPhrases || []);
  };

  const handleAddPhrase = async (intentId: number) => {
    if (!newPhrase.trim()) return;
    try {
      const res = await addTrainingPhrase(String(intentId), newPhrase.trim());
      if (res?.success) {
        toast.success('Phrase added');
        setNewPhrase('');
        load();
        // Add to local expanded list
        if (res.data) {
          setExpandedPhrases(prev => [res.data as TrainingPhrase, ...prev]);
        }
      } else {
        toast.error(res?.error || 'Failed to add phrase');
      }
    } catch { toast.error('Failed to add phrase'); }
  };

  const handleDeletePhrase = async (phraseId: number) => {
    try {
      const res = await deleteTrainingPhrase(String(phraseId));
      if (res?.success) {
        toast.success('Phrase removed');
        setExpandedPhrases(prev => prev.filter(p => p.id !== phraseId));
        load();
      } else {
        toast.error(res?.error || 'Failed to remove phrase');
      }
    } catch { toast.error('Failed to remove phrase'); }
  };

  const filtered = intents.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const phrasesCount = (i: Intent) => i._count?.trainingPhrases ?? i.trainingPhrases?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain size={24} /> Intents</h1>
          <p className="text-sm text-white/50 mt-1">Manage chatbot intents and training phrases</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Intent
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search intents..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-3 font-medium text-white/60 w-8"></th>
              <th className="text-left p-3 font-medium text-white/60">Display Name</th>
              <th className="text-left p-3 font-medium text-white/60">Name (code)</th>
              <th className="text-left p-3 font-medium text-white/60">Category</th>
              <th className="text-left p-3 font-medium text-white/60">Threshold</th>
              <th className="text-left p-3 font-medium text-white/60">Phrases</th>
              <th className="text-left p-3 font-medium text-white/60">Status</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-white/30">No intents found</td></tr>
            ) : filtered.map(i => (
              <React.Fragment key={i.id}>
                <tr className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="p-3">
                    <button onClick={() => toggleExpand(i)} className="p-1 hover:bg-white/10 rounded">
                      {expandedId === i.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </td>
                  <td className="p-3 font-medium">{i.displayName}</td>
                  <td className="p-3 text-white/60 font-mono text-xs">{i.name}</td>
                  <td className="p-3">
                    {i.category && <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/15 text-indigo-400 capitalize">{i.category}</span>}
                  </td>
                  <td className="p-3 text-white/60">{(i.confidenceThreshold * 100).toFixed(0)}%</td>
                  <td className="p-3">
                    <span className="flex items-center gap-1 text-white/60"><MessageSquare size={12} /> {phrasesCount(i)}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${i.isEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {i.isEnabled ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleToggle(i.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition">
                        <Power size={14} className={i.isEnabled ? 'text-emerald-400' : 'text-red-400'} />
                      </button>
                      <button onClick={() => handleDelete(i.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === i.id && (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={8} className="p-4">
                      <div className="space-y-2">
                        {i.description && (
                          <p className="text-xs text-white/50 mb-3 italic">{i.description}</p>
                        )}
                        <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Training Phrases</p>
                        <div className="flex flex-wrap gap-2">
                          {(expandedPhrases.length > 0 ? expandedPhrases : i.trainingPhrases || []).map((phrase) => (
                            <span key={phrase.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs">
                              {phrase.phrase}
                              <button onClick={() => handleDeletePhrase(phrase.id)} className="text-red-400 hover:text-red-300">
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                          {phrasesCount(i) === 0 && expandedPhrases.length === 0 && (
                            <span className="text-xs text-white/30">No training phrases yet</span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <input
                            value={newPhrase}
                            onChange={e => setNewPhrase(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddPhrase(i.id)}
                            placeholder="Add training phrase..."
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
                          />
                          <button onClick={() => handleAddPhrase(i.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">Add</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Intent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Create Intent</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name (code identifier)</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. greeting_hello" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Display Name</label>
                <input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. Hello Greeting" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" placeholder="What does this intent recognize?" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#161921]">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">
                  Confidence Threshold: {(form.confidenceThreshold * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={form.confidenceThreshold}
                  onChange={e => setForm({ ...form, confidenceThreshold: Number(e.target.value) })}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-white/30 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
