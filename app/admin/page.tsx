'use client';

import { useEffect, useState } from "react";

type CalendarSource = {
  id: string;
  name: string;
  color: string;
  icsUrl: string;
  enabled: boolean;
};

type HomeAssistantEntity = {
  id: string;
  label: string;
  icon?: string;
};

type Settings = {
  location?: {
    lat: number;
    lon: number;
    timezone: string;
    units: "imperial" | "metric";
  };
  weather?: {
    weatherSource: "external" | "homeassistant";
    haWeatherEntityId: string;
    haSunEntityId: string;
    haAlertEntityIds: string[];
    units: "imperial" | "metric";
    refreshMinutes: number;
  };
  calendar?: {
    refreshMinutes: number;
    maxEventsPerCell: number;
    showAllDay: boolean;
    calendars: CalendarSource[];
  };
  homeAssistant?: {
    baseUrl: string;
    guestModeEntityId: string;
    refreshSeconds: number;
    entities: HomeAssistantEntity[];
  };
};

const inputClass =
  "w-full rounded-lg bg-slate-950/70 border border-white/15 px-3 py-2 text-sm outline-none focus:border-sandstone";
const labelClass = "text-xs uppercase tracking-[0.2em] text-slate-400";

async function saveSettings(patch: Partial<Settings>) {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.errors?.join(", ") || "Save failed");
  }
  return data.settings;
}

export default function AdminPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    section: string;
    ok: boolean;
    message: string;
  } | null>(null);

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

  const showSaveFeedback = (section: string, ok: boolean, message: string) => {
    setSaveStatus({ section, ok, message });
    setTimeout(() => setSaveStatus(null), 4000);
  };

  return (
    <div className="min-h-screen px-6 py-10 md:px-12 lg:px-16 text-slate-100">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">DenBoard Control Panel</h1>
          <p className="text-sm text-slate-300">
            Configure calendar, weather, and Home Assistant integrations.
          </p>
        </header>

        {/* Quick Links */}
        <section className="rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300 mb-3">
            Quick Links
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <a
              href="/tv/home"
              className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10"
            >
              TV Home
            </a>
            <a
              href="/tv/guest"
              className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10"
            >
              TV Guest
            </a>
            <a
              href="/p/home"
              className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10"
            >
              Portrait Home
            </a>
            <a
              href="/p/calendar"
              className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10"
            >
              Portrait Calendar
            </a>
          </div>
        </section>

        {loading && (
          <p className="text-sm text-slate-400">Loading settings…</p>
        )}

        {!loading && settings && (
          <>
            {/* Location */}
            <ConfigSection
              title="Location"
              description="Coordinates and timezone used for weather and calendar."
            >
              <LocationForm
                settings={settings}
                onSave={async (patch) => {
                  try {
                    const updated = await saveSettings(patch);
                    setSettings(updated);
                    showSaveFeedback("location", true, "Location saved.");
                  } catch (e) {
                    showSaveFeedback(
                      "location",
                      false,
                      e instanceof Error ? e.message : "Save failed"
                    );
                  }
                }}
                saveStatus={saveStatus?.section === "location" ? saveStatus : null}
              />
            </ConfigSection>

            {/* Weather */}
            <ConfigSection
              title="Weather"
              description="Choose external (Open-Meteo) or Home Assistant for weather data."
            >
              <WeatherForm
                settings={settings}
                onSave={async (patch) => {
                  try {
                    const updated = await saveSettings(patch);
                    setSettings(updated);
                    showSaveFeedback("weather", true, "Weather settings saved.");
                  } catch (e) {
                    showSaveFeedback(
                      "weather",
                      false,
                      e instanceof Error ? e.message : "Save failed"
                    );
                  }
                }}
                saveStatus={saveStatus?.section === "weather" ? saveStatus : null}
              />
            </ConfigSection>

            {/* Calendar */}
            <ConfigSection
              title="Calendar"
              description="ICS calendar sources (iCal links). Paste your calendar's ICS URL below."
            >
              <div className="space-y-4">
                <CalendarForm
                  settings={settings}
                  onSave={async (patch) => {
                    try {
                      const updated = await saveSettings(patch);
                      setSettings(updated);
                      showSaveFeedback("calendar", true, "Calendar saved.");
                    } catch (e) {
                      showSaveFeedback(
                        "calendar",
                        false,
                        e instanceof Error ? e.message : "Save failed"
                      );
                    }
                  }}
                  saveStatus={
                    saveStatus?.section === "calendar" ? saveStatus : null
                  }
                />
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
                  onClick={async () => {
                    const res = await fetch("/api/debug/calendar", {
                      cache: "no-store",
                    });
                    const data = await res.json();
                    const lines = [
                      `ICS URLs: ${data.icsUrls?.length ?? 0}`,
                      ...(data.fetchResults ?? []).map(
                        (r: { url: string; ok: boolean; eventCount?: number; error?: string }) =>
                          r.ok
                            ? `✓ ${r.url.slice(0, 50)}… → ${r.eventCount ?? 0} events`
                            : `✗ ${r.url.slice(0, 50)}… → ${r.error ?? "failed"}`
                      ),
                      `Today: ${data.todayCount ?? 0} events`,
                      `Grid: ${data.gridEventCount ?? 0} total events`,
                    ];
                    alert(lines.join("\n"));
                  }}
                >
                  Test Calendar
                </button>
              </div>
            </ConfigSection>

            {/* Home Assistant */}
            <ConfigSection
              title="Home Assistant"
              description="Connect to Home Assistant for status tiles and optional weather. Set HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN in .env."
            >
              <HomeAssistantForm
                settings={settings}
                onSave={async (patch) => {
                  try {
                    const updated = await saveSettings(patch);
                    setSettings(updated);
                    showSaveFeedback(
                      "homeAssistant",
                      true,
                      "Home Assistant settings saved."
                    );
                  } catch (e) {
                    showSaveFeedback(
                      "homeAssistant",
                      false,
                      e instanceof Error ? e.message : "Save failed"
                    );
                  }
                }}
                saveStatus={
                  saveStatus?.section === "homeAssistant" ? saveStatus : null
                }
              />
            </ConfigSection>

            {/* Weather Debug */}
            <section className="rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300 mb-2">
                Weather Debug
              </h2>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
                onClick={async () => {
                  const res = await fetch("/api/debug/weather", {
                    cache: "no-store",
                  });
                  const data = await res.json();
                  alert(
                    `Source: ${data.source}\nUnits: ${data.units}\nCurrent: ${data.mapped?.temperatureCurrent ?? "—"}\nCondition: ${data.mapped?.conditionText ?? "—"}`
                  );
                }}
              >
                Test Weather API
              </button>
            </section>
          </>
        )}

        {!loading && !settings && (
          <p className="text-sm text-rose-300">
            Could not load settings. Check server logs.
          </p>
        )}
      </div>
    </div>
  );
}

function ConfigSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-slate-900/80 border border-white/10 px-5 py-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300 mb-1">
        {title}
      </h2>
      <p className="text-xs text-slate-400 mb-4">{description}</p>
      {children}
    </section>
  );
}

function LocationForm({
  settings,
  onSave,
  saveStatus,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  saveStatus: { ok: boolean; message: string } | null;
}) {
  const [lat, setLat] = useState(String(settings.location?.lat ?? ""));
  const [lon, setLon] = useState(String(settings.location?.lon ?? ""));
  const [timezone, setTimezone] = useState(
    settings.location?.timezone ?? "America/Denver"
  );
  const [units, setUnits] = useState<"imperial" | "metric">(
    settings.location?.units ?? "imperial"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLat(String(settings.location?.lat ?? ""));
    setLon(String(settings.location?.lon ?? ""));
    setTimezone(settings.location?.timezone ?? "America/Denver");
    setUnits(settings.location?.units ?? "imperial");
  }, [settings]);

  useEffect(() => {
    setLat(String(settings.location?.lat ?? ""));
    setLon(String(settings.location?.lon ?? ""));
    setTimezone(settings.location?.timezone ?? "America/Denver");
    setUnits(settings.location?.units ?? "imperial");
  }, [settings]);

  useEffect(() => {
    setLat(String(settings.location?.lat ?? ""));
    setLon(String(settings.location?.lon ?? ""));
    setTimezone(settings.location?.timezone ?? "America/Denver");
    setUnits(settings.location?.units ?? "imperial");
  }, [settings]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
          location: {
            lat: parseFloat(lat) || 0,
            lon: parseFloat(lon) || 0,
            timezone,
            units,
          },
        });
        setSaving(false);
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Latitude</label>
          <input
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className={inputClass}
            placeholder="39.7392"
          />
        </div>
        <div>
          <label className={labelClass}>Longitude</label>
          <input
            type="text"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            className={inputClass}
            placeholder="-104.9903"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Timezone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className={inputClass}
          placeholder="America/Denver"
        />
      </div>
      <div>
        <label className={labelClass}>Units</label>
        <select
          value={units}
          onChange={(e) =>
            setUnits(e.target.value as "imperial" | "metric")
          }
          className={inputClass}
        >
          <option value="imperial">Imperial (°F)</option>
          <option value="metric">Metric (°C)</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-sandstone/90 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-sandstone disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Location"}
      </button>
      {saveStatus && (
        <p
          className={`text-xs ${
            saveStatus.ok ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {saveStatus.message}
        </p>
      )}
    </form>
  );
}

function WeatherForm({
  settings,
  onSave,
  saveStatus,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  saveStatus: { ok: boolean; message: string } | null;
}) {
  const [weatherSource, setWeatherSource] = useState<
    "external" | "homeassistant"
  >(settings.weather?.weatherSource ?? "external");
  const [haWeatherEntityId, setHaWeatherEntityId] = useState(
    settings.weather?.haWeatherEntityId ?? "weather.home"
  );
  const [haSunEntityId, setHaSunEntityId] = useState(
    settings.weather?.haSunEntityId ?? "sun.sun"
  );
  const [units, setUnits] = useState<"imperial" | "metric">(
    settings.weather?.units ?? "imperial"
  );
  const [refreshMinutes, setRefreshMinutes] = useState(
    String(settings.weather?.refreshMinutes ?? 6)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWeatherSource(settings.weather?.weatherSource ?? "external");
    setHaWeatherEntityId(settings.weather?.haWeatherEntityId ?? "weather.home");
    setHaSunEntityId(settings.weather?.haSunEntityId ?? "sun.sun");
    setUnits(settings.weather?.units ?? "imperial");
    setRefreshMinutes(String(settings.weather?.refreshMinutes ?? 6));
  }, [settings]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
          weather: {
            weatherSource,
            haWeatherEntityId,
            haSunEntityId,
            haAlertEntityIds: settings.weather?.haAlertEntityIds ?? [],
            units,
            refreshMinutes: parseInt(refreshMinutes, 10) || 6,
          },
        });
        setSaving(false);
      }}
    >
      <div>
        <label className={labelClass}>Weather Source</label>
        <select
          value={weatherSource}
          onChange={(e) =>
            setWeatherSource(e.target.value as "external" | "homeassistant")
          }
          className={inputClass}
        >
          <option value="external">External (Open-Meteo)</option>
          <option value="homeassistant">Home Assistant</option>
        </select>
      </div>
      {weatherSource === "homeassistant" && (
        <>
          <div>
            <label className={labelClass}>Weather Entity ID</label>
            <input
              type="text"
              value={haWeatherEntityId}
              onChange={(e) => setHaWeatherEntityId(e.target.value)}
              className={inputClass}
              placeholder="weather.home"
            />
          </div>
          <div>
            <label className={labelClass}>Sun Entity ID</label>
            <input
              type="text"
              value={haSunEntityId}
              onChange={(e) => setHaSunEntityId(e.target.value)}
              className={inputClass}
              placeholder="sun.sun"
            />
          </div>
        </>
      )}
      <div>
        <label className={labelClass}>Units</label>
        <select
          value={units}
          onChange={(e) => setUnits(e.target.value as "imperial" | "metric")}
          className={inputClass}
        >
          <option value="imperial">Imperial (°F)</option>
          <option value="metric">Metric (°C)</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Refresh (minutes)</label>
        <input
          type="number"
          min={1}
          value={refreshMinutes}
          onChange={(e) => setRefreshMinutes(e.target.value)}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-sandstone/90 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-sandstone disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Weather"}
      </button>
      {saveStatus && (
        <p
          className={`text-xs ${
            saveStatus.ok ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {saveStatus.message}
        </p>
      )}
    </form>
  );
}

function CalendarForm({
  settings,
  onSave,
  saveStatus,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  saveStatus: { ok: boolean; message: string } | null;
}) {
  const [calendars, setCalendars] = useState<CalendarSource[]>(
    settings.calendar?.calendars ?? [
      { id: "primary", name: "Family", color: "#FBBF24", icsUrl: "", enabled: true },
    ]
  );
  const [refreshMinutes, setRefreshMinutes] = useState(
    String(settings.calendar?.refreshMinutes ?? 5)
  );
  const [maxEventsPerCell, setMaxEventsPerCell] = useState(
    String(settings.calendar?.maxEventsPerCell ?? 3)
  );
  const [showAllDay, setShowAllDay] = useState(
    settings.calendar?.showAllDay ?? true
  );
  const [saving, setSaving] = useState(false);

  const updateCal = (idx: number, patch: Partial<CalendarSource>) => {
    setCalendars((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const addCal = () => {
    setCalendars((prev) => [
      ...prev,
      {
        id: `cal-${Date.now()}`,
        name: "New Calendar",
        color: "#FBBF24",
        icsUrl: "",
        enabled: true,
      },
    ]);
  };

  const removeCal = (idx: number) => {
    setCalendars((prev) => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    setCalendars(settings.calendar?.calendars ?? []);
    setRefreshMinutes(String(settings.calendar?.refreshMinutes ?? 5));
    setMaxEventsPerCell(String(settings.calendar?.maxEventsPerCell ?? 3));
    setShowAllDay(settings.calendar?.showAllDay ?? true);
  }, [settings]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
          calendar: {
            calendars,
            refreshMinutes: parseInt(refreshMinutes, 10) || 5,
            maxEventsPerCell: parseInt(maxEventsPerCell, 10) || 3,
            showAllDay,
          },
        });
        setSaving(false);
      }}
    >
      <div className="space-y-3">
        {calendars.map((cal, idx) => (
          <div
            key={cal.id}
            className="rounded-xl bg-slate-950/60 border border-white/10 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Calendar {idx + 1}</span>
              {calendars.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCal(idx)}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  type="text"
                  value={cal.name}
                  onChange={(e) => updateCal(idx, { name: e.target.value })}
                  className={inputClass}
                  placeholder="Family"
                />
              </div>
              <div>
                <label className={labelClass}>Color</label>
                <input
                  type="text"
                  value={cal.color}
                  onChange={(e) => updateCal(idx, { color: e.target.value })}
                  className={inputClass}
                  placeholder="#FBBF24"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>ICS URL (iCal link)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={cal.icsUrl}
                  onChange={(e) => updateCal(idx, { icsUrl: e.target.value })}
                  className={inputClass}
                  placeholder="https://calendar.google.com/calendar/ical/..."
                />
                <button
                  type="button"
                  disabled={!cal.icsUrl?.trim()}
                  onClick={async () => {
                    const url = cal.icsUrl?.trim();
                    if (!url) return;
                    try {
                      const res = await fetch(
                        `/api/calendar/metadata?url=${encodeURIComponent(url)}`,
                        { cache: "no-store" }
                      );
                      const data = await res.json();
                      const patch: Partial<CalendarSource> = {};
                      if (data.color) patch.color = data.color;
                      if (data.name) patch.name = data.name;
                      if (Object.keys(patch).length > 0) {
                        updateCal(idx, patch);
                      } else {
                        alert("No color or name found in feed. Google Calendar does not include these.");
                      }
                    } catch {
                      alert("Could not fetch calendar metadata.");
                    }
                  }}
                  className="rounded-lg border border-white/15 px-2 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50 shrink-0"
                >
                  Detect
                </button>
              </div>
              <details className="mt-2">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                  Where to find the ICS URL
                </summary>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  <strong>Google Calendar:</strong> Open{" "}
                  <a
                    href="https://calendar.google.com/calendar/u/0/r/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sandstone hover:underline"
                  >
                    calendar.google.com → Settings
                  </a>
                  , click your calendar name in the left sidebar, then scroll to{" "}
                  <strong>Integrate calendar</strong>. Copy either{" "}
                  <strong>Secret address in iCal format</strong> (private) or{" "}
                  <strong>Public address in iCal format</strong>. The URL ends in{" "}
                  <code className="text-slate-400">.ics</code>.
                </p>
              </details>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={cal.enabled}
                onChange={(e) => updateCal(idx, { enabled: e.target.checked })}
                className="rounded border-white/20"
              />
              Enabled
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={addCal}
          className="text-xs text-sandstone hover:underline"
        >
          + Add Calendar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Refresh (minutes)</label>
          <input
            type="number"
            min={1}
            value={refreshMinutes}
            onChange={(e) => setRefreshMinutes(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Max events per cell</label>
          <input
            type="number"
            min={1}
            value={maxEventsPerCell}
            onChange={(e) => setMaxEventsPerCell(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={showAllDay}
          onChange={(e) => setShowAllDay(e.target.checked)}
          className="rounded border-white/20"
        />
        Show all-day events
      </label>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-sandstone/90 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-sandstone disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Calendar"}
      </button>
      {saveStatus && (
        <p
          className={`text-xs ${
            saveStatus.ok ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {saveStatus.message}
        </p>
      )}
    </form>
  );
}

function HomeAssistantForm({
  settings,
  onSave,
  saveStatus,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  saveStatus: { ok: boolean; message: string } | null;
}) {
  const [baseUrl, setBaseUrl] = useState(
    settings.homeAssistant?.baseUrl ?? ""
  );
  const [guestModeEntityId, setGuestModeEntityId] = useState(
    settings.homeAssistant?.guestModeEntityId ?? "input_boolean.denboard_guest_mode"
  );
  const [refreshSeconds, setRefreshSeconds] = useState(
    String(settings.homeAssistant?.refreshSeconds ?? 10)
  );
  const [entities, setEntities] = useState<HomeAssistantEntity[]>(
    settings.homeAssistant?.entities ?? []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBaseUrl(settings.homeAssistant?.baseUrl ?? "");
    setGuestModeEntityId(
      settings.homeAssistant?.guestModeEntityId ??
        "input_boolean.denboard_guest_mode"
    );
    setRefreshSeconds(
      String(settings.homeAssistant?.refreshSeconds ?? 10)
    );
    setEntities(settings.homeAssistant?.entities ?? []);
  }, [settings]);

  const updateEntity = (idx: number, patch: Partial<HomeAssistantEntity>) => {
    setEntities((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e))
    );
  };

  const addEntity = () => {
    setEntities((prev) => [
      ...prev,
      { id: "sensor.example", label: "New Entity" },
    ]);
  };

  const removeEntity = (idx: number) => {
    setEntities((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
          homeAssistant: {
            baseUrl,
            guestModeEntityId,
            refreshSeconds: parseInt(refreshSeconds, 10) || 10,
            entities,
          },
        });
        setSaving(false);
      }}
    >
      <div>
        <label className={labelClass}>Base URL</label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className={inputClass}
          placeholder="http://homeassistant.local:8123"
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Override with HOME_ASSISTANT_URL in .env
        </p>
      </div>
      <div>
        <label className={labelClass}>Guest Mode Entity</label>
        <input
          type="text"
          value={guestModeEntityId}
          onChange={(e) => setGuestModeEntityId(e.target.value)}
          className={inputClass}
          placeholder="input_boolean.denboard_guest_mode"
        />
      </div>
      <div>
        <label className={labelClass}>Refresh (seconds)</label>
        <input
          type="number"
          min={1}
          value={refreshSeconds}
          onChange={(e) => setRefreshSeconds(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className={labelClass}>Status Entities</label>
          <button
            type="button"
            onClick={addEntity}
            className="text-xs text-sandstone hover:underline"
          >
            + Add
          </button>
        </div>
        {entities.map((ent, idx) => (
          <div
            key={idx}
            className="flex gap-2 items-end rounded-lg bg-slate-950/60 border border-white/10 p-3"
          >
            <div className="flex-1">
              <label className={labelClass}>Entity ID</label>
              <input
                type="text"
                value={ent.id}
                onChange={(e) => updateEntity(idx, { id: e.target.value })}
                className={inputClass}
                placeholder="sensor.example"
              />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Label</label>
              <input
                type="text"
                value={ent.label}
                onChange={(e) => updateEntity(idx, { label: e.target.value })}
                className={inputClass}
                placeholder="Display name"
              />
            </div>
            <button
              type="button"
              onClick={() => removeEntity(idx)}
              className="text-xs text-rose-400 hover:text-rose-300 pb-2"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-sandstone/90 text-slate-950 text-xs font-semibold px-4 py-2 hover:bg-sandstone disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Home Assistant"}
      </button>
      {saveStatus && (
        <p
          className={`text-xs ${
            saveStatus.ok ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {saveStatus.message}
        </p>
      )}
    </form>
  );
}
