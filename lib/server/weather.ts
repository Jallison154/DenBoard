import type { RadarSlice, WeatherKind, WeatherSlice } from "../types";
import type { DenBoardConfig } from "./config";

const UA = "DenBoard/2.0 (+https://github.com/Jallison154/DenBoard)";

/** WMO weather codes → our coarse kinds + labels */
export function wmo(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: "clear", label: "Clear" };
  if (code === 1) return { kind: "partly", label: "Mostly clear" };
  if (code === 2) return { kind: "partly", label: "Partly cloudy" };
  if (code === 3) return { kind: "cloudy", label: "Overcast" };
  if (code === 45 || code === 48) return { kind: "fog", label: "Fog" };
  if (code >= 51 && code <= 57) return { kind: "drizzle", label: "Drizzle" };
  if (code === 61 || code === 80) return { kind: "rain", label: "Light rain" };
  if (code === 63 || code === 81) return { kind: "rain", label: "Rain" };
  if (code === 65 || code === 82) return { kind: "rain", label: "Heavy rain" };
  if (code === 66 || code === 67) return { kind: "rain", label: "Freezing rain" };
  if (code === 71 || code === 85) return { kind: "snow", label: "Light snow" };
  if (code === 73) return { kind: "snow", label: "Snow" };
  if (code === 75 || code === 86) return { kind: "snow", label: "Heavy snow" };
  if (code === 77) return { kind: "snow", label: "Snow grains" };
  if (code >= 95) return { kind: "storm", label: "Thunderstorms" };
  return { kind: "cloudy", label: "Cloudy" };
}

export async function loadWeather(config: DenBoardConfig): Promise<WeatherSlice> {
  const { lat, lon, timezone, units } = config.location;
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("timezone", timezone);
  u.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,precipitation"
  );
  u.searchParams.set("hourly", "temperature_2m,weather_code,is_day,precipitation_probability");
  u.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset"
  );
  u.searchParams.set("minutely_15", "precipitation");
  u.searchParams.set("forecast_days", "8");
  u.searchParams.set("forecast_minutely_15", "8");
  if (units === "imperial") {
    u.searchParams.set("temperature_unit", "fahrenheit");
    u.searchParams.set("wind_speed_unit", "mph");
    u.searchParams.set("precipitation_unit", "inch");
  }

  const res = await fetch(u, { signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`);
  const d = await res.json();

  const c = d.current;
  const cur = wmo(c.weather_code);
  const nowIso: string = c.time;
  const startIdx = Math.max(
    0,
    (d.hourly.time as string[]).findIndex((t) => t >= nowIso.slice(0, 13))
  );

  const hourly = (d.hourly.time as string[]).slice(startIdx, startIdx + 24).map((time, i) => {
    const k = startIdx + i;
    return {
      time,
      temp: Math.round(d.hourly.temperature_2m[k]),
      kind: wmo(d.hourly.weather_code[k]).kind,
      isDay: d.hourly.is_day[k] === 1,
      pop: d.hourly.precipitation_probability[k] ?? 0
    };
  });

  const daily = (d.daily.time as string[]).map((date, i) => ({
    date,
    hi: Math.round(d.daily.temperature_2m_max[i]),
    lo: Math.round(d.daily.temperature_2m_min[i]),
    ...wmo(d.daily.weather_code[i]),
    pop: d.daily.precipitation_probability_max[i] ?? 0,
    sunrise: d.daily.sunrise[i],
    sunset: d.daily.sunset[i]
  }));

  const minutely: number[] = d.minutely_15?.precipitation ?? [];
  const precipSoon =
    (c.precipitation ?? 0) > 0 ||
    minutely.some((p) => p > 0) ||
    hourly.slice(0, 2).some((h) => h.pop >= 60) ||
    ["rain", "drizzle", "snow", "storm"].includes(cur.kind);

  return {
    units,
    current: {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      kind: cur.kind,
      label: cur.label,
      isDay: c.is_day === 1,
      humidity: Math.round(c.relative_humidity_2m),
      wind: Math.round(c.wind_speed_10m),
      precip: c.precipitation ?? 0
    },
    hourly,
    daily,
    precipSoon,
    alerts: await loadAlerts(lat, lon),
    updatedAt: Date.now()
  };
}

/** US National Weather Service alerts (free, US only — silently empty elsewhere). */
async function loadAlerts(lat: number, lon: number): Promise<WeatherSlice["alerts"]> {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      {
        headers: { "User-Agent": UA, Accept: "application/geo+json" },
        signal: AbortSignal.timeout(10000),
        cache: "no-store"
      }
    );
    if (!res.ok) return [];
    const d = await res.json();
    return (d.features ?? [])
      .map((f: { id: string; properties: Record<string, string> }) => ({
        id: f.id,
        event: f.properties.event,
        headline: f.properties.headline || f.properties.event,
        severity: f.properties.severity,
        ends: f.properties.ends || f.properties.expires
      }))
      .filter((a: { severity: string }) => ["Extreme", "Severe", "Moderate"].includes(a.severity))
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** RainViewer public radar frames (no API key). Free tier serves zoom ≤ 7. */
export async function loadRadar(): Promise<RadarSlice> {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
    signal: AbortSignal.timeout(10000),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`rainviewer HTTP ${res.status}`);
  const d = await res.json();
  const host: string = d.host;
  const past: { time: number; path: string }[] = d.radar?.past ?? [];
  return {
    frames: past.slice(-8).map((f) => ({
      time: f.time * 1000,
      url: `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`
    })),
    updatedAt: Date.now()
  };
}
