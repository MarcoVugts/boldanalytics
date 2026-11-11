import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The story's OG image reads these files at request time; make sure they ship with the function.
  outputFileTracingIncludes: {
    "/dashboards/tokenized-stocks/opengraph-image": ["./assets/fonts/**", "./public/brand/logo-horizontal.svg"],
  },
  partialPrefetching: true,
  // Old story URLs (shared on X/LinkedIn) keep working.
  async redirects() {
    return [
      // only page URLs: media files also live under /stories/record-day
      { source: "/stories", destination: "/dashboards", permanent: true },
      { source: "/stories/tokenized-stocks", destination: "/dashboards/tokenized-stocks", permanent: true },
      { source: "/dashboards/tokenized-stocks/liquidity-flow", destination: "/dashboards/tokenized-stocks/order-flow", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
