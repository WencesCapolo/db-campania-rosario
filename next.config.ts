import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stable in Next 16, so it moved out of `experimental`.
  reactCompiler: true,
};

export default nextConfig;
