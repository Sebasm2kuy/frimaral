import type { NextConfig } from "next";

// CALIRAL INSIGHT - Next.js config
// Soporta dos modos:
// - Dinámico (default): output standalone para Docker/Cloudflare con API Routes
// - Estático (NEXT_PUBLIC_STATIC_MODE=true): output export para GitHub Pages

const isStaticMode = process.env.NEXT_PUBLIC_STATIC_MODE === 'true';

const nextConfig: NextConfig = {
  // En modo estático usar 'export', en dinámico 'standalone'
  output: isStaticMode ? "export" : "standalone",

  // Necesario para GitHub Pages (no soporta imágenes optimizadas)
  images: isStaticMode ? { unoptimized: true } : undefined,

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
