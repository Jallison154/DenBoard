import { NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";

export async function GET() {
  try {
    const payload = await getWeather();
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        temperatureCurrent: null,
        conditionCode: null,
        conditionText: null,
        isDay: true,
        sunrise: null,
        sunset: null,
        dailyForecast: [],
        alerts: [],
        overlay: null,
        units: null,
        isFallback: true,
        fetchedAt: new Date().toISOString()
      },
      { status: 200 }
    );
  }
}

