import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { loadSettings } from "./settings";
import { logger } from "./logging";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  RADAR_MAX_NATIVE_ZOOM,
  type RadarFrame,
  type RadarPayload
} from "./radarConstants";

export {
  MIN_ZOOM,
  MAX_ZOOM,
  RADAR_MAX_NATIVE_ZOOM,
  DEFAULT_ZOOM,
  RADAR_COLOR,
  RADAR_TILE_SIZE,
  DARK_BASE_MAP_URL,
  radarTileUrlTemplate
} from "./radarConstants";
export type { RadarFrame, RadarPayload } from "./radarConstants";

const RADAR_CACHE_KEY = "weather:radar:v4";

type RainViewerMaps = {
  host?: string;
  radar?: {
    past?: { time: number; path: string }[];
  };
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export async function getWeatherRadar(): Promise<RadarPayload> {
  const settings = await loadSettings();
  const lat = settings.location.lat;
  const lon = settings.location.lon;
  const refreshMs = Math.max(
    30,
    (settings.display.weatherRadarRefreshSeconds ?? 60) * 1000
  );

  const zoom = clamp(DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM);
  const radarZoom = Math.min(zoom, RADAR_MAX_NATIVE_ZOOM);

  const fallback: RadarPayload = {
    host: "https://tilecache.rainviewer.com",
    frames: [],
    lat,
    lon,
    zoom,
    radarZoom,
    isFallback: true,
    fetchedAt: new Date().toISOString(),
    message: "Radar imagery is temporarily unavailable."
  };

  const cached = getFromCache<RadarPayload>(RADAR_CACHE_KEY);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(
      "https://api.rainviewer.com/public/weather-maps.json",
      { next: { revalidate: 60 } },
      { retries: 2, timeoutMs: 12_000 }
    );
    if (!res.ok) {
      logger.warn("RainViewer maps request failed", { status: res.status });
      setInCache(RADAR_CACHE_KEY, fallback, Math.min(refreshMs, 60_000));
      return fallback;
    }

    const data = (await res.json()) as RainViewerMaps;
    const host = data.host ?? "https://tilecache.rainviewer.com";
    const past = data.radar?.past ?? [];
    const frames: RadarFrame[] = past
      .slice(-12)
      .filter((f) => f.path && Number.isFinite(f.time))
      .map((f) => ({ time: f.time, path: f.path }));

    if (frames.length === 0) {
      setInCache(RADAR_CACHE_KEY, fallback, Math.min(refreshMs, 60_000));
      return fallback;
    }

    const payload: RadarPayload = {
      host,
      frames,
      lat,
      lon,
      zoom,
      radarZoom,
      isFallback: false,
      fetchedAt: new Date().toISOString()
    };
    setInCache(RADAR_CACHE_KEY, payload, Math.max(15_000, refreshMs - 5000));
    return payload;
  } catch (err) {
    logger.warn("Weather radar fetch failed", { error: String(err) });
    setInCache(RADAR_CACHE_KEY, fallback, Math.min(refreshMs, 60_000));
    return fallback;
  }
}
