import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // certificate PDFs embed the logo at runtime; make sure it ships with the functions
  outputFileTracingIncludes: {
    "/*": ["./public/somentm-logo.png"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
