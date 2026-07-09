import { NextResponse } from "next/server";
import { getWeatherRadar } from "@/lib/radar";
import { loadSettings } from "@/lib/settings";

export async function GET() {
  try {
    const payload = await getWeatherRadar();
    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (e) {
    const settings = await loadSettings();
    const lat = settings.location.lat;
    const lon = settings.location.lon;
    const message = e instanceof Error ? e.message : "Radar unavailable";
    return NextResponse.json(
      {
        frames: [],
        baseTiles: [],
        gridCols: 3,
        gridRows: 2,
        lat,
        lon,
        zoom: 9,
        marker: { x: 50, y: 50 },
        isFallback: true,
        fetchedAt: new Date().toISOString(),
        message
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
