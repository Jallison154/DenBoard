import fs from "fs/promises";
import path from "path";

import type { WeatherUnits } from "./weather";

export type LocationSettings = {
  lat: number;
  lon: number;
  timezone: string;
  units: WeatherUnits;
};

export type UnsplashSearchPresets = {
  [timeOfDay: string]: {
    [condition: string]: string;
  };
};

export type UnsplashSettings = {
  rotationMinutes: number;
  blurAmount: number;
  brightness: number;
  searchPresets: UnsplashSearchPresets;
};

export type WeatherSettings = {
  provider: "open-meteo";
  refreshMinutes: number;
  units: WeatherUnits;
};

export type CalendarSource = {
  id: string;
  name: string;
  color: string;
  icsUrl: string;
  enabled: boolean;
};

export type CalendarSettings = {
  refreshMinutes: number;
  maxEventsPerCell: number;
  showAllDay: boolean;
  calendars: CalendarSource[];
};

export type HomeAssistantEntitySetting = {
  id: string;
  label: string;
  icon?: string;
};

export type HomeAssistantSettings = {
  baseUrl: string;
  guestModeEntityId: string;
  refreshSeconds: number;
  entities: HomeAssistantEntitySetting[];
};

export type DisplaySettings = {
  defaultMode: "normal" | "guest";
  enableDadJokes: boolean;
  fontScale: number;
  cardOpacity: number;
  enableWeatherEffects: boolean;
};

export type DenBoardSettings = {
  location: LocationSettings;
  unsplash: UnsplashSettings;
  weather: WeatherSettings;
  calendar: CalendarSettings;
  homeAssistant: HomeAssistantSettings;
  display: DisplaySettings;
};

export type SettingsValidationResult = {
  ok: boolean;
  errors: string[];
};

export const SETTINGS_PATH =
  process.env.DENBOARD_SETTINGS_PATH ||
  path.join(process.cwd(), "settings.json");

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function getDefaultLocation(): LocationSettings {
  const defaultLat = 39.7392;
  const defaultLon = -104.9903;
  const lat = envNumber("DASHBOARD_LAT", defaultLat);
  const lon = envNumber("DASHBOARD_LON", defaultLon);
  const timezone = process.env.DASHBOARD_TZ || "America/Denver";
  const weatherUnitsEnv = (process.env.WEATHER_UNITS || "imperial").toLowerCase();
  const units: WeatherUnits =
    weatherUnitsEnv === "metric" ? "metric" : "imperial";

  return { lat, lon, timezone, units };
}

export function getDefaultSettings(): DenBoardSettings {
  const location = getDefaultLocation();

  return {
    location,
    unsplash: {
      rotationMinutes: 45,
      blurAmount: 10,
      brightness: 1,
      searchPresets: {
        morning: {
          clear: "morning sunrise mountains calm",
          cloudy: "morning cloudy mountains soft light",
          rain: "rainy morning mountains",
          snow: "snowy morning mountains",
          storm: "stormy mountains dawn"
        },
        midday: {
          clear: "bright alpine mountains",
          cloudy: "overcast alpine mountains",
          rain: "rain in the mountains daytime",
          snow: "snowfall mountains daytime",
          storm: "storm clouds over mountains"
        },
        evening: {
          clear: "sunset mountains warm light",
          cloudy: "moody twilight mountains",
          rain: "rainy evening mountains",
          snow: "snowy dusk mountains",
          storm: "lightning over mountain range"
        },
        night: {
          clear: "night sky stars over mountains",
          cloudy: "moody dark mountains",
          rain: "rain at night mountains",
          snow: "snow at night mountains",
          storm: "storm at night mountains"
        }
      }
    },
    weather: {
      provider: "open-meteo",
      refreshMinutes: 6,
      units: location.units
    },
    calendar: {
      refreshMinutes: 5,
      maxEventsPerCell: 3,
      showAllDay: true,
      calendars: [
        {
          id: "primary",
          name: "Family",
          color: "#FBBF24",
          icsUrl: process.env.GCAL_ICS_URL || "",
          enabled: true
        }
      ]
    },
    homeAssistant: {
      baseUrl: process.env.HOME_ASSISTANT_URL || "",
      guestModeEntityId: "input_boolean.denboard_guest_mode",
      refreshSeconds: 10,
      entities: [
        { id: "sensor.denboard_internet_status", label: "Internet" },
        { id: "sensor.power_status", label: "Power" },
        { id: "binary_sensor.front_door", label: "Front Door" },
        { id: "sensor.living_room_temperature", label: "Living Temp" }
      ]
    },
    display: {
      defaultMode: "normal",
      enableDadJokes: true,
      fontScale: 1,
      cardOpacity: 0.7,
      enableWeatherEffects: true
    }
  };
}

export async function loadSettings(): Promise<DenBoardSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed: Partial<DenBoardSettings> = JSON.parse(raw);
    const defaults = getDefaultSettings();
    return {
      ...defaults,
      ...parsed,
      location: { ...defaults.location, ...(parsed.location || {}) },
      unsplash: { ...defaults.unsplash, ...(parsed.unsplash || {}) },
      weather: { ...defaults.weather, ...(parsed.weather || {}) },
      calendar: {
        ...defaults.calendar,
        ...(parsed.calendar || {}),
        calendars:
          parsed.calendar?.calendars && parsed.calendar.calendars.length > 0
            ? parsed.calendar.calendars
            : defaults.calendar.calendars
      },
      homeAssistant: {
        ...defaults.homeAssistant,
        ...(parsed.homeAssistant || {}),
        entities:
          parsed.homeAssistant?.entities &&
          parsed.homeAssistant.entities.length > 0
            ? parsed.homeAssistant.entities
            : defaults.homeAssistant.entities
      },
      display: { ...defaults.display, ...(parsed.display || {}) }
    };
  } catch {
    const defaults = getDefaultSettings();
    await saveSettings(defaults);
    return defaults;
  }
}

export async function saveSettings(settings: DenBoardSettings): Promise<void> {
  await fs.writeFile(
    SETTINGS_PATH,
    JSON.stringify(settings, null, 2),
    "utf8"
  );
}

export function validateSettings(settings: DenBoardSettings): SettingsValidationResult {
  const errors: string[] = [];

  if (
    Number.isNaN(settings.location.lat) ||
    settings.location.lat < -90 ||
    settings.location.lat > 90
  ) {
    errors.push("Latitude must be between -90 and 90.");
  }
  if (
    Number.isNaN(settings.location.lon) ||
    settings.location.lon < -180 ||
    settings.location.lon > 180
  ) {
    errors.push("Longitude must be between -180 and 180.");
  }
  if (!settings.location.timezone) {
    errors.push("Timezone is required.");
  }
  if (!["imperial", "metric"].includes(settings.location.units)) {
    errors.push("Location units must be 'imperial' or 'metric'.");
  }

  if (settings.weather.refreshMinutes <= 0) {
    errors.push("Weather refresh must be greater than 0 minutes.");
  }
  if (!["imperial", "metric"].includes(settings.weather.units)) {
    errors.push("Weather units must be 'imperial' or 'metric'.");
  }

  const ids = new Set<string>();
  for (const cal of settings.calendar.calendars) {
    if (!cal.id) {
      errors.push("Each calendar must have an id.");
    } else if (ids.has(cal.id)) {
      errors.push(`Duplicate calendar id: ${cal.id}`);
    }
    ids.add(cal.id);
    if (!cal.name) {
      errors.push(`Calendar '${cal.id}' must have a name.`);
    }
    if (cal.enabled && !cal.icsUrl) {
      errors.push(`Calendar '${cal.id}' is enabled but has no ICS URL.`);
    }
  }

  if (settings.homeAssistant.refreshSeconds <= 0) {
    errors.push("Home Assistant refresh must be greater than 0 seconds.");
  }

  if (settings.display.fontScale <= 0.5 || settings.display.fontScale > 2) {
    errors.push("Font scale should be between 0.5 and 2.");
  }
  if (
    settings.display.cardOpacity <= 0.4 ||
    settings.display.cardOpacity > 1
  ) {
    errors.push("Card opacity should be between 0.4 and 1.");
  }

  return { ok: errors.length === 0, errors };
}

