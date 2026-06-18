"use client";

import React, { useState, useActionState, useEffect } from "react";
import { updateProfile } from "@/actions/profile";
import { User, Lock, Loader2, Save } from "lucide-react";

export default function AdminProfilePage() {
    const [state, formAction, isPending] = useActionState(updateProfile, null);
    const [userContext, setUserContext] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
                try {
                    setUserContext(JSON.parse(storedUser));
                } catch (e) {}
            }
        }
    }, []);

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold text-white">My Profile</h1>
                <p className="text-slate-400 mt-1">Manage your admin login credentials.</p>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <form action={formAction} className="space-y-6">
                    {state?.error && (
                        <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-500 border border-red-500/20">
                            {state.error}
                        </div>
                    )}
                    {state?.success && (
                        <div className="p-3 rounded-lg text-sm bg-green-500/10 text-green-500 border border-green-500/20">
                            {state.message}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Email Address (Login ID)
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="email"
                                    name="email"
                                    defaultValue={userContext?.email || ""}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="admin@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="password"
                                    name="password"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Leave blank to keep current password"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Confirm your new password"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
