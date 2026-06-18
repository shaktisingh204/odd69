"use client";

import React, { useEffect, useState } from 'react';
import {
  getABTests,
  createABTest,
  updateABTest,
  startABTest,
  stopABTest,
} from '@/actions/chatbot';
import {
  FlaskRound, Plus, Pencil, X, Search, RefreshCw, Play, Square,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ABTest {
  id: number;
  name: string;
  description?: string;
  variants: any;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

const statusBadge: Record<string, string> = {
  draft: 'bg-gray-500/15 text-gray-400',
  DRAFT: 'bg-gray-500/15 text-gray-400',
  running: 'bg-emerald-500/15 text-emerald-400',
  RUNNING: 'bg-emerald-500/15 text-emerald-400',
  completed: 'bg-blue-500/15 text-blue-400',
  COMPLETED: 'bg-blue-500/15 text-blue-400',
};

export default function ABTestsPage() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    variants: '',
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getABTests();
      if (res.success) setTests((res.data || []) as any);
      else toast.error(res.error || 'Failed to load A/B tests');
    } catch { toast.error('Failed to load A/B tests'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({
      name: '',
      description: '',
      variants: JSON.stringify([
        { id: 'variant_a', responseTemplateId: '', weight: 50 },
        { id: 'variant_b', responseTemplateId: '', weight: 50 },
      ], null, 2),
    });
    setShowModal(true);
  };

  const openEdit = (t: ABTest) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      description: t.description || '',
      variants: t.variants ? JSON.stringify(t.variants, null, 2) : '[]',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');

    let variants: any;
    try { variants = JSON.parse(form.variants || '[]'); }
    catch { return toast.error('Invalid Variants JSON'); }

    const payload = {
      name: form.name,
      description: form.description || undefined,
      variants,
    };

    try {
      if (editId !== null) {
        const res = await updateABTest(String(editId), payload);
        if (res.success) toast.success('A/B test updated');
        else toast.error(res.error || 'Failed to update');
      } else {
        const res = await createABTest(payload);
        if (res.success) toast.success('A/B test created');
        else toast.error(res.error || 'Failed to create');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleStart = async (id: number) => {
    if (!confirm('Start this A/B test?')) return;
    try {
      const res = await startABTest(String(id));
      if (res.success) { toast.success('A/B test started'); load(); }
      else toast.error(res.error || 'Failed to start');
    } catch { toast.error('Failed to start'); }
  };

  const handleStop = async (id: number) => {
    if (!confirm('Stop this A/B test?')) return;
    try {
      const res = await stopABTest(String(id));
      if (res.success) { toast.success('A/B test stopped'); load(); }
      else toast.error(res.error || 'Failed to stop');
    } catch { toast.error('Failed to stop'); }
  };

  const getVariantCount = (variants: any): number => {
    if (Array.isArray(variants)) return variants.length;
    return 0;
  };

  const formatDate = (d?: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString();
  };

  const filtered = tests.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
    t.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FlaskRound size={24} /> A/B Tests</h1>
          <p className="text-sm text-white/50 mt-1">Manage response variant experiments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create A/B Test
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search A/B tests..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
      </div>

      <div className="border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left p-3 font-medium text-white/60">Name</th>
              <th className="text-left p-3 font-medium text-white/60">Description</th>
              <th className="text-left p-3 font-medium text-white/60">Status</th>
              <th className="text-left p-3 font-medium text-white/60">Variants</th>
              <th className="text-left p-3 font-medium text-white/60">Start Date</th>
              <th className="text-left p-3 font-medium text-white/60">End Date</th>
              <th className="text-right p-3 font-medium text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-white/30">No A/B tests found</td></tr>
            ) : filtered.map(t => {
              const status = t.status.toLowerCase();
              return (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3 text-white/60 max-w-[200px] truncate">{t.description || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${statusBadge[t.status] || 'bg-gray-500/15 text-gray-400'}`}>
                      {status}
                    </span>
                  </td>
                  <td className="p-3 text-white/60">{getVariantCount(t.variants)}</td>
                  <td className="p-3 text-white/60 text-xs">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(t.startDate)}</span>
                  </td>
                  <td className="p-3 text-white/60 text-xs">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(t.endDate)}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(status === 'draft') && (
                        <button onClick={() => handleStart(t.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Start">
                          <Play size={14} className="text-emerald-400" />
                        </button>
                      )}
                      {(status === 'running') && (
                        <button onClick={() => handleStop(t.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Stop">
                          <Square size={14} className="text-red-400" />
                        </button>
                      )}
                      {(status === 'draft') && (
                        <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Edit">
                          <Pencil size={14} className="text-blue-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editId !== null ? 'Edit A/B Test' : 'Create A/B Test'}</h2>
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
                <label className="block text-xs text-white/50 mb-1">Variants (JSON Array)</label>
                <textarea
                  value={form.variants}
                  onChange={e => setForm({ ...form, variants: e.target.value })}
                  rows={8}
                  placeholder='[{"id": "variant_a", "responseTemplateId": "...", "weight": 50}]'
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30"
                />
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
