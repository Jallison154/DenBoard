import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { loadSettings } from "./settings";
import { logger } from "./logging";

export type RadarTile = {
  x: number;
  y: number;
  baseMapUrl: string;
};

export type RadarFrameTile = {
  x: number;
  y: number;
  url: string;
};

export type RadarFrame = {
  time: number;
  tiles: RadarFrameTile[];
};

export type RadarPayload = {
  frames: RadarFrame[];
  baseTiles: RadarTile[];
  gridCols: number;
  gridRows: number;
  lat: number;
  lon: number;
  zoom: number;
  /** Marker position within the map container (percent). */
  marker: { x: number; y: number };
  isFallback: boolean;
  fetchedAt: string;
  message?: string;
};

const RADAR_CACHE_KEY = "weather:radar:v2";
const GRID_COLS = 3;
const GRID_ROWS = 2;
const ZOOM = 9;
const TILE_SIZE = 256;

/** Carto Voyager — roads, labels, landmarks; dashboard-friendly contrast. */
const BASE_MAP_TEMPLATE =
  "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

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

function latLonToPixel(lat: number, lon: number, zoom: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const scale = 2 ** zoom * TILE_SIZE;
  const x = ((lon + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function buildBaseMapUrl(zoom: number, x: number, y: number): string {
  return BASE_MAP_TEMPLATE.replace("{z}", String(zoom))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

function buildRadarTileUrl(
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

function buildTileGrid(lat: number, lon: number, zoom: number) {
  const center = latLonToTile(lat, lon, zoom);
  const startX = center.x - Math.floor(GRID_COLS / 2);
  const startY = center.y - Math.floor(GRID_ROWS / 2);

  const baseTiles: RadarTile[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const x = startX + col;
      const y = startY + row;
      baseTiles.push({
        x,
        y,
        baseMapUrl: buildBaseMapUrl(zoom, x, y)
      });
    }
  }

  const gridLeft = startX * TILE_SIZE;
  const gridTop = startY * TILE_SIZE;
  const gridW = GRID_COLS * TILE_SIZE;
  const gridH = GRID_ROWS * TILE_SIZE;
  const px = latLonToPixel(lat, lon, zoom);

  const marker = {
    x: Math.min(100, Math.max(0, ((px.x - gridLeft) / gridW) * 100)),
    y: Math.min(100, Math.max(0, ((px.y - gridTop) / gridH) * 100))
  };

  return { baseTiles, startX, startY, marker };
}

export async function getWeatherRadar(): Promise<RadarPayload> {
  const settings = await loadSettings();
  const lat = settings.location.lat;
  const lon = settings.location.lon;
  const refreshMs = Math.max(
    30,
    (settings.display.weatherRadarRefreshSeconds ?? 60) * 1000
  );

  const { baseTiles, startX, startY, marker } = buildTileGrid(lat, lon, ZOOM);

  const fallback: RadarPayload = {
    frames: [],
    baseTiles,
    gridCols: GRID_COLS,
    gridRows: GRID_ROWS,
    lat,
    lon,
    zoom: ZOOM,
    marker,
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
    const recent = past.slice(-12);

    const frames: RadarFrame[] = recent
      .filter((f) => f.path && Number.isFinite(f.time))
      .map((f) => {
        const tiles: RadarFrameTile[] = [];
        for (let row = 0; row < GRID_ROWS; row++) {
          for (let col = 0; col < GRID_COLS; col++) {
            const x = startX + col;
            const y = startY + row;
            tiles.push({
              x,
              y,
              url: buildRadarTileUrl(host, f.path, ZOOM, x, y)
            });
          }
        }
        return { time: f.time, tiles };
      });

    if (frames.length === 0) {
      setInCache(RADAR_CACHE_KEY, fallback, Math.min(refreshMs, 60_000));
      return fallback;
    }

    const payload: RadarPayload = {
      frames,
      baseTiles,
      gridCols: GRID_COLS,
      gridRows: GRID_ROWS,
      lat,
      lon,
      zoom: ZOOM,
      marker,
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
