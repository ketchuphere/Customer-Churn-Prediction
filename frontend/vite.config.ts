import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
    proxy: {
      "/predict":   { target: "http://localhost:8000", changeOrigin: true },
      "/health":    { target: "http://localhost:8000", changeOrigin: true },
      "/model-info":{ target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
