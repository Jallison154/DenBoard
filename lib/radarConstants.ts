/**
 * Client-safe radar constants and helpers (no Node/fs imports).
 */

export const MIN_ZOOM = 4;
export const MAX_ZOOM = 10;
export const RADAR_MAX_NATIVE_ZOOM = 7;
/** Display zoom — slightly closer view; radar tiles upscale from z7 via maxNativeZoom. */
export const DEFAULT_ZOOM = 8;
export const RADAR_COLOR = 2;
export const RADAR_TILE_SIZE = 256;

/** Carto Dark Matter — dark dashboard-friendly base map. */
export const DARK_BASE_MAP_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export type RadarFrame = {
  time: number;
  path: string;
};

export type RadarPayload = {
  host: string;
  frames: RadarFrame[];
  lat: number;
  lon: number;
  zoom: number;
  radarZoom: number;
  isFallback: boolean;
  fetchedAt: string;
  message?: string;
};

/** Build a RainViewer tile-layer URL template for Leaflet. */
export function radarTileUrlTemplate(host: string, path: string): string {
  const base = host.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}/${RADAR_TILE_SIZE}/{z}/{x}/{y}/${RADAR_COLOR}/1_1.png`;
}
