import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  poweredByHeader: false,
  experimental: { cpus: 1 },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};
export default config;
