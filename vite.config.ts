import path from 'path';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Heavy, rarely-needed libraries get their own chunks so they can be cached
// independently and loaded lazily where the importing code is lazy.
const VENDOR_CHUNKS: Record<string, string[]> = {
  react: ['react', 'react-dom', 'scheduler'],
  motion: ['framer-motion'],
  charts: ['chart.js', 'react-chartjs-2'],
  genai: ['@google/genai'],
  openapi: ['@apidevtools/swagger-parser'],
  curl: ['curlconverter', 'web-tree-sitter'],
  snippet: ['httpsnippet'],
  diff: ['diff', 'react-diff-view'],
};

export default defineConfig({
  plugins: [nodePolyfills()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      onwarn(warning, warn) {
        // framer-motion ships "use client" directives that are meaningless in a SPA bundle.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          for (const [chunk, pkgs] of Object.entries(VENDOR_CHUNKS)) {
            if (pkgs.some((p) => id.includes(`/node_modules/${p}/`))) return chunk;
          }
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
});
