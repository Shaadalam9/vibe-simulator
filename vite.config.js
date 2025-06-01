import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5175,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  }
}); 