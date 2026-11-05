import { getHub } from "@/lib/server/hub";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = getHub().snapshot;
  return Response.json({
    ok: true,
    homeAssistant: { configured: s.ha.configured, connected: s.ha.connected, entities: Object.keys(s.ha.entities).length },
    calendar: s.calendar ? { events: s.calendar.events.length, error: s.calendar.error ?? null, updatedAt: s.calendar.updatedAt } : null,
    weather: s.weather ? { updatedAt: s.weather.updatedAt, precipSoon: s.weather.precipSoon } : null,
    radar: !!s.radar,
    fun: s.fun?.items.length ?? 0
  });
}
