import { DateTime } from "luxon";
import { getConfig } from "./config";
import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { logger } from "./logging";
import { loadSettings } from "./settings";

export type WeatherUnits = "imperial" | "metric";

export type WeatherOverlay = "rain" | "snow" | "cloudy" | "storm" | "clear" | null;

export type SevereAlert = {
  id: string;
  title: string;
  description?: string;
  severity?: string;
};

export type DailyForecastEntry = {
  dateISO: string;
  dayName: string;
  iconCode: string;
  highTemp: number;
  lowTemp: number;
};

export type WeatherPayload = {
  temperatureCurrent: number | null;
  conditionCode: number | string | null;
  conditionText: string | null;
  isDay: boolean;
  sunrise: string | null;
  sunset: string | null;
  dailyForecast: DailyForecastEntry[];
  alerts: SevereAlert[];
  overlay: WeatherOverlay;
  units: WeatherUnits;
  isFallback: boolean;
  fetchedAt: string;
};

export type WeatherDebugPayload = {
  source: "external" | "homeassistant";
  mapped: WeatherPayload;
  rawProvider: unknown;
  units: WeatherUnits;
  fetchedAt: string;
};

const WEATHER_CACHE_KEY = "weather:current";

function mapWeatherCodeToCondition(
  code: number
): { label: string; icon: string; overlay: WeatherOverlay } {
  // Based loosely on WMO weather codes
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return { label: "Rain", icon: "rain", overlay: "rain" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: "Snow", icon: "snow", overlay: "snow" };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: "Storm", icon: "storm", overlay: "storm" };
  }
  if ([45, 48].includes(code)) {
    return { label: "Foggy", icon: "fog", overlay: "cloudy" };
  }
  if ([1, 2, 3].includes(code)) {
    return { label: "Partly Cloudy", icon: "cloudy", overlay: "cloudy" };
  }
  if (code === 0) {
    return { label: "Clear", icon: "clear", overlay: "clear" };
  }
  return { label: "Cloudy", icon: "cloudy", overlay: "cloudy" };
}

async function fetchAndMapWeather(): Promise<WeatherDebugPayload> {
  const config = getConfig();
  const settings = await loadSettings();
  const units: WeatherUnits = settings.weather.units || config.weatherUnits;
  const source: "external" | "homeassistant" =
    settings.weather.weatherSource || "external";

  if (source === "homeassistant") {
    return fetchFromHomeAssistant(settings, units);
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(config.lat));
    url.searchParams.set("longitude", String(config.lon));
    url.searchParams.set("current", "temperature_2m,weather_code,is_day");
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,sunrise,sunset,weather_code,precipitation_probability_max"
    );
    url.searchParams.set("timezone", config.timezone);
    url.searchParams.set("forecast_days", "5");
    url.searchParams.set("warnings", "true");
    url.searchParams.set(
      "temperature_unit",
      units === "imperial" ? "fahrenheit" : "celsius"
    );

    logger.info("Weather request", {
      provider: "open-meteo",
      lat: config.lat,
      lon: config.lon,
      units,
      url: url.toString()
    });

    const res = await fetchWithRetry(url.toString());
    const raw: any = await res.json();

    const now = DateTime.now().setZone(config.timezone);
    const fetchedAt: string =
      now.toISO() ?? new Date().toISOString();

    const currentCode: number | null =
      typeof raw.current?.weather_code === "number"
        ? raw.current.weather_code
        : null;
    const mapping = mapWeatherCodeToCondition(currentCode ?? 0);

    const sunrise = raw.daily?.sunrise?.[0] ?? null;
    const sunset = raw.daily?.sunset?.[0] ?? null;

    const dailyForecast: DailyForecastEntry[] = [];
    const days: string[] = raw.daily?.time ?? [];
    for (let i = 0; i < Math.min(days.length, 5); i += 1) {
      const dateISO = days[i];
      const codeForDay: number =
        typeof raw.daily?.weather_code?.[i] === "number"
          ? raw.daily.weather_code[i]
          : currentCode ?? 0;
      const m = mapWeatherCodeToCondition(codeForDay);

      const date = DateTime.fromISO(dateISO, { zone: config.timezone });

      dailyForecast.push({
        dateISO,
        dayName: date.isValid ? date.toFormat("ccc") : "",
        iconCode: m.icon,
        highTemp: raw.daily?.temperature_2m_max?.[i] ?? NaN,
        lowTemp: raw.daily?.temperature_2m_min?.[i] ?? NaN
      });
    }

    const alerts: SevereAlert[] =
      raw.weather_warnings?.warnings?.map((w: any, idx: number) => ({
        id: w.id ?? String(idx),
        title: w.event ?? "Weather alert",
        description: w.description,
        severity: w.severity
      })) ?? [];

    const mapped: WeatherPayload = {
      temperatureCurrent:
        typeof raw.current?.temperature_2m === "number"
          ? raw.current.temperature_2m
          : null,
      conditionCode: currentCode,
      conditionText: mapping.label,
      isDay: Boolean(raw.current?.is_day),
      sunrise,
      sunset,
      dailyForecast,
      alerts,
      overlay: mapping.overlay,
      units,
      isFallback: false,
      fetchedAt
    };

    return {
      source: "external",
      mapped,
      rawProvider: raw,
      units,
      fetchedAt
    };
  } catch (error) {
    logger.error("Failed to load weather", { error: String(error) });
    const now = DateTime.now();
    const fallback: WeatherPayload = {
      temperatureCurrent: null,
      conditionCode: null,
      conditionText: null,
      isDay: true,
      sunrise: null,
      sunset: null,
      dailyForecast: [],
      alerts: [],
      overlay: null,
      units: getConfig().weatherUnits,
      isFallback: true,
      fetchedAt: now.toISO() ?? new Date().toISOString()
    };
    return {
      source: "external",
      mapped: fallback,
      rawProvider: null,
      units: fallback.units,
      fetchedAt: fallback.fetchedAt
    };
  }
}

function mapHomeAssistantCondition(
  state: string | null | undefined
): { label: string; icon: string; overlay: WeatherOverlay } {
  const s = (state || "").toLowerCase();
  if (!s) return { label: "Unknown", icon: "cloudy", overlay: "cloudy" };

  if (s === "sunny" || s === "clear" || s === "clear-night") {
    return { label: "Clear", icon: "clear", overlay: "clear" };
  }
  if (s === "partlycloudy") {
    return { label: "Partly Cloudy", icon: "cloudy", overlay: "cloudy" };
  }
  if (s === "cloudy" || s === "overcast") {
    return { label: "Cloudy", icon: "cloudy", overlay: "cloudy" };
  }
  if (s === "rainy" || s === "pouring" || s === "lightning-rainy") {
    return { label: "Rain", icon: "rain", overlay: "rain" };
  }
  if (s === "snowy" || s === "snowy-rainy" || s === "hail") {
    return { label: "Snow", icon: "snow", overlay: "snow" };
  }
  if (s === "windy") {
    return { label: "Windy", icon: "cloudy", overlay: "cloudy" };
  }
  if (s === "fog" || s === "foggy") {
    return { label: "Foggy", icon: "fog", overlay: "cloudy" };
  }
  if (s === "lightning") {
    return { label: "Storm", icon: "storm", overlay: "storm" };
  }
  return { label: "Cloudy", icon: "cloudy", overlay: "cloudy" };
}

async function fetchFromHomeAssistant(
  settings: import("./settings").DenBoardSettings,
  fallbackUnits: WeatherUnits
): Promise<WeatherDebugPayload> {
  const config = getConfig();
  const baseUrl =
    (settings.homeAssistant.baseUrl || config.homeAssistantUrl || "").replace(
      /\/+$/,
      ""
    );
  const token = config.homeAssistantToken;

  if (!baseUrl || !token) {
    logger.warn(
      "Home Assistant weather selected but HOME_ASSISTANT_URL or HOME_ASSISTANT_TOKEN not configured; falling back to external"
    );
    // Fall back to external
    return fetchAndMapWeather();
  }

  const units: WeatherUnits =
    settings.weather.units || settings.location.units || fallbackUnits;

  async function fetchHaState(entityId: string): Promise<any> {
    const url = `${baseUrl}/api/states/${encodeURIComponent(entityId)}`;
    const res = await fetchWithRetry(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    return res.json();
  }

  try {
    const weatherId = settings.weather.haWeatherEntityId || "weather.home";
    const sunId = settings.weather.haSunEntityId || "sun.sun";

    logger.info("Weather request", {
      provider: "home-assistant",
      baseUrl,
      weatherEntity: weatherId,
      sunEntity: sunId,
      units
    });

    const [rawWeather, rawSun, rawAlerts] = await Promise.all([
      fetchHaState(weatherId),
      fetchHaState(sunId).catch(() => null),
      Promise.all(
        (settings.weather.haAlertEntityIds || []).map((id) =>
          fetchHaState(id).catch(() => null)
        )
      )
    ]);

    const attrs = rawWeather?.attributes || {};

    const temp =
      typeof attrs.temperature === "number" ? attrs.temperature : null;

    let unitsFromHa: WeatherUnits | null = null;
    if (typeof attrs.temperature_unit === "string") {
      const u = attrs.temperature_unit.toLowerCase();
      if (u.includes("f")) unitsFromHa = "imperial";
      else if (u.includes("c")) unitsFromHa = "metric";
    }

    const conditionMapping = mapHomeAssistantCondition(rawWeather?.state);

    // Forecast aggregation
    const forecast: DailyForecastEntry[] = [];
    const forecastRaw: any[] = Array.isArray(attrs.forecast)
      ? attrs.forecast
      : [];
    if (forecastRaw.length > 0) {
      const byDate = new Map<
        string,
        { high: number; low: number; condition: string | null }
      >();

      for (const item of forecastRaw) {
        const dtRaw =
          item.datetime ||
          item.datetime_iso ||
          item.datetime_local ||
          item.dt ||
          item.date ||
          item.when;
        if (!dtRaw) continue;
        const dt = DateTime.fromISO(String(dtRaw));
        if (!dt.isValid) continue;
        const key = dt.toISODate();

        const existing = byDate.get(key) || {
          high: Number.NEGATIVE_INFINITY,
          low: Number.POSITIVE_INFINITY,
          condition: item.condition ?? rawWeather?.state ?? null
        };
        const tHigh =
          typeof item.temperature === "number"
            ? item.temperature
            : typeof item.temphigh === "number"
            ? item.temphigh
            : existing.high;
        const tLow =
          typeof item.templow === "number"
            ? item.templow
            : typeof item.temperature === "number"
            ? Math.min(existing.low, item.temperature)
            : existing.low;

        existing.high = Number.isFinite(tHigh) ? Math.max(existing.high, tHigh) : existing.high;
        existing.low = Number.isFinite(tLow) ? Math.min(existing.low, tLow) : existing.low;
        if (!existing.condition && item.condition) {
          existing.condition = item.condition;
        }
        byDate.set(key, existing);
      }

      const keys = Array.from(byDate.keys()).sort();
      for (const key of keys.slice(0, 5)) {
        const day = byDate.get(key)!;
        const dt = DateTime.fromISO(key);
        const m = mapHomeAssistantCondition(day.condition);
        forecast.push({
          dateISO: key,
          dayName: dt.isValid ? dt.toFormat("ccc") : "",
          iconCode: m.icon,
          highTemp: Number.isFinite(day.high) ? day.high : NaN,
          lowTemp: Number.isFinite(day.low) ? day.low : NaN
        });
      }
    }

    // Sunrise / sunset from sun entity, if available
    let sunrise: string | null = null;
    let sunset: string | null = null;
    if (rawSun?.attributes) {
      sunrise =
        rawSun.attributes.next_rising ||
        rawSun.attributes.sunrise ||
        rawSun.attributes.next_dawn ||
        null;
      sunset =
        rawSun.attributes.next_setting ||
        rawSun.attributes.sunset ||
        rawSun.attributes.next_dusk ||
        null;
    }

    // Alerts
    const alerts: SevereAlert[] = [];
    for (const ent of rawAlerts) {
      if (!ent) continue;
      const a = ent.attributes || {};
      const title =
        a.title || a.headline || a.event || a.friendly_name || ent.entity_id;
      const severity =
        a.severity || a.level || a.status || ent.state || undefined;
      const description = a.description || a.summary || undefined;
      alerts.push({
        id: ent.entity_id,
        title,
        description,
        severity
      });
    }

    const now = DateTime.now();
    const fetchedAt = now.toISO() ?? new Date().toISOString();

    const mappedUnits: WeatherUnits = unitsFromHa || units;

    const mapped: WeatherPayload = {
      temperatureCurrent: temp,
      conditionCode: rawWeather?.state ?? null,
      conditionText: conditionMapping.label,
      isDay: rawSun?.state === "above_horizon" || Boolean(attrs.is_day),
      sunrise,
      sunset,
      dailyForecast: forecast,
      alerts,
      overlay: conditionMapping.overlay,
      units: mappedUnits,
      isFallback: false,
      fetchedAt
    };

    return {
      source: "homeassistant",
      mapped,
      rawProvider: {
        weather: rawWeather,
        sun: rawSun,
        alerts: rawAlerts
      },
      units: mappedUnits,
      fetchedAt
    };
  } catch (error) {
    logger.error("Failed to load Home Assistant weather", {
      error: String(error)
    });
    // Fall back to external provider
    return fetchAndMapWeather();
  }
}

export async function getWeather(): Promise<WeatherPayload> {
  const cached = getFromCache<WeatherPayload>(WEATHER_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const { mapped } = await fetchAndMapWeather();
  const config = getConfig();
  setInCache(WEATHER_CACHE_KEY, mapped, config.refresh.weatherMs);
  return mapped;
}

export async function getWeatherDebug(): Promise<WeatherDebugPayload> {
  // Always bypass cache for debugging to see the latest provider response.
  return fetchAndMapWeather();
}

export function describeTimeOfDay(dt: DateTime): "morning" | "midday" | "evening" | "night" {
  const hour = dt.hour;
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "midday";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

