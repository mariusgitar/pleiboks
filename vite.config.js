import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Pleiboks",
        short_name: "Pleiboks",
        description: "En enkel musikkspiller for barn",
        theme_color: "#AEE4FF",
        background_color: "#AEE4FF",
        display: "fullscreen",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        navigateFallbackDenylist: [/^\/api\//],
        // Coverbilder fra NRK caches så de vises uten nett
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) => request.destination === "image" && !sameOrigin,
            handler: "CacheFirst",
            options: {
              cacheName: "pleiboks-covers",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
});
