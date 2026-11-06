import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stable in Next 16, so it moved out of `experimental`.
  reactCompiler: true,

  // Reads and writes `.xlsx` on the server only (ADR 0017). Left to Node's own
  // `require` rather than bundled: it is CommonJS with optional dependencies the
  // bundler would otherwise go looking for.
  serverExternalPackages: ["exceljs"],

  experimental: {
    // A planilla travels in a server action, and the default is 1 MB. The
    // service refuses anything over 2 MB with a sentence; this only has to let
    // it arrive so that it can (ADR 0017).
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
