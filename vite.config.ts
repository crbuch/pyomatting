import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Ensure worker builds are ESM
  worker: {
    format: 'es'
  },
  
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Pyomatting',
      fileName: (format) => `pyomatting.${format}.js`,
      formats: ['es'] // Only ES modules to avoid IIFE/UMD issues with workers
    },
    rollupOptions: {
      external: ['pyodide']
    }
  }
});
