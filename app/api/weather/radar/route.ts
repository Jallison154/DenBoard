import { NextResponse } from "next/server";
import { getWeatherRadar } from "@/lib/radar";
import { loadSettings } from "@/lib/settings";
import { DEFAULT_ZOOM, RADAR_MAX_NATIVE_ZOOM } from "@/lib/radar";

export async function GET() {
  try {
    const payload = await getWeatherRadar();
    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (e) {
    const settings = await loadSettings();
    const message = e instanceof Error ? e.message : "Radar unavailable";
    return NextResponse.json(
      {
        host: "https://tilecache.rainviewer.com",
        frames: [],
        lat: settings.location.lat,
        lon: settings.location.lon,
        zoom: DEFAULT_ZOOM,
        radarZoom: RADAR_MAX_NATIVE_ZOOM,
        isFallback: true,
        fetchedAt: new Date().toISOString(),
        message
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
