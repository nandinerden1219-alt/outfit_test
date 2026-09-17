import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Signed image URLs come from the API Worker (short-lived); next/image is not used for them.
  images: { unoptimized: true },
  transpilePackages: ["@outfit/shared"],
};

// Lets `next dev` read Cloudflare bindings/vars from wrangler.toml (no-op in production builds).
initOpenNextCloudflareForDev();

export default nextConfig;
