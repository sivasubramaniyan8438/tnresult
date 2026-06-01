import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next dev-tools floating portal ("1 ISSUE" / build indicator chip).
  // Suppressed even in dev — broadcast laptops sometimes run dev for staging
  // and a debug chip on screen would be embarrassing on air.
  devIndicators: false,
};

export default nextConfig;
