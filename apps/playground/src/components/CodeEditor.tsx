import { cpp } from '@codemirror/lang-cpp'
import { setDiagnostics } from '@codemirror/lint'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import type { Stack } from 'lazuli-bg'
import { useEffect, useRef } from 'react'
import { applyCode, readCode, writeCode } from '../canvasCode'
import { shaderError } from '../glCheck'

interface CodeEditorProps {
  stack: Stack
  /** A valid edit: the stack it describes. */
  onApply(next: Stack): void
  /** For Copy: the editor's current text. */
  textRef?: React.MutableRefObject<() => string>
}

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px', backgroundColor: 'var(--code-bg)', color: 'var(--ink-90)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '2' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--ink-40)', border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 14px 0 12px', minWidth: '28px' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--row)' },
  '.cm-content': { caretColor: 'var(--accent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent) !important' },
  '.cm-foldGutter': { display: 'none' },
})

const NUMBER = /-?\d*\.?\d+(e-?\d+)?/g

/**
 * The canvas as editable code. Typing applies as soon as the code reads cleanly; a line Lazuli
 * can't read is underlined and the canvas keeps the last good version. Alt-drag on a number
 * slides it. Edits from the canvas rewrite the text (unless they came from here).
 */
export function CodeEditor({ stack, onApply, textRef }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const stackRef = useRef(stack)
  stackRef.current = stack
  const applyRef = useRef(onApply)
  applyRef.current = onApply
  // The text this editor last turned into a stack: a stack change matching it came from here.
  const echo = useRef<string | null>(null)
  // Set while the canvas rewrites the text, so that rewrite isn't read back as an edit.
  const external = useRef(false)

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: writeCode(stackRef.current),
        extensions: [
          basicSetup,
          cpp(),
          theme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (!u.docChanged || external.current) return
            const text = u.state.doc.toString()
            const r = readCode(text)
            if ('error' in r) {
              const line = u.state.doc.line(Math.min(r.error.line, u.state.doc.lines))
              u.view.dispatch(setDiagnostics(u.state, [{ from: line.from, to: Math.max(line.to, line.from + 1), severity: 'error', message: r.error.message }]))
              return
            }
            const next = applyCode(stackRef.current, r.code)
            // Your own GLSL has to compile before the canvas takes it.
            const bad = shaderError(next)
            if (bad) {
              const doc = u.state.doc
              let at = 1
              for (let n = 1; n <= doc.lines; n++) {
                if (bad.name && new RegExp(`^\\s*float\\s+${bad.name}\\s*\\(`).test(doc.line(n).text)) {
                  at = Math.min(n + Math.max(bad.line, 1), doc.lines)
                  break
                }
              }
              const line = doc.line(at)
              u.view.dispatch(setDiagnostics(u.state, [{ from: line.from, to: Math.max(line.to, line.from + 1), severity: 'error', message: bad.message }]))
              return
            }
            u.view.dispatch(setDiagnostics(u.state, []))
            echo.current = writeCode(next)
            applyRef.current(next)
          }),
          EditorView.domEventHandlers({
            // Alt-drag a number to slide it.
            mousedown(e, v) {
              if (!e.altKey) return false
              const pos = v.posAtCoords({ x: e.clientX, y: e.clientY })
              if (pos === null) return false
              const line = v.state.doc.lineAt(pos)
              let hit: { from: number; to: number; value: number } | null = null
              for (const m of line.text.matchAll(NUMBER)) {
                const from = line.from + m.index!
                if (pos >= from && pos <= from + m[0].length) hit = { from, to: from + m[0].length, value: Number(m[0]) }
              }
              if (!hit) return false
              e.preventDefault()
              const start = e.clientX
              const decimals = Math.max(2, (String(hit.value).split('.')[1] ?? '').length)
              let range = { from: hit.from, to: hit.to }
              const move = (ev: MouseEvent) => {
                const text = (hit!.value + (ev.clientX - start) * 0.002).toFixed(decimals)
                v.dispatch({ changes: { from: range.from, to: range.to, insert: text }, userEvent: 'input.scrub' })
                range = { from: range.from, to: range.from + text.length }
              }
              const up = () => {
                removeEventListener('mousemove', move)
                removeEventListener('mouseup', up)
              }
              addEventListener('mousemove', move)
              addEventListener('mouseup', up)
              return true
            },
          }),
        ],
      }),
    })
    view.current = v
    if (textRef) textRef.current = () => v.state.doc.toString()
    return () => {
      v.destroy()
      view.current = null
    }
    // The editor is made once; later changes arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The canvas changed: rewrite the text, unless this editor caused the change.
  useEffect(() => {
    const v = view.current
    if (!v) return
    const text = writeCode(stack)
    if (text === echo.current) return
    echo.current = null
    if (text === v.state.doc.toString()) return
    const head = Math.min(v.state.selection.main.head, text.length)
    external.current = true
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text }, selection: { anchor: head } })
    v.dispatch(setDiagnostics(v.state, []))
    external.current = false
  }, [stack])

  return <div className="code-editor" ref={host} />
}
