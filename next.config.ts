import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext 1.0.0-beta.2 re-fetches inlined route styles during hydration.
  // Keep stylesheet links discoverable in the initial HTML instead.
  experimental: { inlineCss: false },
};

export default nextConfig;
