import { NextResponse } from "next/server";
import { getCalendar } from "@/lib/calendar";

export async function GET() {
  try {
    const payload = await getCalendar();
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

