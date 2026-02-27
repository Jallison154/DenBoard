'use client';

import { useEffect, useState } from "react";

type Settings = any; // simplified for now; server validates shape

type LoginState = {
  pin: string;
  status: "idle" | "success" | "error";
  message?: string;
  warning?: string;
};

export default function AdminPage() {
  const [login, setLogin] = useState<LoginState>({ pin: "", status: "idle" });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = await res.json();
      setSettings(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings().catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLogin((prev) => ({ ...prev, status: "idle", message: undefined }));
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: login.pin })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLogin((prev) => ({
          ...prev,
          status: "error",
          message: data.error || "Invalid PIN."
        }));
        return;
      }
      setLogin((prev) => ({
        ...prev,
        status: "success",
        message: data.warning || "Admin unlocked.",
        warning: data.warning
      }));
      await fetchSettings();
    } catch {
      setLogin((prev) => ({
        ...prev,
        status: "error",
        message: "Failed to contact server."
      }));
    }
  }

  const adminPinUnset = !process.env.NEXT_PUBLIC_ADMIN_PIN && !process.env.ADMIN_PIN;

  return (
    <div className="min-h-screen px-6 py-10 md:px-12 lg:px-16 text-slate-100">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">DenBoard Control Panel</h1>
          <p className="text-sm text-slate-300">
            Adjust location, weather source, calendar, and display settings. This UI
            is a basic admin panel; advanced options live in <code>settings.json</code>.
          </p>
          {adminPinUnset && (
            <p className="text-xs text-amber-300">
              ADMIN_PIN is not set. For production, set ADMIN_PIN in your environment
              so only you can change these settings.
            </p>
          )}
        </header>

        <section className="rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4 max-w-md">
          <form className="space-y-3" onSubmit={handleLogin}>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Admin PIN
              </label>
            </div>
            <input
              type="password"
              value={login.pin}
              onChange={(e) =>
                setLogin((prev) => ({ ...prev, pin: e.target.value }))
              }
              className="w-full rounded-lg bg-slate-950/70 border border-white/15 px-3 py-2 text-sm outline-none focus:border-sandstone"
              placeholder="Enter PIN"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-sandstone/90 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-sandstone transition-colors"
            >
              Unlock Admin
            </button>
            {login.status === "success" && (
              <p className="text-xs text-emerald-300">
                {login.message || "Admin unlocked."}
              </p>
            )}
            {login.status === "error" && (
              <p className="text-xs text-rose-300">
                {login.message || "Invalid PIN."}
              </p>
            )}
          </form>
        </section>

        <section className="rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Quick Links
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <a
              href="/tv/home"
              className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10"
            >
              Open TV Home
            </a>
            <a
              href="/tv/guest"
              className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10"
            >
              Open TV Guest
            </a>
            <a
              href="/p/home"
              className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10"
            >
              Open Portrait Home
            </a>
            <a
              href="/p/calendar"
              className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10"
            >
              Open Portrait Calendar
            </a>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Weather Debug
            </h2>
            <button
              type="button"
              className="rounded-full border border-white/15 px-3 py-1 text-[11px] hover:bg-white/10"
              onClick={async () => {
                const res = await fetch("/api/debug/weather", {
                  cache: "no-store"
                });
                const data = await res.json();
                // eslint-disable-next-line no-alert
                alert(
                  `Source: ${data.source}\nUnits: ${data.units}\nCurrent: ${data.mapped?.temperatureCurrent}°\nCondition: ${data.mapped?.conditionText}`
                );
              }}
            >
              Test Weather
            </button>
          </div>
          <p className="text-xs text-slate-300">
            This calls <code>/api/debug/weather</code> and shows the mapped weather
            from the currently selected source (external or Home Assistant).
          </p>
        </section>

        <section className="rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            Current Settings (read-only preview)
          </h2>
          {loading && <p className="text-xs text-slate-400">Loading settings…</p>}
          {!loading && settings && (
            <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words text-slate-200/90 max-h-72 overflow-auto bg-slate-950/60 rounded-xl px-3 py-3 border border-white/10">
              {JSON.stringify(settings, null, 2)}
            </pre>
          )}
          {!loading && !settings && (
            <p className="text-xs text-rose-300">
              Could not load settings. Check server logs for details.
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            In this first version, save operations are available via the
            <code>/api/settings</code> PUT endpoint (used by this panel in future
            iterations). For now, you can edit <code>settings.json</code> directly
            on the server for advanced tweaks.
          </p>
        </section>
      </div>
    </div>
  );
}

