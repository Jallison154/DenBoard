import { NextResponse } from "next/server";
import { getWeatherRadar } from "@/lib/radar";

export async function GET() {
  try {
    const payload = await getWeatherRadar();
    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Radar unavailable";
    return NextResponse.json(
      {
        frames: [],
        lat: 0,
        lon: 0,
        zoom: 7,
        isFallback: true,
        fetchedAt: new Date().toISOString(),
        message
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
