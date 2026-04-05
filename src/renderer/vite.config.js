import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import javascriptObfuscator from 'vite-plugin-javascript-obfuscator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [
    react(),
    // Only obfuscate in production builds
    isProd && javascriptObfuscator({
      options: {
        compact: true,
        controlFlowFlattening: false, // disabled: too slow on large React bundles
        deadCodeInjection: false,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 8,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.5,
        stringArrayEncoding: ['rc4'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayThreshold: 0.5,
        unicodeEscapeSequence: false,
        target: 'browser',
      },
      // Only obfuscate our app code, not vendor chunks
      include: ['**/index-*.js'],
      exclude: ['**/react-*.js', '**/vendor-*.js'],
    }),
  ].filter(Boolean),
  server: {
    port: 5199,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
