import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inline route CSS so the authenticated first paint does not wait on stylesheet waterfalls.
  experimental: { inlineCss: true },
};

export default nextConfig;
