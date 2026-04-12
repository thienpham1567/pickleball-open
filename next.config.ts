import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/bracket",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
