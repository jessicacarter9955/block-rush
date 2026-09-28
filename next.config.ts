import type { NextConfig } from "next";

// GitHub Pages serve il sito in un sotto-percorso (/<repo>/): il basePath
// viene iniettato via NEXT_PUBLIC_BASE_PATH (anche nei path degli asset
// pubblici tramite src/lib/bp.ts) e non rompe il dev locale senza variabile.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
