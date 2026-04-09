"use client";

import { useState, useTransition } from "react";
import { Shield, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { loginAdminAction } from "../actions";

export default function AdminLoginClient() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username dan password wajib diisi.");
      return;
    }

    startTransition(async () => {
      const result = await loginAdminAction(username, password);
      if (result?.error) {
        setError(result.error);
      } else {
        window.location.href = "/admin";
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-900/50">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Admin Portal</h1>
          <p className="text-slate-400 text-[13px] mt-1">Support &amp; Incident Management System</p>
        </div>

        {/* Login card */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-[15px] font-bold text-slate-200 mb-6">Sign in to continue</h2>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 bg-red-900/30 border border-red-700/50 rounded-lg px-3.5 py-3 text-[13px] text-red-300">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="admin"
                disabled={isPending}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-[14px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-[14px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold text-[14px] rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                "Masuk ke Admin Panel"
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] text-slate-600 text-center">
              Akses terbatas — hanya untuk administrator sistem.
              <br />
              Hubungi IT Admin jika lupa password.
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-5">
          <a href="/dashboard" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors">
            ← Kembali ke Portal Publik
          </a>
        </div>
      </div>
    </div>
  );
}