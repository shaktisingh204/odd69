"use client";

import React, { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { login } from "@/actions/auth";

export default function AdminLogin() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [state, formAction, isPending] = useActionState(login, null);

  useEffect(() => {
    if (state?.success) {
      // Store user info for client-side use
      if (state.user) {
        localStorage.setItem("user", JSON.stringify(state.user));
      }
      setTimeout(() => router.push("/dashboard"), 800);
    }
  }, [state, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Lock className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-indigo-100 mt-2">Sign in to manage the platform</p>
        </div>

        <div className="p-8">
          <form action={formAction} className="space-y-6">
            {state?.error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                {state.error}
              </div>
            )}
            {state?.success && (
              <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm border border-green-100">
                Login Successful! Redirecting...
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">
                Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="email"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Authorized personnel only. <br /> Access is monitored and logged.
          </div>
          <div className="mt-3 text-center">
            <a href="/forgot-password" className="text-sm text-indigo-600 hover:underline font-medium">
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
