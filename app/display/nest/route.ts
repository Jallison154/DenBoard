import { getStandaloneDisplayNestHtml } from "@/lib/standaloneDisplayNest";

/**
 * Standalone Nest/Cast display: plain HTML + inline script only.
 * Does not use the React app shell, router, or lazy chunks for this URL.
 */
export function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/+$/, "") || "";
  const html = getStandaloneDisplayNestHtml(base);

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
