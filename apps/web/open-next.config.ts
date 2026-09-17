import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Next.js on Cloudflare Workers (static assets + server rendering). ISR/data cache is
// off for the MVP; enable `incrementalCache` with R2 when pages start using caching.
export default defineCloudflareConfig({});
