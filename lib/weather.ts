import { DateTime } from "luxon";
import { getConfig } from "./config";
import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { logger } from "./logging";

export type WeatherOverlay = "rain" | "snow" | "cloudy" | "storm" | "clear" | null;

export type SevereAlert = {
  id: string;
  title: string;
  description?: string;
  severity?: string;
};

export type DailyForecast = {
  date: string;
  min: number;
  max: number;
  condition: string;
  icon: string;
};

export type WeatherSummary = {
  temperature: number;
  condition: string;
  icon: string;
  isDay: boolean;
  sunrise?: string;
  sunset?: string;
};

export type WeatherPayload = {
  current: WeatherSummary | null;
  forecast: DailyForecast[];
  severeAlerts: SevereAlert[];
  overlay: WeatherOverlay;
  isFallback: boolean;
};

const WEATHER_CACHE_KEY = "weather:current";

function mapWeatherCodeToCondition(code: number): { label: string; icon: string; overlay: WeatherOverlay } {
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

export async function getWeather(): Promise<WeatherPayload> {
  const cached = getFromCache<WeatherPayload>(WEATHER_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const config = getConfig();

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

    const res = await fetchWithRetry(url.toString(), {
      next: { revalidate: 0 }
    });
    const data: any = await res.json();

    const currentCode = data.current?.weather_code ?? 0;
    const mapping = mapWeatherCodeToCondition(currentCode);

    const current: WeatherSummary | null = data.current
      ? {
          temperature: data.current.temperature_2m,
          condition: mapping.label,
          icon: mapping.icon,
          isDay: Boolean(data.current.is_day),
          sunrise: data.daily?.sunrise?.[0],
          sunset: data.daily?.sunset?.[0]
        }
      : null;

    const forecast: DailyForecast[] = [];
    const days = data.daily?.time ?? [];
    for (let i = 0; i < days.length; i += 1) {
      const code = data.daily.weather_code?.[i] ?? currentCode;
      const m = mapWeatherCodeToCondition(code);
      forecast.push({
        date: days[i],
        min: data.daily.temperature_2m_min?.[i],
        max: data.daily.temperature_2m_max?.[i],
        condition: m.label,
        icon: m.icon
      });
    }

    const alerts: SevereAlert[] =
      data.weather_warnings?.warnings?.map((w: any, idx: number) => ({
        id: w.id ?? String(idx),
        title: w.event ?? "Weather alert",
        description: w.description,
        severity: w.severity
      })) ?? [];

    const payload: WeatherPayload = {
      current,
      forecast,
      severeAlerts: alerts,
      overlay: mapping.overlay,
      isFallback: false
    };

    // Cache for the configured refresh interval
    setInCache(WEATHER_CACHE_KEY, payload, config.refresh.weatherMs);
    return payload;
  } catch (error) {
    logger.error("Failed to load weather", { error: String(error) });
    const fallback: WeatherPayload = {
      current: null,
      forecast: [],
      severeAlerts: [],
      overlay: null,
      isFallback: true
    };
    setInCache(WEATHER_CACHE_KEY, fallback, 60_000);
    return fallback;
  }
}

export function describeTimeOfDay(dt: DateTime): "morning" | "midday" | "evening" | "night" {
  const hour = dt.hour;
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "midday";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

