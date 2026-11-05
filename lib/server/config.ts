import fs from "fs";
import path from "path";
import type { DisplayConfigPublic, HouseConfigPublic, HouseTileKind } from "../types";

/**
 * DenBoard V2 configuration.
 *
 * Lives in data/denboard.json (override with DENBOARD_CONFIG). Secrets that never belong in a
 * file you might share — the Home Assistant token — come from env only. Calendar ICS URLs are
 * private too, so the full config is never sent to the browser; see toPublicConfig().
 */
export type CalendarSourceConfig = {
  id: string;
  name: string;
  color: string;
  url: string;
  enabled?: boolean;
  /** Shown on guest screens (e.g. a holidays calendar). Default false. */
  guestVisible?: boolean;
};

export type DenBoardConfig = {
  location: {
    name: string;
    lat: number;
    lon: number;
    timezone: string;
    units: "imperial" | "metric";
  };
  calendars: CalendarSourceConfig[];
  calendar: {
    gridMode: "rolling" | "month";
    weeks: number;
    weekStartsOn: 0 | 1;
    refreshMinutes: number;
  };
  homeAssistant: {
    url: string;
    guestModeEntity: string;
    people: { entity: string; name: string; picture?: string }[];
    tiles: {
      entity: string;
      name: string;
      kind: HouseTileKind;
      alertWhen?: string[];
      alertAfterMinutes?: number;
      guestVisible?: boolean;
    }[];
    mediaPlayers: string[] | "auto";
    hideMediaPlayers: string[];
  };
  display: {
    clock24h: boolean;
    /** Shown in the Today panel on guest screens */
    guestWelcome: string;
    nightDim: { start: string; end: string; level: number } | null;
    funRotateSeconds: number;
    fun: { jokes: boolean; facts: boolean; history: boolean };
  };
};

export const CONFIG_PATH =
  process.env.DENBOARD_CONFIG || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "denboard.json");

const V1_SETTINGS_PATH =
  process.env.DENBOARD_SETTINGS_PATH || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "settings.json");

export const isDemo = () => process.env.DENBOARD_DEMO === "1";

/** Alert states by tile kind — a tile "lights up" when its state is in this list. */
export const DEFAULT_ALERT_STATES: Record<HouseTileKind, string[]> = {
  lock: ["unlocked", "open", "jammed"],
  door: ["on", "open"],
  garage: ["open", "opening", "on"],
  window: ["on", "open"],
  climate: [],
  sensor: [],
  light: [],
  switch: []
};

function num(v: string | undefined, fallback: number) {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : fallback;
}

export function defaultConfig(): DenBoardConfig {
  return {
    location: {
      name: process.env.DASHBOARD_LOCATION_NAME || "Home",
      lat: num(process.env.DASHBOARD_LAT, 39.7392),
      lon: num(process.env.DASHBOARD_LON, -104.9903),
      timezone: process.env.DASHBOARD_TZ || "America/Denver",
      units: (process.env.WEATHER_UNITS || "imperial").toLowerCase() === "metric" ? "metric" : "imperial"
    },
    calendars: process.env.GCAL_ICS_URL
      ? [{ id: "family", name: "Family", color: "#5B8CFF", url: process.env.GCAL_ICS_URL }]
      : [],
    calendar: { gridMode: "rolling", weeks: 4, weekStartsOn: 0, refreshMinutes: 5 },
    homeAssistant: {
      url: process.env.HOME_ASSISTANT_URL || "",
      guestModeEntity: "input_boolean.denboard_guest_mode",
      people: [],
      tiles: [],
      mediaPlayers: "auto",
      hideMediaPlayers: []
    },
    display: {
      clock24h: false,
      guestWelcome: "Welcome! Make yourself at home.",
      nightDim: { start: "22:30", end: "06:00", level: 0.45 },
      funRotateSeconds: 75,
      fun: { jokes: true, facts: true, history: true }
    }
  };
}

/** Best-effort import of V1's settings.json so an in-place redeploy keeps calendars + location. */
function migrateFromV1(): Partial<DenBoardConfig> | null {
  try {
    const v1 = JSON.parse(fs.readFileSync(V1_SETTINGS_PATH, "utf8"));
    const out: Partial<DenBoardConfig> = {};
    if (v1.location) {
      out.location = {
        ...defaultConfig().location,
        lat: Number(v1.location.lat),
        lon: Number(v1.location.lon),
        timezone: v1.location.timezone,
        units: v1.location.units === "metric" ? "metric" : "imperial"
      };
    }
    const cals = v1.calendar?.calendars;
    if (Array.isArray(cals)) {
      out.calendars = cals
        .filter((c: { icsUrl?: string }) => c.icsUrl)
        .map((c: { id: string; name: string; color: string; icsUrl: string; enabled: boolean }) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          url: c.icsUrl,
          enabled: c.enabled !== false
        }));
    }
    if (v1.homeAssistant) {
      const base = defaultConfig().homeAssistant;
      out.homeAssistant = {
        ...base,
        url: v1.homeAssistant.baseUrl || base.url,
        guestModeEntity: v1.homeAssistant.guestModeEntityId || base.guestModeEntity,
        tiles: (v1.homeAssistant.entities || []).map((e: { id: string; label: string }) => ({
          entity: e.id,
          name: e.label,
          kind: guessKind(e.id)
        }))
      };
      // person.* / device_tracker.* entries become people instead of tiles
      out.homeAssistant.people = out.homeAssistant.tiles
        .filter((t) => /^(person|device_tracker)\./.test(t.entity))
        .map((t) => ({ entity: t.entity, name: t.name }));
      out.homeAssistant.tiles = out.homeAssistant.tiles.filter(
        (t) => !/^(person|device_tracker)\./.test(t.entity)
      );
    }
    return out;
  } catch {
    return null;
  }
}

function guessKind(entity: string): HouseTileKind {
  if (entity.startsWith("lock.")) return "lock";
  if (entity.startsWith("cover.") && entity.includes("garage")) return "garage";
  if (entity.startsWith("climate.")) return "climate";
  if (entity.startsWith("light.")) return "light";
  if (entity.startsWith("switch.")) return "switch";
  if (entity.startsWith("binary_sensor.") && entity.includes("window")) return "window";
  if (entity.startsWith("binary_sensor.") || entity.startsWith("cover.")) return "door";
  return "sensor";
}

let cached: { config: DenBoardConfig; mtime: number } | null = null;

function merge(raw: Partial<DenBoardConfig>): DenBoardConfig {
  const d = defaultConfig();
  return {
    location: { ...d.location, ...raw.location },
    calendars: raw.calendars ?? d.calendars,
    calendar: { ...d.calendar, ...raw.calendar },
    homeAssistant: { ...d.homeAssistant, ...raw.homeAssistant },
    display: {
      ...d.display,
      ...raw.display,
      fun: { ...d.display.fun, ...raw.display?.fun }
    }
  };
}

/** Reads config, creating it (from V1 settings if present) on first run. Cheap to call often. */
export function loadConfig(): DenBoardConfig {
  let mtime = 0;
  try {
    mtime = fs.statSync(CONFIG_PATH).mtimeMs;
  } catch {
    const seeded = merge(migrateFromV1() ?? {});
    try {
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(seeded, null, 2));
      mtime = fs.statSync(CONFIG_PATH).mtimeMs;
    } catch {
      return seeded;
    }
  }
  if (cached && cached.mtime === mtime) return cached.config;
  try {
    const config = merge(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")));
    cached = { config, mtime };
    return config;
  } catch (err) {
    console.error("[denboard] config parse error, using last good config:", String(err));
    return cached?.config ?? defaultConfig();
  }
}

export function configMtime(): number {
  try {
    return fs.statSync(CONFIG_PATH).mtimeMs;
  } catch {
    return 0;
  }
}

export function toPublicConfig(c: DenBoardConfig): DisplayConfigPublic {
  const ha = c.homeAssistant;
  const house: HouseConfigPublic = {
    people: ha.people,
    tiles: ha.tiles.map((t) => ({
      entity: t.entity,
      name: t.name,
      kind: t.kind,
      alertWhen: t.alertWhen ?? DEFAULT_ALERT_STATES[t.kind] ?? [],
      alertAfterMinutes: t.alertAfterMinutes ?? (t.kind === "lock" ? 10 : 0),
      guestVisible: t.guestVisible ?? false
    })),
    mediaPlayers: ha.mediaPlayers,
    hideMediaPlayers: ha.hideMediaPlayers,
    guestModeEntity: ha.guestModeEntity
  };
  return {
    timezone: c.location.timezone,
    locationName: c.location.name,
    lat: c.location.lat,
    lon: c.location.lon,
    guestWelcome: c.display.guestWelcome,
    guestCalendars: c.calendars.filter((x) => x.guestVisible).map((x) => x.id),
    calendar: {
      gridMode: c.calendar.gridMode,
      weeks: Math.min(6, Math.max(2, c.calendar.weeks)),
      weekStartsOn: c.calendar.weekStartsOn
    },
    nightDim: c.display.nightDim,
    funRotateSeconds: c.display.funRotateSeconds,
    clock24h: c.display.clock24h,
    house,
    demo: isDemo()
  };
}
