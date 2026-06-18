"use client";

import React, { useEffect, useState, useRef } from 'react';
import {
  getConversations,
  getConversation,
  takeoverConversation,
  closeConversation,
} from '@/actions/chatbot';
import {
  MessageSquare, ArrowLeft, Search, RefreshCw,
  User, Bot, Shield, X, Tag, XCircle, Clock,
  UserCheck, UserX, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Conversation {
  _id: string;
  sessionId: string;
  userId: string;
  username: string;
  status: 'active' | 'escalated' | 'resolved' | 'closed';
  channel: string;
  lastMessage: string;
  lastMessageAt: string;
  tags: string[];
  assignedTo?: string;
  messages: Message[];
}

interface Message {
  _id: string;
  sender: 'user' | 'bot' | 'admin' | 'system';
  content: string;
  timestamp: string;
}

const STATUS_FILTERS = ['all', 'active', 'escalated', 'resolved', 'closed'] as const;

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConvo?.messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const result = await getConversations();
      setConversations(result?.success ? result.data || [] : []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const selectConversation = async (c: Conversation) => {
    try {
      setDetailLoading(true);
      const result = await getConversation(c._id);
      setSelectedConvo(result?.success ? result.data || c : c);
    } catch {
      toast.error('Failed to load conversation');
      setSelectedConvo(c);
    }
    finally { setDetailLoading(false); }
  };

  const handleTakeover = async () => {
    if (!selectedConvo) return;
    try {
      await takeoverConversation(selectedConvo._id);
      toast.success('Conversation taken over');
      setSelectedConvo({ ...selectedConvo, status: 'active', assignedTo: 'admin' });
      loadConversations();
    } catch { toast.error('Failed to take over'); }
  };

  const handleRelease = async () => {
    if (!selectedConvo) return;
    try {
      toast.success('Released back to bot');
      setSelectedConvo({ ...selectedConvo, assignedTo: undefined });
      loadConversations();
    } catch { toast.error('Failed to release'); }
  };

  const handleClose = async () => {
    if (!selectedConvo) return;
    if (!confirm('Close this conversation?')) return;
    try {
      await closeConversation(selectedConvo._id);
      toast.success('Conversation closed');
      setSelectedConvo(null);
      loadConversations();
    } catch { toast.error('Failed to close'); }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-500/15 text-emerald-400',
      escalated: 'bg-orange-500/15 text-orange-400',
      resolved: 'bg-blue-500/15 text-blue-400',
      closed: 'bg-white/10 text-white/40',
    };
    return map[s] || 'bg-white/10 text-white/40';
  };

  const msgBubbleColor = (sender: string) => {
    const map: Record<string, string> = {
      bot: 'bg-blue-600/20 border border-blue-500/20',
      user: 'bg-white/10',
      admin: 'bg-emerald-600/20 border border-emerald-500/20',
      system: 'bg-gray-600/20 border border-gray-500/20',
    };
    return map[sender] || 'bg-white/10';
  };

  const msgIcon = (sender: string) => {
    const map: Record<string, React.ReactNode> = {
      user: <User size={10} />,
      bot: <Bot size={10} />,
      admin: <Shield size={10} />,
      system: <Info size={10} />,
    };
    return map[sender] || <User size={10} />;
  };

  const filtered = conversations.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = !search ||
      c.username?.toLowerCase().includes(search.toLowerCase()) ||
      c.sessionId?.toLowerCase().includes(search.toLowerCase()) ||
      c.userId?.includes(search);
    return matchStatus && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare size={24} /> Conversations</h1>
          <p className="text-sm text-white/50 mt-1">View and manage chatbot conversations</p>
        </div>
        <button onClick={loadConversations} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        {/* Left Panel: Conversation List (350px) */}
        <div className={`${selectedConvo ? 'hidden lg:flex' : 'flex'} w-full lg:w-[350px] flex-shrink-0 flex-col border border-white/10 rounded-xl overflow-hidden`}>
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by session, user..." className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs focus:outline-none focus:border-white/30" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40 hover:text-white/60'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-center text-white/30 py-8 text-sm">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-white/30 py-8 text-sm">No conversations</p>
            ) : filtered.map(c => (
              <button
                key={c._id}
                onClick={() => selectConversation(c)}
                className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition ${selectedConvo?._id === c._id ? 'bg-white/5' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">{c.username || c.userId}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${statusColor(c.status)}`}>{c.status}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-white/30 font-mono truncate">{c.sessionId}</span>
                  {c.channel && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">{c.channel}</span>}
                </div>
                <p className="text-xs text-white/40 truncate">{c.lastMessage || 'No messages'}</p>
                <p className="text-[10px] text-white/20 mt-1">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : ''}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: Chat Transcript */}
        <div className={`${selectedConvo ? 'flex' : 'hidden lg:flex'} flex-1 flex-col border border-white/10 rounded-xl overflow-hidden`}>
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-white/20">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                <p>Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedConvo(null)} className="lg:hidden p-1 hover:bg-white/10 rounded"><ArrowLeft size={16} /></button>
                  <div>
                    <p className="font-medium text-sm">{selectedConvo.username || selectedConvo.userId}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColor(selectedConvo.status)}`}>{selectedConvo.status}</span>
                      {selectedConvo.channel && <span className="text-[10px] text-white/40">{selectedConvo.channel}</span>}
                      <span className="text-[10px] text-white/30 font-mono">{selectedConvo.sessionId}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!selectedConvo.assignedTo ? (
                    <button onClick={handleTakeover} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs transition">
                      <UserCheck size={12} /> Takeover
                    </button>
                  ) : (
                    <button onClick={handleRelease} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs transition">
                      <UserX size={12} /> Release
                    </button>
                  )}
                  <button onClick={handleClose} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs transition">
                    <XCircle size={12} /> Close
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {detailLoading ? (
                  <p className="text-center text-white/30 text-sm">Loading messages...</p>
                ) : (!selectedConvo.messages || selectedConvo.messages.length === 0) ? (
                  <p className="text-center text-white/30 text-sm">No messages</p>
                ) : selectedConvo.messages.map(m => (
                  <div key={m._id} className={`flex ${m.sender === 'user' ? 'justify-start' : m.sender === 'system' ? 'justify-center' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${msgBubbleColor(m.sender)}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {msgIcon(m.sender)}
                        <span className="text-[10px] text-white/40 capitalize">{m.sender}</span>
                        <span className="text-[10px] text-white/20">{new Date(m.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm">{m.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Tags Section */}
              <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag size={12} className="text-white/30" />
                  <span className="text-[10px] text-white/30 uppercase font-medium">Tags:</span>
                  {(selectedConvo.tags || []).length === 0 ? (
                    <span className="text-[10px] text-white/20">No tags</span>
                  ) : (selectedConvo.tags || []).map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/15 text-blue-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
