import { resolve } from "node:path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// import { analyzer } from "vite-bundle-analyzer";

// Backend to proxy /api and /socket.io to, overridden by the e2e stack
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact(),
    // analyzer(),
  ],
  test: {
    globals: true,
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("mobx")) {
              return "mobx-vendor";
            }
            if (id.includes("i18next")) {
              return "i18next-vendor";
            }
            if (id.includes("@mui")) {
              return "mui-vendor";
            }
            if (id.includes("react")) {
              return "react-vendor";
            }
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    allowedHosts: ["nerc-volunteers.itmo.ru"],
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: apiTarget,
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
});
