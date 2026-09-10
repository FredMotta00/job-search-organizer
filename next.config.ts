import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  poweredByHeader: false,
};

export default nextConfig;
