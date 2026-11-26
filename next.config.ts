import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH ?? (isGitHubPages ? "/sentrine" : "");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isGitHubPages
    ? {
        output: "export",
        basePath,
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
        env: {
          NEXT_PUBLIC_STATIC_EXPORT: "true",
          NEXT_PUBLIC_BASE_PATH: basePath,
        },
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
        outputFileTracingIncludes: {
          "/api/**": ["./public/demo_feedback.csv"],
        },
      }),
};

export default nextConfig;
