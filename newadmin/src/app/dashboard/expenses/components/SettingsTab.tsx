"use client";

import React, { useEffect, useState } from 'react';
import { getExpenseCategories, upsertExpenseCategory, deleteExpenseCategory, deployExpenseTemplates } from '@/actions/expenses';
import { Loader2, Plus, Settings, Trash2, Edit2, CheckCircle, GripVertical, Database } from 'lucide-react';

export default function SettingsTab() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingCat, setEditingCat] = useState<any | null>(null);

    const fetchData = async () => {
        setLoading(true);
        const data = await getExpenseCategories();
        setCategories(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateNew = () => {
        const slug = prompt('Enter a unique ID/slug for the category (e.g. SERVER_COSTS)');
        if (!slug) return;
        const name = prompt('Enter Category Display Name');
        if (!name) return;

        setEditingCat({
            slug: slug.toUpperCase().replace(/\s+/g, '_'),
            name,
            customFields: []
        });
    };

    const handleEdit = (cat: any) => {
        setEditingCat(JSON.parse(JSON.stringify(cat))); // Deep copy
    };

    const handleSave = async () => {
        if (!editingCat) return;
        await upsertExpenseCategory(editingCat);
        setEditingCat(null);
        fetchData();
    };

    const handleDelete = async (slug: string) => {
        if (confirm('Are you sure? This does not delete existing expenses out of this category, but stops new ones.')) {
            await deleteExpenseCategory(slug);
            fetchData();
        }
    };

    const handleDeployTemplates = async () => {
        if (!confirm('This will initialize pre-configured operational categories like Bank Account Purchases and Ad Spends. Continue?')) return;
        setLoading(true);
        await deployExpenseTemplates();
        fetchData();
    };

    const addField = () => {
        setEditingCat({
            ...editingCat,
            customFields: [
                ...editingCat.customFields,
                { name: `field_${Date.now()}`, label: 'New Field', type: 'TEXT', options: [], required: false }
            ]
        });
    };

    const updateField = (idx: number, key: string, value: any) => {
        const fields = [...editingCat.customFields];
        fields[idx] = { ...fields[idx], [key]: value };
        setEditingCat({ ...editingCat, customFields: fields });
    };

    const removeField = (idx: number) => {
        const fields = [...editingCat.customFields];
        fields.splice(idx, 1);
        setEditingCat({ ...editingCat, customFields: fields });
    };

    if (loading) return <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></div>;

    if (editingCat) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div>
                        <h3 className="text-xl font-bold text-white">Edit Category Schematic</h3>
                        <p className="text-slate-400 text-sm">Define required custom properties for <span className="text-violet-400 font-bold">{editingCat.name}</span></p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setEditingCat(null)} className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 text-sm">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 text-sm"><CheckCircle size={14}/> Save Schema</button>
                    </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
                    <div className="flex gap-4 mb-8">
                        <div className="flex-1">
                            <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Display Name</label>
                            <input type="text" value={editingCat.name} onChange={e => setEditingCat({...editingCat, name: e.target.value})} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white" />
                        </div>
                        <div className="flex-1 opacity-50 pointer-events-none">
                            <label className="block text-xs uppercase font-bold text-slate-400 mb-1">System Slug (Locked)</label>
                            <input type="text" value={editingCat.slug} readOnly className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 w-full text-white font-mono" />
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-white text-sm">Custom Extractor Fields</h4>
                        <button onClick={addField} className="text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1"><Plus size={14}/> Add Field Requirement</button>
                    </div>

                    {editingCat.customFields.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm">No custom fields defined. Base expense fields (Title, Amount, Vendor, Date) are always present.</div>
                    ) : (
                        <div className="space-y-3">
                            {editingCat.customFields.map((field: any, idx: number) => (
                                <div key={idx} className="flex gap-3 items-center bg-slate-900 border border-slate-700 p-3 rounded-lg group">
                                    <GripVertical size={16} className="text-slate-600 cursor-move" />
                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Field Label</label>
                                            <input type="text" value={field.label} onChange={e => updateField(idx, 'label', e.target.value)} className="w-full bg-slate-800 rounded px-2 py-1.5 text-xs text-white border border-slate-700 focus:border-violet-500 outline-none" placeholder="e.g. Campaign ID" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">System Key</label>
                                            <input type="text" value={field.name} onChange={e => updateField(idx, 'name', e.target.value)} className="w-full bg-slate-800 rounded px-2 py-1.5 text-xs text-white border border-slate-700 focus:border-violet-500 outline-none font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Input Type</label>
                                            <select value={field.type} onChange={e => updateField(idx, 'type', e.target.value)} className="w-full bg-slate-800 rounded px-2 py-1.5 text-xs text-white border border-slate-700 focus:border-violet-500 outline-none">
                                                <option value="TEXT">Text</option>
                                                <option value="NUMBER">Number</option>
                                                <option value="DATE">Date</option>
                                                <option value="SELECT">Dropdown List</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 mt-4">
                                            <input type="checkbox" checked={field.required} onChange={e => updateField(idx, 'required', e.target.checked)} className="rounded border-slate-700" />
                                            <span className="text-xs text-slate-300">Required</span>
                                        </div>
                                    </div>
                                    
                                    {field.type === 'SELECT' && (
                                        <div className="w-48 ml-2">
                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Options (comma separated)</label>
                                            <input type="text" value={(field.options || []).join(', ')} onChange={e => updateField(idx, 'options', e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean))} className="w-full bg-slate-800 rounded px-2 py-1.5 text-xs text-white border border-slate-700 focus:border-violet-500 outline-none" placeholder="Opt1, Opt2..." />
                                        </div>
                                    )}

                                    <button onClick={() => removeField(idx)} className="p-2 text-slate-600 hover:text-red-400 bg-slate-800 rounded hover:bg-slate-700 ml-2">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <p className="text-slate-400">Manage dynamically mapped expense categories and their custom data structures.</p>
                <div className="flex items-center gap-2">
                    <button onClick={handleDeployTemplates} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                        <Database size={16}/> Deploy Core Templates
                    </button>
                    <button onClick={handleCreateNew} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                        <Plus size={16}/> New Category
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => (
                    <div key={cat.slug} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-white text-lg">{cat.name}</h4>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">{cat.slug}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleEdit(cat)} className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-colors"><Edit2 size={16}/></button>
                                <button onClick={() => handleDelete(cat.slug)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                            <Settings size={14}/> {cat.customFields?.length || 0} Extra Variables Configured
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
