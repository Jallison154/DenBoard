import { NextResponse } from "next/server";
import { getWeatherDebug } from "@/lib/weather";

export async function GET() {
  try {
    const debugPayload = await getWeatherDebug();
    return NextResponse.json(debugPayload, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        mapped: null,
        rawProvider: null,
        units: null,
        fetchedAt: new Date().toISOString()
      },
      { status: 200 }
    );
  }
}

