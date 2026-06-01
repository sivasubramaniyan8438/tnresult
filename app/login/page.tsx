"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [tenant, setTenant] = useState("naadhas");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant, password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error || `Login failed (${r.status})`);
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-br from-[#04081a] via-[#08102a] to-[#04081a] text-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[10px] uppercase tracking-[0.4em] text-white/45 font-bold">
            TN Election 2026 · Live
          </div>
          <div className="font-black text-2xl tracking-wide mt-2">
            Broadcast Sign-in
          </div>
          <div className="text-xs text-white/55 mt-1">
            Operator + on-air branding
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-[#0a0f24]/85 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md"
        >
          <label className="block text-[10px] uppercase tracking-[0.25em] text-white/55 font-bold mb-2">
            Channel
          </label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { id: "naadhas", label: "Naadhas Media" },
              { id: "aadhan", label: "Aadhan Tamil" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTenant(t.id)}
                className={
                  "px-3 py-2 rounded-lg border font-bold text-sm uppercase tracking-wide transition-colors " +
                  (tenant === t.id
                    ? "bg-amber-400/20 border-amber-400/60 text-amber-200"
                    : "bg-white/5 border-white/15 text-white/55 hover:border-white/30 hover:text-white")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <label
            htmlFor="password"
            className="block text-[10px] uppercase tracking-[0.25em] text-white/55 font-bold mb-2"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 font-mono text-sm tabular focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-colors"
            placeholder="••••••••"
          />

          {error && (
            <div className="mt-3 text-xs text-red-300 bg-red-600/15 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="mt-4 w-full bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black uppercase tracking-wider py-2.5 rounded-lg shadow-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="text-[10px] uppercase tracking-[0.25em] text-white/35 text-center mt-6">
          Powered by ProxyN.ai · Agentic Ops for SAP
        </div>
      </div>
    </div>
  );
}
