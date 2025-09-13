import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      plugins: [
        nodePolyfills(),
      ],
      define: {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'url': 'url',
        }
      },
      build: {
        target: 'esnext'
      },
      optimizeDeps: {
        esbuildOptions: {
          target: 'esnext'
        }
      },
      server: {}
    };
});
