import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Add turbopack config to acknowledge we're using it
  turbopack: {},
};

// PWA configuration menggunakan environment variable
// Service worker akan di-generate otomatis oleh workbox saat production build
if (process.env.NODE_ENV === 'production') {
  // You can add custom service worker logic here
}

export default nextConfig;
