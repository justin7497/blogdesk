import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "firebase-admin",
    "ffmpeg-static",
    "ffprobe-static",
    "@napi-rs/canvas",
    "web-push",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
  },
};

export default nextConfig;
