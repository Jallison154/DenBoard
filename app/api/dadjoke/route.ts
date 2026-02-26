import { NextResponse } from "next/server";
import { getDadJoke } from "@/lib/dadJoke";

export async function GET() {
  try {
    const payload = await getDadJoke();
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        joke: "Couldn't load a dad joke right now.",
        isFallback: true
      },
      { status: 200 }
    );
  }
}

