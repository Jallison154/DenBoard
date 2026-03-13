/** @type {import('next').NextConfig} */
/** If DenBoard is served at a subpath (e.g. /denboard), set NEXT_PUBLIC_BASE_PATH=/denboard to fix 404s on CSS/JS assets. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/+$/, "") || undefined;

const nextConfig = {
  ...(basePath && { basePath }),
  reactStrictMode: true,
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
