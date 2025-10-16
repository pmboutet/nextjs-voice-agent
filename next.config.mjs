/** @type {import('next').NextConfig} */
const nextConfig = {
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
