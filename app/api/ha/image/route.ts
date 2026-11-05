import { getHub } from "@/lib/server/hub";

export const dynamic = "force-dynamic";

/** Proxies media artwork / person photos from HA so the token never reaches the TV. */
export async function GET(req: Request) {
  const entity = new URL(req.url).searchParams.get("entity") || "";
  if (!/^[a-z_]+\.[a-z0-9_]+$/.test(entity)) return new Response("bad entity", { status: 400 });
  const hub = getHub();
  const url = hub.entityPicture(entity);
  if (!url) return new Response("no picture", { status: 404 });
  const token = process.env.HOME_ASSISTANT_TOKEN || "";
  const sameHost = hub.haBase() && url.startsWith(hub.haBase());
  try {
    const res = await fetch(url, {
      headers: sameHost && token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return new Response("upstream error", { status: 502 });
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
}
