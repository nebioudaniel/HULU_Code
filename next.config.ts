import type { NextConfig } from "next";

const isDocker = process.env.BUILD_TARGET === "docker";
const isCloudflare = process.env.CF_BUILD === "1";
const dbDriver =
  !isCloudflare && process.env.DB_DRIVER === "pg" ? "pg" : "neon";

const nextConfig: NextConfig = {
  output: isDocker ? "standalone" : undefined,
  env: {
    DB_DRIVER: dbDriver,
  },
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
