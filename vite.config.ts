import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Plugin to import .py files as strings
function pythonPlugin() {
  return {
    name: 'python-loader',
    load(id: string) {
      if (id.endsWith('.py')) {
        const code = readFileSync(id, 'utf-8');
        return `export default ${JSON.stringify(code)};`;
      }
    }
  };
}

export default defineConfig({
  plugins: [pythonPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Pyomatting',
      fileName: (format) => `pyomatting.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['pyodide'],
      output: {
        globals: {
          pyodide: 'pyodide'
        }
      }
    }
  }
});
