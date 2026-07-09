"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, TileLayer, Marker } from "leaflet";
import type { RadarPayload } from "@/lib/radarConstants";
import {
  DARK_BASE_MAP_URL,
  MAX_ZOOM,
  MIN_ZOOM,
  RADAR_MAX_NATIVE_ZOOM,
  radarTileUrlTemplate
} from "@/lib/radarConstants";
import { useDisplaySettings, usePolling } from "./hooks";

async function fetchRadar(): Promise<RadarPayload> {
  const res = await fetch("/api/weather/radar", { cache: "no-store" });
  if (!res.ok) throw new Error("Radar unavailable");
  return res.json();
}

const HEIGHT_STYLES = {
  compact: "clamp(140px, min(18vmin, 22vh), 320px)",
  standard: "clamp(200px, min(26vmin, 32vh), 440px)"
} as const;

type Props = {
  className?: string;
  /** Flush inside the weather card — no header, border, or footer. */
  embedded?: boolean;
};

export function WeatherRadarPanel({ className, embedded }: Props) {
  const display = useDisplaySettings();
  const refreshSeconds = display.weatherRadarRefreshSeconds;
  const heightMode = display.weatherRadarHeight;

  const fetcher = useCallback(fetchRadar, []);
  const { data, loading } = usePolling<RadarPayload>(fetcher, {
    intervalMs: Math.max(30, refreshSeconds) * 1000,
    immediate: true
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const radarLayerRef = useRef<TileLayer | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const radarTimeRef = useRef<number | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [baseMapFailed, setBaseMapFailed] = useState(false);
  const [radarFailed, setRadarFailed] = useState(false);

  const latestFrame = data?.frames?.[data.frames.length - 1] ?? null;

  const mapHeight = HEIGHT_STYLES[heightMode] ?? HEIGHT_STYLES.compact;
  const showFallback = !loading && (data?.isFallback || !latestFrame);
  const showRadarFallback = !showFallback && radarFailed && mapReady;
  const radarReady = Boolean(data && !data.isFallback && latestFrame);

  useEffect(() => {
    if (!radarReady) return;
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let onResize: (() => void) | null = null;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      const payload = data;
      const frame = payload?.frames?.[payload.frames.length - 1];
      if (!payload || !frame || payload.isFallback) return;

      leafletRef.current = L;
      radarTimeRef.current = frame.time;

      const map = L.map(el, {
        center: [payload.lat, payload.lon],
        zoom: payload.zoom,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        dragging: false,
        touchZoom: false
      });

      const base = L.tileLayer(DARK_BASE_MAP_URL, {
        subdomains: "abcd",
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      });
      base.on("tileerror", () => setBaseMapFailed(true));
      base.addTo(map);
      baseLayerRef.current = base;

      const radar = L.tileLayer(radarTileUrlTemplate(payload.host, frame.path), {
        maxNativeZoom: RADAR_MAX_NATIVE_ZOOM,
        maxZoom: MAX_ZOOM,
        opacity: 0.58,
        className: "denboard-radar-tile-layer",
        zIndex: 450
      });
      radar.on("tileerror", () => setRadarFailed(true));
      radar.addTo(map);
      radarLayerRef.current = radar;

      const marker = L.marker([payload.lat, payload.lon], {
        icon: L.divIcon({
          className: "denboard-radar-marker",
          html: `<span class="denboard-radar-marker-dot"></span><span class="denboard-radar-marker-stem"></span>`,
          iconSize: [16, 22],
          iconAnchor: [8, 22]
        }),
        interactive: false,
        zIndexOffset: 1000
      });
      marker.addTo(map);
      markerRef.current = marker;

      mapRef.current = map;

      const invalidate = () => {
        mapRef.current?.invalidateSize({ animate: false });
      };

      requestAnimationFrame(invalidate);
      setTimeout(invalidate, 120);
      setTimeout(invalidate, 400);

      resizeObserver = new ResizeObserver(() => invalidate());
      resizeObserver.observe(el);
      onResize = invalidate;
      window.addEventListener("resize", invalidate);
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (onResize) window.removeEventListener("resize", onResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        baseLayerRef.current = null;
        radarLayerRef.current = null;
        markerRef.current = null;
        leafletRef.current = null;
        radarTimeRef.current = null;
        setMapReady(false);
      }
    };
  }, [radarReady]);

  useEffect(() => {
    if (!mapRef.current || !data || data.isFallback) return;
    mapRef.current.setView([data.lat, data.lon], data.zoom, { animate: false });
    markerRef.current?.setLatLng([data.lat, data.lon]);
    mapRef.current.invalidateSize({ animate: false });
  }, [data?.lat, data?.lon, data?.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !data || !latestFrame || data.isFallback) return;

    const nextTime = latestFrame.time;
    if (radarTimeRef.current === nextTime) return;
    radarTimeRef.current = nextTime;

    const existing = radarLayerRef.current;
    if (existing) map.removeLayer(existing);

    const radar = L.tileLayer(radarTileUrlTemplate(data.host, latestFrame.path), {
      maxNativeZoom: RADAR_MAX_NATIVE_ZOOM,
      maxZoom: MAX_ZOOM,
      opacity: 0.58,
      className: "denboard-radar-tile-layer",
      zIndex: 450
    });
    radar.on("tileerror", () => setRadarFailed(true));
    radar.addTo(map);
    radarLayerRef.current = radar;
    setRadarFailed(false);
  }, [latestFrame?.time, latestFrame?.path, data?.host, data?.isFallback]);

  useEffect(() => {
    mapRef.current?.invalidateSize({ animate: false });
  }, [heightMode, mapHeight, embedded]);

  return (
    <div
      className={`w-full min-w-0 denboard-radar-panel ${embedded ? "denboard-radar-embedded" : "flex flex-col"} ${className ?? ""}`}
      aria-label="Weather radar map"
    >
      <div
        className={`denboard-radar-map relative w-full overflow-hidden ${
          embedded
            ? "border-t border-white/10"
            : "rounded-2xl border border-white/10 denboard-card"
        }`}
        style={{
          height: mapHeight,
          background: embedded ? "rgba(8,12,22,0.88)" : "rgba(15,23,42,0.92)"
        }}
      >
        {loading && !data ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center denboard-text-secondary denboard-scale-status">
            Loading radar…
          </div>
        ) : showFallback ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-4 text-center denboard-text-secondary denboard-scale-status">
            <span>Radar unavailable</span>
            {data?.message && (
              <span className="opacity-80 max-w-sm leading-snug">{data.message}</span>
            )}
          </div>
        ) : (
          <>
            <div
              ref={mapContainerRef}
              className="absolute inset-0 z-0 h-full w-full"
            />
            <div
              className="pointer-events-none absolute inset-0 z-[5] denboard-radar-scrim"
              aria-hidden
            />
            {showRadarFallback && (
              <div className="absolute bottom-2 left-2 right-2 z-20 rounded-lg bg-black/60 px-2 py-1 text-center denboard-text-secondary denboard-scale-status backdrop-blur-sm">
                Radar overlay unavailable — showing map only
              </div>
            )}
            {baseMapFailed && (
              <div className="absolute top-2 left-2 right-2 z-20 rounded-lg bg-black/60 px-2 py-1 text-center denboard-text-secondary denboard-scale-status backdrop-blur-sm">
                Map tiles could not be loaded
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
