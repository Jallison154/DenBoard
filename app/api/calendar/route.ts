import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/lib/calendar";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tz = searchParams.get("tz") ?? undefined;
    const now = searchParams.get("now") ?? undefined;
    const payload = await getCalendar({
      timezone: tz ?? undefined,
      nowOverride: now ?? undefined
    });
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        today: { allDay: [], timed: [] },
        grid: { days: [] },
        isFallback: true
      },
      { status: 200 }
    );
  }
}

