import { NextResponse } from "next/server";
import { bumpClientRefreshEpoch, loadSettings } from "@/lib/settings";

export async function GET() {
  const settings = await loadSettings({ force: true });
  return NextResponse.json(
    { epoch: settings.display.clientRefreshEpoch ?? 0 },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST() {
  try {
    const epoch = await bumpClientRefreshEpoch();
    return NextResponse.json({ ok: true, epoch }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to bump refresh epoch";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
