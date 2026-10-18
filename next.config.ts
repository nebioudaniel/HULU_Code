import type { NextConfig } from "next";

const isDocker = process.env.BUILD_TARGET === "docker";

const nextConfig: NextConfig = {
  output: isDocker ? "standalone" : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
    mcpServer: false,
  },
  cacheComponents: true,
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
