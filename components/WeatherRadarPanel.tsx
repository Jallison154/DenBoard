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
import { useDisplaySettings, usePolling, usePrefersReducedMotion } from "./hooks";

async function fetchRadar(): Promise<RadarPayload> {
  const res = await fetch("/api/weather/radar", { cache: "no-store" });
  if (!res.ok) throw new Error("Radar unavailable");
  return res.json();
}

function formatRadarTime(epochSec: number) {
  try {
    return new Date(epochSec * 1000).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

const HEIGHT_STYLES = {
  compact: "clamp(176px, min(22vmin, 28vh), 400px)",
  standard: "clamp(240px, min(30vmin, 40vh), 560px)"
} as const;

type Props = {
  className?: string;
};

export function WeatherRadarPanel({ className }: Props) {
  const display = useDisplaySettings();
  const reducedMotion = usePrefersReducedMotion();
  const refreshSeconds = display.weatherRadarRefreshSeconds;
  const frameSeconds = display.weatherRadarFrameSeconds;
  const heightMode = display.weatherRadarHeight;
  const animate = display.weatherRadarAnimate && !reducedMotion;

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

  const [frameIndex, setFrameIndex] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [baseMapFailed, setBaseMapFailed] = useState(false);
  const [radarFailed, setRadarFailed] = useState(false);

  const frames = data?.frames ?? [];
  const latestIndex = Math.max(0, frames.length - 1);
  const displayIndex = animate
    ? frames.length > 0
      ? frameIndex % frames.length
      : 0
    : latestIndex;
  const currentFrame = frames[displayIndex];

  const mapHeight = HEIGHT_STYLES[heightMode] ?? HEIGHT_STYLES.compact;
  const showFallback =
    !loading && (data?.isFallback || frames.length === 0);
  const showRadarFallback = !showFallback && radarFailed && mapReady;

  useEffect(() => {
    setFrameIndex(latestIndex);
    setBaseMapFailed(false);
    setRadarFailed(false);
  }, [data?.fetchedAt, latestIndex]);

  useEffect(() => {
    if (!animate || frames.length < 2) return;
    const ms = Math.max(2, frameSeconds) * 1000;
    const id = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, ms);
    return () => clearInterval(id);
  }, [animate, frames.length, frameSeconds]);

  const radarReady = Boolean(data && !data.isFallback && frames.length > 0);

  // Initialise Leaflet map when radar data is available.
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
      if (!payload || payload.isFallback || payload.frames.length === 0) return;
      leafletRef.current = L;
      const frame = payload.frames[payload.frames.length - 1];

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
        setMapReady(false);
      }
    };
  }, [radarReady]);

  // Recentre when location/zoom changes after refresh.
  useEffect(() => {
    if (!mapRef.current || !data || data.isFallback) return;
    mapRef.current.setView([data.lat, data.lon], data.zoom, { animate: false });
    markerRef.current?.setLatLng([data.lat, data.lon]);
    mapRef.current.invalidateSize({ animate: false });
  }, [data?.lat, data?.lon, data?.zoom, data?.fetchedAt]);

  const radarPathRef = useRef<string | null>(null);

  // Swap radar frame layer when animating or on new data.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !data || !currentFrame || data.isFallback) return;

    const nextPath = currentFrame.path;
    if (radarPathRef.current === nextPath) return;
    radarPathRef.current = nextPath;

    const existing = radarLayerRef.current;
    if (existing) map.removeLayer(existing);

    const radar = L.tileLayer(radarTileUrlTemplate(data.host, nextPath), {
      maxNativeZoom: RADAR_MAX_NATIVE_ZOOM,
      maxZoom: MAX_ZOOM,
      opacity: 0.58,
      className: "denboard-radar-tile-layer",
      zIndex: 450
    });
    radar.on("tileerror", () => setRadarFailed(true));
    radar.addTo(map);
    radarLayerRef.current = radar;
  }, [currentFrame?.path, currentFrame?.time, data?.host, data?.isFallback]);

  useEffect(() => {
    mapRef.current?.invalidateSize({ animate: false });
  }, [heightMode, mapHeight]);

  return (
    <section
      className={`w-full min-w-0 flex flex-col denboard-radar-panel ${className ?? ""}`}
      aria-label="Weather radar"
    >
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h3
          className="uppercase tracking-[0.22em] denboard-text-secondary font-semibold"
          style={{ fontSize: "var(--denboard-scale-status)" }}
        >
          Radar
        </h3>
        {currentFrame && !showFallback && (
          <span
            className="denboard-text-secondary tabular-nums"
            style={{ fontSize: "var(--denboard-scale-status)" }}
          >
            {formatRadarTime(currentFrame.time)}
          </span>
        )}
      </div>

      <div
        className="denboard-radar-map relative w-full overflow-hidden rounded-2xl border border-white/10 denboard-card"
        style={{
          height: mapHeight,
          background: "rgba(15,23,42,0.92)"
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
              aria-hidden={showFallback}
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

      {!showFallback && (
        <p
          className="denboard-text-secondary text-center leading-snug opacity-50 shrink-0"
          style={{ fontSize: "calc(var(--denboard-scale-status) * 0.82)" }}
        >
          © OSM · CARTO · RainViewer
          {animate && frames.length > 1 && (
            <span className="opacity-90">
              {" "}
              · {frames.length} frames · refresh {refreshSeconds}s
            </span>
          )}
        </p>
      )}
    </section>
  );
}
