import { NextResponse } from "next/server";
import { getCalendarDebug } from "@/lib/calendar";

export async function GET() {
  try {
    const debugPayload = await getCalendarDebug();
    return NextResponse.json(debugPayload, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        icsUrls: [],
        timezone: "",
        fetchResults: [],
        todayCount: 0,
        gridEventCount: 0,
        payload: null,
        fetchedAt: new Date().toISOString()
      },
      { status: 200 }
    );
  }
}
