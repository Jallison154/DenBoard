/** @type {import('next').NextConfig} */
/** If DenBoard is served at a subpath (e.g. /denboard), set NEXT_PUBLIC_BASE_PATH=/denboard to fix 404s on CSS/JS assets. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/+$/, "") || undefined;

const nextConfig = {
  ...(basePath && { basePath }),
  reactStrictMode: true,
  /**
   * Optional CSP allowing Home Assistant (or other parents) to iframe DenBoard.
   * Example: DENBOARD_FRAME_ANCESTORS="'self' https://homeassistant.local:8123"
   * See docs/EMBEDDED-CAST.md
   */
  async headers() {
    const ancestors = process.env.DENBOARD_FRAME_ANCESTORS?.trim();
    if (!ancestors) return [];
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${ancestors}`
          }
        ]
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**"
      }
    ]
  },
  logging: {
    fetches: {
      fullUrl: false
    }
  }
};

export default nextConfig;
