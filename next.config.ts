import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The story's OG image reads these files at request time; make sure they ship with the function.
  outputFileTracingIncludes: {
    "/stories/tokenized-stocks/opengraph-image": ["./assets/fonts/**", "./public/brand/logo-horizontal.svg"],
  },
  partialPrefetching: true,
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
