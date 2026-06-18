"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  simulateMessage,
  testIntentMatch,
} from '@/actions/chatbot';
import {
  FlaskConical, Send, RotateCcw, Bug, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: number;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface DebugInfo {
  intentName?: string;
  confidence?: number;
  entities?: any[];
  ruleMatched?: string;
  responseTemplate?: string;
  raw?: any;
}

export default function TestingPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  let msgCounter = useRef(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: ++msgCounter.current,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const [simRes, intentRes] = await Promise.all([
        simulateMessage(text),
        testIntentMatch(text),
      ]);

      let botContent = 'No response generated.';
      if (simRes.success && simRes.data) {
        botContent = simRes.data.response || simRes.data.message || JSON.stringify(simRes.data);
      } else if (simRes.error) {
        botContent = `Error: ${simRes.error}`;
      }

      const botMsg: ChatMessage = {
        id: ++msgCounter.current,
        role: 'bot',
        content: botContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);

      const debug: DebugInfo = {};
      if (intentRes.success && intentRes.data) {
        debug.intentName = intentRes.data.intent?.name || intentRes.data.intentName;
        debug.confidence = intentRes.data.confidence ?? intentRes.data.score;
        debug.entities = intentRes.data.entities;
        debug.ruleMatched = intentRes.data.ruleMatched || intentRes.data.rule;
        debug.responseTemplate = intentRes.data.responseTemplate || intentRes.data.template;
        debug.raw = intentRes.data;
      }
      if (simRes.success && simRes.data) {
        debug.responseTemplate = debug.responseTemplate || simRes.data.templateUsed;
        debug.ruleMatched = debug.ruleMatched || simRes.data.ruleMatched;
      }
      setDebugInfo(debug);
    } catch {
      toast.error('Failed to send message');
      const errMsg: ChatMessage = {
        id: ++msgCounter.current,
        role: 'bot',
        content: 'Failed to get a response. Check backend connection.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setDebugInfo({});
    setInput('');
    msgCounter.current = 0;
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FlaskConical size={24} /> Testing Console</h1>
          <p className="text-sm text-white/50 mt-1">Simulate conversations and debug bot responses</p>
        </div>
        <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-sm transition">
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* Chat Area - 60% */}
        <div className="w-[60%] flex flex-col border border-white/10 rounded-xl overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center h-full text-white/20 text-sm">
                Send a message to start testing the chatbot
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white/10 text-white/90 rounded-bl-md'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-white/30'}`}>
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-4 py-2.5 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg transition"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Debug Panel - 40% */}
        <div className="w-[40%] border border-white/10 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-2">
            <Bug size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold">Debug Info</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {Object.keys(debugInfo).length === 0 ? (
              <p className="text-sm text-white/20">Send a message to see debug information</p>
            ) : (
              <>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Matched Intent</p>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-blue-400" />
                      <span className="text-sm font-medium">{debugInfo.intentName || 'None'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Confidence Score</p>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (debugInfo.confidence ?? 0) > 0.7 ? 'bg-emerald-500' :
                            (debugInfo.confidence ?? 0) > 0.4 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${((debugInfo.confidence ?? 0) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono">
                        {debugInfo.confidence != null ? `${(debugInfo.confidence * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Entities Extracted</p>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    {debugInfo.entities && debugInfo.entities.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {debugInfo.entities.map((e: any, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded-full text-xs">
                            {typeof e === 'string' ? e : `${e.name || e.type}: ${e.value}`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-white/30">None</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Rule Matched</p>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    <span className="text-sm text-white/70">{debugInfo.ruleMatched || 'None'}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Response Template</p>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    <span className="text-sm text-white/70">{debugInfo.responseTemplate || 'None'}</span>
                  </div>
                </div>

                {debugInfo.raw && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Raw Response</p>
                    <pre className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white/50 overflow-x-auto max-h-[200px] overflow-y-auto">
                      {JSON.stringify(debugInfo.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
