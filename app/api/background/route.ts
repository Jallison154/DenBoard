import { NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";
import { getBackground } from "@/lib/background";

export async function GET() {
  try {
    const weather = await getWeather();
    const background = await getBackground(weather);
    return NextResponse.json(background, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        imageUrl: null,
        attribution: undefined,
        query: "mountain landscape calm minimal",
        isFallback: true
      },
      { status: 200 }
    );
  }
}

