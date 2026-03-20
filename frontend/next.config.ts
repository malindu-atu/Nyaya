import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the backend URL to be configured at build time for static exports
  env: {
    NYAYA_BACKEND_URL: process.env.NYAYA_BACKEND_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
