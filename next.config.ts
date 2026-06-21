import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions are stable in 15; keep body limit sane for CSV imports.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
