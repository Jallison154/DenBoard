import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { loadSettings } from "./settings";
import { logger } from "./logging";

export type RadarFrame = {
  time: number;
  imageUrl: string;
};

export type RadarPayload = {
  frames: RadarFrame[];
  lat: number;
  lon: number;
  zoom: number;
  isFallback: boolean;
  fetchedAt: string;
  message?: string;
};

const RADAR_CACHE_KEY = "weather:radar";
const CACHE_MS = 5 * 60 * 1000;

type RainViewerMaps = {
  host?: string;
  radar?: {
    past?: { time: number; path: string }[];
  };
};

function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function buildTileUrl(
  host: string,
  path: string,
  zoom: number,
  x: number,
  y: number
): string {
  const base = host.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}/256/${zoom}/${x}/${y}/6/1_1.png`;
}

export async function getWeatherRadar(): Promise<RadarPayload> {
  const settings = await loadSettings();
  const lat = settings.location.lat;
  const lon = settings.location.lon;
  const zoom = 7;

  const cached = getFromCache<RadarPayload>(RADAR_CACHE_KEY);
  if (cached) return cached;

  const fallback: RadarPayload = {
    frames: [],
    lat,
    lon,
    zoom,
    isFallback: true,
    fetchedAt: new Date().toISOString(),
    message: "Radar imagery is temporarily unavailable."
  };

  try {
    const res = await fetchWithRetry(
      "https://api.rainviewer.com/public/weather-maps.json",
      { next: { revalidate: 300 } },
      { retries: 2, timeoutMs: 12_000 }
    );
    if (!res.ok) {
      logger.warn("RainViewer maps request failed", { status: res.status });
      setInCache(RADAR_CACHE_KEY, fallback, 60_000);
      return fallback;
    }

    const data = (await res.json()) as RainViewerMaps;
    const host = data.host ?? "https://tilecache.rainviewer.com";
    const past = data.radar?.past ?? [];
    const recent = past.slice(-12);
    const { x, y } = latLonToTile(lat, lon, zoom);

    const frames: RadarFrame[] = recent
      .filter((f) => f.path && Number.isFinite(f.time))
      .map((f) => ({
        time: f.time,
        imageUrl: buildTileUrl(host, f.path, zoom, x, y)
      }));

    if (frames.length === 0) {
      setInCache(RADAR_CACHE_KEY, fallback, 60_000);
      return fallback;
    }

    const payload: RadarPayload = {
      frames,
      lat,
      lon,
      zoom,
      isFallback: false,
      fetchedAt: new Date().toISOString()
    };
    setInCache(RADAR_CACHE_KEY, payload, CACHE_MS);
    return payload;
  } catch (err) {
    logger.warn("Weather radar fetch failed", { error: String(err) });
    setInCache(RADAR_CACHE_KEY, fallback, 60_000);
    return fallback;
  }
}
