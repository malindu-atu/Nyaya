import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the backend URL to be configured at build time for static exports
  env: {
    NYAYA_BACKEND_URL: process.env.NYAYA_BACKEND_URL ?? "http://localhost:8000",
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dvedihftsryhuulhdgjy.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;