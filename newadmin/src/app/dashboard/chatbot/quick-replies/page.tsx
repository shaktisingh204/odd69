"use client";

import React, { useEffect, useState } from 'react';
import {
  getQuickReplySets,
  createQuickReplySet,
  deleteQuickReplySet,
  addQuickReply,
  deleteQuickReply,
} from '@/actions/chatbot';
import {
  Send, Plus, Trash2, X, RefreshCw,
  ChevronDown, ChevronUp, MessageSquare, Hash, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface QuickReply {
  id: number;
  setId: number;
  label: string;
  content: string;
  sortOrder: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QuickReplySet {
  id: number;
  name: string;
  category?: string | null;
  shortcode?: string | null;
  replies?: QuickReply[];
  _count?: { replies: number };
  createdAt: string;
  updatedAt: string;
}

export default function QuickRepliesPage() {
  const [sets, setSets] = useState<QuickReplySet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showSetModal, setShowSetModal] = useState(false);
  const [setForm, setSetForm] = useState({ name: '', category: '', shortcode: '' });
  const [replyForm, setReplyForm] = useState({ label: '', content: '', sortOrder: 0 });
  const [addingToSetId, setAddingToSetId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const result = await getQuickReplySets();
      setSets((result?.success ? result.data || [] : []) as any);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreateSet = () => {
    setSetForm({ name: '', category: '', shortcode: '' });
    setShowSetModal(true);
  };

  const handleSaveSet = async () => {
    if (!setForm.name) return toast.error('Name required');
    try {
      await createQuickReplySet(setForm);
      toast.success('Set created');
      setShowSetModal(false);
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleDeleteSet = async (id: number) => {
    if (!confirm('Delete this set and all its replies?')) return;
    try { await deleteQuickReplySet(String(id)); toast.success('Set deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleAddReply = async (setId: number) => {
    if (!replyForm.label) return toast.error('Label required');
    try {
      await addQuickReply(String(setId), replyForm);
      toast.success('Reply added');
      setReplyForm({ label: '', content: '', sortOrder: 0 });
      setAddingToSetId(null);
      load();
    } catch { toast.error('Failed to add reply'); }
  };

  const handleDeleteReply = async (replyId: number) => {
    try {
      await deleteQuickReply(String(replyId));
      toast.success('Reply removed');
      load();
    } catch { toast.error('Failed to remove'); }
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Send size={24} /> Quick Replies</h1>
          <p className="text-sm text-white/50 mt-1">Manage quick reply sets and their options</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreateSet} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Create Set
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-white/30 py-12">Loading...</p>
      ) : sets.length === 0 ? (
        <p className="text-center text-white/30 py-12">No quick reply sets found</p>
      ) : (
        <div className="space-y-3">
          {sets.map(s => (
            <div key={s.id} className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
              {/* Collapsible Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedId === s.id ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
                  <div>
                    <h3 className="font-medium">{s.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      {s.category && (
                        <span className="flex items-center gap-1 text-xs text-white/40">
                          <Tag size={10} /> {s.category}
                        </span>
                      )}
                      {s.shortcode && (
                        <span className="flex items-center gap-1 text-xs text-white/40">
                          <Hash size={10} /> {s.shortcode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-white/40">
                    <MessageSquare size={12} /> {s._count?.replies ?? s.replies?.length ?? 0} replies
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteSet(s.id); }} className="p-1.5 hover:bg-white/10 rounded-lg transition">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>

              {/* Expanded Replies */}
              {expandedId === s.id && (
                <div className="border-t border-white/10 p-4 bg-white/[0.02]">
                  {(s.replies || []).length === 0 ? (
                    <p className="text-sm text-white/30 mb-3">No replies yet</p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {[...(s.replies || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((r, idx) => (
                        <div key={r.id || idx} className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-[10px] text-white/30 font-mono flex-shrink-0">#{r.sortOrder ?? idx}</span>
                            <div className="min-w-0">
                              <span className="text-sm font-medium">{r.label}</span>
                              {r.content && (
                                <p className="text-xs text-white/40 mt-0.5 truncate">{r.content.length > 80 ? r.content.slice(0, 80) + '...' : r.content}</p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => r.id && handleDeleteReply(r.id)} className="p-1 hover:bg-white/10 rounded transition flex-shrink-0 ml-2">
                            <Trash2 size={12} className="text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingToSetId === s.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input value={replyForm.label} onChange={e => setReplyForm({ ...replyForm, label: e.target.value })} placeholder="Label" className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
                        <input type="number" value={replyForm.sortOrder} onChange={e => setReplyForm({ ...replyForm, sortOrder: Number(e.target.value) })} placeholder="Sort Order" className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
                      </div>
                      <textarea
                        value={replyForm.content}
                        onChange={e => setReplyForm({ ...replyForm, content: e.target.value })}
                        placeholder="Content"
                        rows={3}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setAddingToSetId(null)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition">Cancel</button>
                        <button onClick={() => handleAddReply(s.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">Add</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingToSetId(s.id); setReplyForm({ label: '', content: '', sortOrder: (s.replies?.length || 0) }); }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 border-dashed rounded-lg text-sm text-white/50 hover:bg-white/10 hover:text-white/70 transition"
                    >
                      <Plus size={14} /> Add Reply
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Create Set</h2>
              <button onClick={() => setShowSetModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input value={setForm.name} onChange={e => setSetForm({ ...setForm, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Category</label>
                <input value={setForm.category} onChange={e => setSetForm({ ...setForm, category: e.target.value })} placeholder="e.g. support, sales" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Shortcode</label>
                <input value={setForm.shortcode} onChange={e => setSetForm({ ...setForm, shortcode: e.target.value })} placeholder="e.g. /greet" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowSetModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleSaveSet} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
