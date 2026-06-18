"use client";

import React, { useEffect, useState } from 'react';
import {
  getKBCategories,
  getKBArticles,
  createKBCategory,
  createKBArticle,
  updateKBArticle,
  deleteKBArticle,
  deleteKBCategory,
} from '@/actions/chatbot';
import {
  FolderTree, FileText, Plus, Search, Pencil, Trash2, X,
  ChevronRight, Tag, Eye, EyeOff, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  _count?: { articles: number };
}

interface Article {
  id: number;
  title: string;
  content: string;
  categoryId: number | null;
  tags: string[];
  priority: number;
  isPublished: boolean;
  category?: Category | null;
}

export default function KnowledgeBasePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [catForm, setCatForm] = useState({ name: '', slug: '', description: '', parentId: '' });
  const [articleForm, setArticleForm] = useState({
    title: '', content: '', categoryId: '', tags: '', priority: 0, isPublished: true,
  });

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadArticles(); }, [selectedCat, search]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [catsRes, artsRes] = await Promise.all([
        getKBCategories(),
        getKBArticles(undefined, undefined),
      ]);
      if (catsRes?.success && Array.isArray(catsRes.data)) setCategories(catsRes.data as Category[]);
      if (artsRes?.success && Array.isArray(artsRes.data)) {
        setArticles(artsRes.data as Article[]);
        setTotalArticles(artsRes.total || artsRes.data.length);
      }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const loadArticles = async () => {
    try {
      const catId = selectedCat ? String(selectedCat) : undefined;
      const searchTerm = search || undefined;
      const res = await getKBArticles(catId, searchTerm);
      if (res?.success && Array.isArray(res.data)) {
        setArticles(res.data as Article[]);
        setTotalArticles(res.total || res.data.length);
      }
    } catch { /* silent */ }
  };

  const handleCreateCategory = async () => {
    if (!catForm.name) return toast.error('Name required');
    try {
      const payload: any = {
        name: catForm.name,
        slug: catForm.slug || catForm.name.toLowerCase().replace(/\s+/g, '-'),
        description: catForm.description || null,
      };
      if (catForm.parentId) payload.parentId = Number(catForm.parentId);
      const res = await createKBCategory(payload);
      if (res?.success) {
        toast.success('Category created');
        setShowCatModal(false);
        setCatForm({ name: '', slug: '', description: '', parentId: '' });
        loadAll();
      } else {
        toast.error(res?.error || 'Failed to create category');
      }
    } catch { toast.error('Failed to create category'); }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Delete this category? Articles in it will become uncategorized.')) return;
    try {
      const res = await deleteKBCategory(String(id));
      if (res?.success) {
        toast.success('Category deleted');
        if (selectedCat === id) setSelectedCat(null);
        loadAll();
      } else toast.error(res?.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const openArticleCreate = () => {
    setEditArticle(null);
    setArticleForm({
      title: '', content: '', categoryId: selectedCat ? String(selectedCat) : '', tags: '', priority: 0, isPublished: true,
    });
    setShowArticleModal(true);
  };

  const openArticleEdit = (a: Article) => {
    setEditArticle(a);
    setArticleForm({
      title: a.title,
      content: a.content,
      categoryId: a.categoryId ? String(a.categoryId) : '',
      tags: a.tags.join(', '),
      priority: a.priority,
      isPublished: a.isPublished,
    });
    setShowArticleModal(true);
  };

  const handleSaveArticle = async () => {
    if (!articleForm.title) return toast.error('Title required');
    const payload: any = {
      title: articleForm.title,
      content: articleForm.content,
      categoryId: articleForm.categoryId ? Number(articleForm.categoryId) : null,
      tags: articleForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      priority: articleForm.priority,
      isPublished: articleForm.isPublished,
    };
    try {
      if (editArticle) {
        const res = await updateKBArticle(String(editArticle.id), payload);
        if (res?.success) toast.success('Article updated');
        else toast.error(res?.error || 'Failed to update');
      } else {
        const res = await createKBArticle(payload);
        if (res?.success) toast.success('Article created');
        else toast.error(res?.error || 'Failed to create');
      }
      setShowArticleModal(false);
      loadAll();
    } catch { toast.error('Failed to save article'); }
  };

  const handleDeleteArticle = async (id: number) => {
    if (!confirm('Delete this article?')) return;
    try {
      const res = await deleteKBArticle(String(id));
      if (res?.success) { toast.success('Article deleted'); loadAll(); }
      else toast.error(res?.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FolderTree size={24} /> Knowledge Base</h1>
          <p className="text-sm text-white/50 mt-1">Manage categories and articles for the chatbot</p>
        </div>
        <button onClick={loadAll} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        {/* Left Sidebar: Categories (250px) */}
        <div className="w-[250px] flex-shrink-0 border border-white/10 rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <span className="text-sm font-medium">Categories</span>
            <button onClick={() => setShowCatModal(true)} className="p-1 hover:bg-white/10 rounded-lg transition" title="Add Category">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => setSelectedCat(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${!selectedCat ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-white/70'}`}
            >
              All Articles ({totalArticles})
            </button>
            {categories.map(c => (
              <div key={c.id} className="flex items-center group">
                <button
                  onClick={() => setSelectedCat(c.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${selectedCat === c.id ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-white/70'}`}
                >
                  <ChevronRight size={12} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c._count && <span className="text-[10px] text-white/30">{c._count.articles}</span>}
                </button>
                <button onClick={() => handleDeleteCategory(c.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition">
                  <Trash2 size={12} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Articles */}
        <div className="flex-1 flex flex-col">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
            </div>
            <button onClick={openArticleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition whitespace-nowrap">
              <Plus size={16} /> New Article
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <p className="text-center text-white/30 py-12">Loading...</p>
            ) : articles.length === 0 ? (
              <p className="text-center text-white/30 py-12">No articles found</p>
            ) : articles.map(a => (
              <div key={a.id} className="border border-white/10 rounded-xl p-4 bg-white/5 hover:bg-white/[0.07] transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={14} className="text-white/40" />
                      <h3 className="font-medium">{a.title}</h3>
                      {a.isPublished ? (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400"><Eye size={10} /> Published</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400"><EyeOff size={10} /> Draft</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] text-white/40 uppercase">Priority: {a.priority}</span>
                      {a.tags.map(t => (
                        <span key={t} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                          <Tag size={8} /> {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={() => openArticleEdit(a)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Pencil size={14} className="text-blue-400" /></button>
                    <button onClick={() => handleDeleteArticle(a.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Add Category</h2>
              <button onClick={() => setShowCatModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Slug</label>
                <input value={catForm.slug} onChange={e => setCatForm({ ...catForm, slug: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-white/30" placeholder="auto-generated if empty" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Description (optional)</label>
                <textarea value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Parent Category (optional)</label>
                <select value={catForm.parentId} onChange={e => setCatForm({ ...catForm, parentId: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  <option value="" className="bg-[#161921]">None (top-level)</option>
                  {categories.map(c => <option key={c.id} value={String(c.id)} className="bg-[#161921]">{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCatModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleCreateCategory} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Article Modal */}
      {showArticleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161921] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editArticle ? 'Edit Article' : 'Create Article'}</h2>
              <button onClick={() => setShowArticleModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Title</label>
                <input value={articleForm.title} onChange={e => setArticleForm({ ...articleForm, title: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Content</label>
                <textarea value={articleForm.content} onChange={e => setArticleForm({ ...articleForm, content: e.target.value })} rows={6} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Category</label>
                <select value={articleForm.categoryId} onChange={e => setArticleForm({ ...articleForm, categoryId: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30">
                  <option value="" className="bg-[#161921]">Select category</option>
                  {categories.map(c => <option key={c.id} value={String(c.id)} className="bg-[#161921]">{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Tags (comma separated)</label>
                <input value={articleForm.tags} onChange={e => setArticleForm({ ...articleForm, tags: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" placeholder="tag1, tag2, tag3" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Priority</label>
                  <input type="number" value={articleForm.priority} onChange={e => setArticleForm({ ...articleForm, priority: Number(e.target.value) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={articleForm.isPublished} onChange={e => setArticleForm({ ...articleForm, isPublished: e.target.checked })} className="accent-blue-500" />
                    Published
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowArticleModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition">Cancel</button>
              <button onClick={handleSaveArticle} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">{editArticle ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
