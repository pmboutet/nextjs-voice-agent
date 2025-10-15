import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nuffieldhealth.com",
        pathname: "/assets/dist/images/**",
      },
    ],
  },
};

export default nextConfig;
