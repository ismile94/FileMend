import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/ 
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // PDF.js için optimize ayarları
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    // PDF worker dosyalarını assets olarak işle
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Büyük PDF dosyaları için limit
    fs: {
      strict: false,
    },
  },
});