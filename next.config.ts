import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle, needed to embed Next.js inside Electron
  // without shipping the entire node_modules tree.
  output: "standalone",
};

export default nextConfig;
