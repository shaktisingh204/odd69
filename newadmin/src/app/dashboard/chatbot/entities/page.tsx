"use client";

import React, { useEffect, useState } from 'react';
import {
  getEntities,
  getEntity,
  createEntity,
  deleteEntity,
  addSynonym,
  deleteSynonym,
} from '@/actions/chatbot';
import {
  Layers, Plus, Trash2, X, Search, RefreshCw,
  ChevronDown, ChevronUp, Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Synonym {
  id: number;
  value: string;
  synonyms: string[];
}

interface Entity {
  id: number;
  name: string;
  displayName: string;
  type: string;
  pattern: string | null;
  values: any;
  synonyms?: Synonym[];
  _count?: { synonyms: number };
}

const TYPES = ['regex', 'list', 'system'] as const;

const EMPTY_FORM = {
  name: '',
  displayName: '',
  type: 'list' as string,
  pattern: '',
  values: '',
};

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedSynonyms, setExpandedSynonyms] = useState<Synonym[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [newSynonymValue, setNewSynonymValue] = useState('');
  const [newSynonymList, setNewSynonymList] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getEntities();
      if (res?.success && Array.isArray(res.data)) {
        setEntities(res.data as Entity[]);
      } else {
        setEntities([]);
      }
    } catch { toast.error('Failed to load entities'); }
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
      const payload: any = {
        name: form.name,
        displayName: form.displayName,
        type: form.type,
        pattern: form.type === 'regex' ? form.pattern : null,
      };
      if (form.values.trim()) {
        try {
          payload.values = JSON.parse(form.values);
        } catch {
          return toast.error('Values must be valid JSON');
        }
      }
      const res = await createEntity(payload);
      if (res?.success) {
        toast.success('Entity created');
        setShowModal(false);
        load();
      } else {
        toast.error(res?.error || 'Failed to create');
      }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entity and all its synonyms?')) return;
    try {
      const res = await deleteEntity(String(id));
      if (res?.success) { toast.success('Deleted'); load(); }
      else toast.error(res?.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const toggleExpand = async (entity: Entity) => {
    if (expandedId === entity.id) {
      setExpandedId(null);
      setExpandedSynonyms([]);
      return;
    }
    setExpandedId(entity.id);
    // Fetch full entity with synonyms
    try {
      const res = await getEntity(String(entity.id));
      if (res?.success && res.data) {
        setExpandedSynonyms((res.data as Entity).synonyms || []);
      }
    } catch {
      setExpandedSynonyms([]);
    }
  };

  const handleAddSynonym = async (entityId: number) => {
    if (!newSynonymValue.trim()) return toast.error('Value is required');
    const synonymsList = newSynonymList.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const res = await addSynonym(String(entityId), newSynonymValue.trim(), synonymsList);
      if (res?.success) {
        toast.success('Synonym set added');
        setNewSynonymValue('');
        setNewSynonymList('');
        // Refresh synonyms
        const entityRes = await getEntity(String(entityId));
        if (entityRes?.success && entityRes.data) {
          setExpandedSynonyms((entityRes.data as Entity).synonyms || []);
        }
        load();
      } else {
        toast.error(res?.error || 'Failed to add synonym');
      }
    } catch { toast.error('Failed to add synonym'); }
  };

  const handleDeleteSynonym = async (synonymId: number, entityId: number) => {
    try {
      const res = await deleteSynonym(String(synonymId));
      if (res?.success) {
        toast.success('Synonym removed');
        setExpandedSynonyms(prev => prev.filter(s => s.id !== synonymId));
        load();
      } else {
        toast.error(res?.error || 'Failed to remove');
      }
    } catch { toast.error('Failed to remove'); }
  };

  const filtered = entities.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const synonymsCount = (e: Entity) => e._count?.synonyms ?? e.synonyms?.length ?? 0;

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      regex: 'bg-orange-500/15 text-orange-400',
      list: 'bg-blue-500/15 text-blue-400',
      system: 'bg-purple-500/15 text-purple-400',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs ${colors[type] || 'bg-white/10 text-white/60'}`}>{type}</span>;
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers size={24} /> Entities</h1>
          <p className="text-sm text-white/50 mt-1">Manage named entities for intent extraction</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Entity
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entities..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-3 font-medium text-white/60 w-8"></th>
              <th className="text-left p-3 font-medium text-white/60">Name</th>
              <th className="text-left p-3 font-medium text-white/60">Display Name</th>
              <th className="text-left p-3 font-medium text-white/60">Type</th>
              <th className="text-left p-3 font-medium text-white/60">Pattern</th>
              <th className="text-left p-3 font-medium text-white/60">Synonyms</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">No entities found</td></tr>
            ) : filtered.map(e => (
              <React.Fragment key={e.id}>
                <tr className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="p-3">
                    <button onClick={() => toggleExpand(e)} className="p-1 hover:bg-white/10 rounded">
                      {expandedId === e.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </td>
                  <td className="p-3 font-mono text-xs">{e.name}</td>
                  <td className="p-3 font-medium">{e.displayName}</td>
                  <td className="p-3">{typeBadge(e.type)}</td>
                  <td className="p-3 text-white/50 font-mono text-xs truncate max-w-[200px]">{e.pattern || '-'}</td>
                  <td className="p-3"><span className="flex items-center gap-1 text-white/60"><Hash size={12} /> {synonymsCount(e)}</span></td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleDelete(e.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Trash2 size={14} className="text-red-400" /></button>
                    </div>
                  </td>
                </tr>
                {expandedId === e.id && (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={7} className="p-4">
                      <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Synonym Sets (value → synonyms)</p>
                      <div className="space-y-2">
                        {expandedSynonyms.length === 0 ? (
                          <p className="text-xs text-white/30">No synonym sets yet</p>
                        ) : expandedSynonyms.map(s => (
                          <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                            <span className="font-medium text-xs text-blue-400 min-w-[80px]">{s.value}</span>
                            <span className="text-white/30 text-xs">→</span>
                            <div className="flex flex-wrap gap-1 flex-1">
                              {s.synonyms.map((syn, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white/70">{syn}</span>
                              ))}
                              {s.synonyms.length === 0 && (
                                <span className="text-[10px] text-white/30">no synonyms</span>
                              )}
                            </div>
                            <button onClick={() => handleDeleteSynonym(s.id, e.id)} className="p-1 text-red-400 hover:text-red-300">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={newSynonymValue}
                            onChange={ev => setNewSynonymValue(ev.target.value)}
                            placeholder="Value (e.g. cricket)"
                            className="w-40 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
                          />
                          <input
                            value={newSynonymList}
                            onChange={ev => setNewSynonymList(ev.target.value)}
                            onKeyDown={ev => ev.key === 'Enter' && handleAddSynonym(e.id)}
                            placeholder="Synonyms (comma-separated)"
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
                          />
                          <button onClick={() => handleAddSynonym(e.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">Add</button>
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

      {/* Create Entity Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Create Entity</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name (code identifier)</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. sport_name" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Display Name</label>
                <input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. Sport Name" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  {TYPES.map(t => <option key={t} value={t} className="bg-[#161921]">{t}</option>)}
                </select>
              </div>
              {form.type === 'regex' && (
                <div>
                  <label className="block text-xs text-white/50 mb-1">Pattern (regex)</label>
                  <input value={form.pattern} onChange={e => setForm({ ...form, pattern: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" placeholder="e.g. \\d{6}" />
                </div>
              )}
              <div>
                <label className="block text-xs text-white/50 mb-1">Values (JSON, optional)</label>
                <textarea
                  value={form.values}
                  onChange={e => setForm({ ...form, values: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30"
                  placeholder={'[\n  "cricket",\n  "football",\n  "tennis"\n]'}
                />
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
