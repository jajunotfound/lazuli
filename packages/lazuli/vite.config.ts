import { defineConfig } from 'vite'

// Two builds from one config:
//   default      → ESM: dist/lazuli.js (API) + dist/element.js (registers <lazuli-bg>)
//   --mode iife  → dist/lazuli.global.js, one file for a <script> tag (window.Lazuli)
export default defineConfig(({ mode }) => {
  const iife = mode === 'iife'
  return {
    build: {
      target: 'es2020',
      sourcemap: true,
      emptyOutDir: !iife,
      rollupOptions: { output: { chunkFileNames: 'core.js' } },
      lib: iife
        ? { entry: 'src/element-define.ts', formats: ['iife'], name: 'Lazuli', fileName: () => 'lazuli.global.js' }
        : {
            entry: { lazuli: 'src/index.ts', element: 'src/element-define.ts' },
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`,
          },
    },
  }
})
