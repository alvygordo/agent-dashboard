import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
