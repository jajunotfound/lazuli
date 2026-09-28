import { defineConfig, type Plugin } from 'vite'

// Strip comments and indentation from the /* glsl */ template literals in the build. Line
// breaks stay, so preprocessor lines (#define, #ifdef) keep working.
function glslMinify(): Plugin {
  return {
    name: 'lazuli-glsl-minify',
    // Before the TypeScript transform, which drops the /* glsl */ markers.
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/shader.ts')) return null
      const out = code.replace(/\/\* glsl \*\/ `([^`]*)`/g, (_, src: string) => {
        const lines = src
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .split('\n')
          .map((l) => l.replace(/\/\/.*$/, '').trim().replace(/\s+/g, ' '))
          .filter(Boolean)
        return '`' + lines.join('\n') + '`'
      })
      return { code: out, map: null }
    },
  }
}

// Two builds from one config:
//   default      → ESM: dist/lazuli.js (API), dist/element.js (registers <lazuli-bg>), dist/capture.js (PNG)
//   --mode iife  → dist/lazuli.global.js, one file for a <script> tag (window.Lazuli)
export default defineConfig(({ mode }) => {
  const iife = mode === 'iife'
  return {
    plugins: [glslMinify()],
    build: {
      target: 'es2020',
      sourcemap: true,
      emptyOutDir: !iife,
      rollupOptions: { output: { chunkFileNames: 'core.js' } },
      lib: iife
        ? { entry: 'src/element-define.ts', formats: ['iife'], name: 'Lazuli', fileName: () => 'lazuli.global.js' }
        : {
            entry: { lazuli: 'src/index.ts', element: 'src/element-define.ts', capture: 'src/capture-entry.ts' },
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`,
          },
    },
  }
})
