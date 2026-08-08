import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
      {
        key: "Pragma",
        value: "no-cache",
      },
      {
        key: "Expires",
        value: "0",
      },
    ];

    return [
      { source: "/admin/:path*", headers: noStoreHeaders },
      { source: "/api/admin/:path*", headers: noStoreHeaders },
      { source: "/settings/:path*", headers: noStoreHeaders },
      { source: "/dashboard/:path*", headers: noStoreHeaders },
      { source: "/billing/:path*", headers: noStoreHeaders },
      { source: "/notifications/:path*", headers: noStoreHeaders },
      { source: "/support/:path*", headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
