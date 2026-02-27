import { DateTime } from "luxon";
import { getConfig } from "./config";
import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { logger } from "./logging";

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
  conditionCode: number | null;
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
  const units: WeatherUnits = config.weatherUnits;

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
    const fetchedAt = now.toISO();

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
      fetchedAt: now.toISO()
    };
    return {
      mapped: fallback,
      rawProvider: null,
      units: fallback.units,
      fetchedAt: fallback.fetchedAt
    };
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

