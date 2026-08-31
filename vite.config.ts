import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        browser: 'src/browser.ts',
      },
      formats: ['es'],
      fileName: (_format, entryName) => (entryName === 'index' ? 'node-lbx.js' : `${entryName}.js`),
    },
    rollupOptions: {
      external: ['adm-zip', 'node:fs', 'node:path'],
    },
    target: 'es2022',
  },
});
