import { NextRequest, NextResponse } from "next/server";
import { parseIcsMetadata } from "@/lib/calendar";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Missing url query parameter" },
      { status: 400 }
    );
  }
  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: "text/calendar" },
      next: { revalidate: 0 }
    });
    const text = await res.text();
    const meta = parseIcsMetadata(text);
    return NextResponse.json(meta, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
