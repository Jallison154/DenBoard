import { NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";

export async function GET() {
  try {
    const payload = await getWeather();
    return NextResponse.json(payload, {
      status: 200
    });
  } catch {
    return NextResponse.json(
      {
        current: null,
        forecast: [],
        severeAlerts: [],
        overlay: null,
        isFallback: true
      },
      { status: 200 }
    );
  }
}

