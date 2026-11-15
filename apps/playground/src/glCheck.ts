// Code layers run your GLSL as written, so an edit only applies once the shader compiles. This
// compiles the stack's fragment shader on a small offscreen context and maps an error back to
// a line of the layer's function.

import { stackFragment, type Stack } from 'lazuli-bg'

let gl: WebGLRenderingContext | null | undefined

export interface ShaderError {
  /** The code layer's function name, when the error is inside one. */
  name: string | null
  /** 1-based line within that function's body. */
  line: number
  message: string
}

export function shaderError(s: Stack): ShaderError | null {
  if (!s.shapes.some((x) => x.kind === 'drawn' && x.visible && x.geom.kind === 'code')) return null
  if (gl === undefined) gl = document.createElement('canvas').getContext('webgl')
  if (!gl) return null // no WebGL here: the engine shows the fallback anyway
  const src = stackFragment(s)
  const sh = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS)
  const log = ok ? '' : (gl.getShaderInfoLog(sh) ?? '')
  gl.deleteShader(sh)
  if (ok) return null
  const m = /ERROR:\s*\d+:(\d+):\s*(.*)/.exec(log)
  const at = m ? Number(m[1]) : 0
  const message = (m?.[2] ?? log.split('\n')[0] ?? 'This doesn’t compile').replace(/^'([^']*)'\s*:\s*/, '$1: ').trim()
  // The last "// code: name" marker above the error line names the function.
  const lines = src.split('\n')
  for (let i = Math.min(at, lines.length) - 1; i >= 0; i--) {
    const mark = /^\/\/ code: (\w+)$/.exec(lines[i])
    if (mark) return { name: mark[1], line: at - (i + 1), message }
    if (/^float drawn_\d+\(/.test(lines[i])) break
  }
  return { name: null, line: 1, message }
}
