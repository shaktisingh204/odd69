"use client";

import React, { useEffect, useState } from 'react';
import { getHomeCategories, createHomeCategory, updateHomeCategory, deleteHomeCategory } from '@/actions/cms';
import { CreateHomeCategoryDto } from '../../../../services/cms.service';
import { Plus, Edit2, Trash2, X, Save, Image as ImageIcon, ToggleLeft, ToggleRight, LayoutGrid } from 'lucide-react';

export default function CategoriesPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any | null>(null);

    const [formData, setFormData] = useState<CreateHomeCategoryDto>({
        title: '',
        subtitle: '',
        description: '',
        image: '',
        link: '',
        isLarge: false,
        order: 0,
        isActive: true,
        style: {}
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await getHomeCategories();
            if (res.success && res.data) {
                setCategories(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch categories", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (category?: any) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                title: category.title,
                subtitle: category.subtitle || '',
                description: category.description || '',
                image: category.image || '',
                link: category.link,
                isLarge: category.isLarge,
                order: category.order || 0,
                isActive: category.isActive,
                style: category.style || {}
            });
        } else {
            setEditingCategory(null);
            setFormData({
                title: '',
                subtitle: '',
                description: '',
                image: '',
                link: '',
                isLarge: false,
                order: categories.length,
                isActive: true,
                style: {}
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            let res;
            if (editingCategory) {
                res = await updateHomeCategory(editingCategory.id, formData);
            } else {
                res = await createHomeCategory(formData);
            }
            if (res.success) {
                setIsModalOpen(false);
                fetchCategories();
            } else {
                alert("Failed to save");
            }
        } catch (error) {
            console.error("Failed to save category", error);
            alert("Failed to save. Check console.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this category?")) return;
        try {
            await deleteHomeCategory(id);
            fetchCategories();
        } catch (error) {
            console.error("Failed to delete category", error);
        }
    };

    const handleToggleActive = async (category: any) => {
        try {
            await updateHomeCategory(category.id, { isActive: !category.isActive });
            fetchCategories();
        } catch (error) {
            console.error("Failed to toggle status", error);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading categories...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Categories Management</h1>
                    <p className="text-slate-400 mt-1">Manage game categories displayed on the home page.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Plus size={20} /> Add New Category
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categories.map(category => (
                    <div key={category.id} className="group relative bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-full hover:border-slate-600 transition-colors">
                        <div className={`relative ${category.isLarge ? 'h-48' : 'h-32'} bg-slate-900 overflow-hidden`}>
                            {category.image ? (
                                <img src={category.image} alt={category.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <ImageIcon size={32} />
                                </div>
                            )}
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white">
                                {category.isLarge ? 'Large' : 'Grid'}
                            </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col">
                            <h3 className="text-lg font-bold text-white">{category.title}</h3>
                            {category.subtitle && <p className="text-sm text-slate-400 mt-1">{category.subtitle}</p>}

                            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                <span>Order: {category.order}</span>
                                <span className={`px-2 py-0.5 rounded-full ${category.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {category.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                                <button
                                    onClick={() => handleToggleActive(category)}
                                    className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${category.isActive ? 'text-emerald-400' : 'text-slate-500'}`}
                                    title={category.isActive ? 'Deactivate' : 'Activate'}
                                >
                                    {category.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleOpenModal(category)}
                                        className="p-1.5 rounded hover:bg-slate-700 text-blue-400 transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category.id)}
                                        className="p-1.5 rounded hover:bg-slate-700 text-red-400 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">{editingCategory ? 'Edit Category' : 'New Category'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Subtitle</label>
                                    <input
                                        type="text"
                                        value={formData.subtitle}
                                        onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Navigation Link</label>
                                <input
                                    type="text"
                                    value={formData.link}
                                    onChange={e => setFormData({ ...formData, link: e.target.value })}
                                    placeholder="/casino/slots"
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Image URL</label>
                                <input
                                    type="text"
                                    value={formData.image}
                                    onChange={e => setFormData({ ...formData, image: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Description (Optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-indigo-500 outline-none resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Order</label>
                                    <input
                                        type="number"
                                        value={formData.order}
                                        onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-3 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isLarge ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.isLarge}
                                                onChange={e => setFormData({ ...formData, isLarge: e.target.checked })}
                                                className="sr-only"
                                            />
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.isLarge ? 'left-6' : 'left-1'}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">Large Feature Card</span>
                                            <span className="text-[10px] text-slate-500">Enable for main section cards (e.g. Casino/Sports)</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isActive ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.isActive}
                                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                                className="sr-only"
                                            />
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.isActive ? 'left-6' : 'left-1'}`} />
                                        </div>
                                        <span className="text-sm font-medium">Active</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <Save size={18} /> Save Category
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
