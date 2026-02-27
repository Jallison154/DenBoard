import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  loadSettings,
  saveSettings,
  validateSettings,
  type DenBoardSettings
} from "@/lib/settings";

const ADMIN_COOKIE_NAME = "denboard_admin";

function isAdmin() {
  const cookieStore = cookies();
  const flag = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return flag === "1";
}

export async function GET() {
  const settings = await loadSettings();
  return NextResponse.json(settings, { status: 200 });
}

export async function PUT(req: Request) {
  if (!isAdmin()) {
    return NextResponse.json(
      { ok: false, error: "Not authorized. Please enter the admin PIN." },
      { status: 401 }
    );
  }

  let body: Partial<DenBoardSettings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const current = await loadSettings();
  const merged: DenBoardSettings = {
    ...current,
    ...body,
    location: { ...current.location, ...(body.location || {}) },
    unsplash: { ...current.unsplash, ...(body.unsplash || {}) },
    weather: { ...current.weather, ...(body.weather || {}) },
    calendar: {
      ...current.calendar,
      ...(body.calendar || {}),
      calendars:
        body.calendar?.calendars && body.calendar.calendars.length > 0
          ? body.calendar.calendars
          : current.calendar.calendars
    },
    homeAssistant: {
      ...current.homeAssistant,
      ...(body.homeAssistant || {}),
      entities:
        body.homeAssistant?.entities && body.homeAssistant.entities.length > 0
          ? body.homeAssistant.entities
          : current.homeAssistant.entities
    },
    display: { ...current.display, ...(body.display || {}) }
  };

  const validation = validateSettings(merged);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, errors: validation.errors },
      { status: 400 }
    );
  }

  await saveSettings(merged);
  return NextResponse.json({ ok: true, settings: merged }, { status: 200 });
}

