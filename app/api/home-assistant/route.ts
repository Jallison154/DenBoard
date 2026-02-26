import { NextResponse } from "next/server";
import { getHomeAssistantState } from "@/lib/homeAssistant";

export async function GET() {
  try {
    const payload = await getHomeAssistantState();
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      { guestMode: false, entities: [], isFallback: true },
      { status: 200 }
    );
  }
}

