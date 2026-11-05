import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
// Served under a subpath (e.g. /denboard)? Set NEXT_PUBLIC_BASE_PATH=/denboard at build time.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/+$/, "") || undefined;

const nextConfig = {
  ...(basePath && { basePath }),
  output: "standalone",
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  reactStrictMode: true,
  // Keep V1 bookmarks on the TVs working
  async redirects() {
    return [
      { source: "/portrait/home", destination: "/", permanent: false },
      { source: "/tv/home", destination: "/landscape", permanent: false },
      { source: "/landscape/home", destination: "/landscape", permanent: false },
      { source: "/nest/home", destination: "/nest", permanent: false },
      { source: "/display/nest", destination: "/nest", permanent: false }
    ];
  },
  // Let Home Assistant iframe DenBoard, e.g. DENBOARD_FRAME_ANCESTORS="'self' https://hass.example.com"
  async headers() {
    const ancestors = process.env.DENBOARD_FRAME_ANCESTORS?.trim();
    if (!ancestors) return [];
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${ancestors}` }] }];
  }
};

export default nextConfig;
