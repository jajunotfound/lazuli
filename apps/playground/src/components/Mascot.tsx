import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react'

// Lazuli, the mascot. Values from the Paper artboard "lazuli" (669px body, oklab gradient, inset
// shadow, blur; 45×82 pill eyes 23px apart at 30.8% down), all as fractions of the size S.
// Motion spec: design/lazuli-motion.html.
export type Mood = 'idle' | 'look' | 'happy' | 'curious' | 'thinking' | 'sleepy' | 'surprised' | 'oops' | 'melt'

export interface MascotHandle {
  blink(): void
  squash(): void
  /** Force the gaze (−1…1 across the face), or null to let the mood drive it. */
  gaze(x: number | null, y?: number): void
  /** 0 = Lazuli, 1 = sunk into the canvas (eyes shut, blurred out). */
  dissolveTo(target: number, ms: number): Promise<void>
  setDissolve(v: number): void
}

interface MascotProps {
  size: number
  mood: Mood
  reduced?: boolean
  className?: string
  style?: CSSProperties
}

type Eye = { sx: number; sy: number; rot: number; lt: number; lb: number; dy: number; arc: number; slant: number }

const TAU = Math.PI * 2
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1)
const rand = (a: number, b: number) => a + Math.random() * (b - a)

export const Mascot = forwardRef<MascotHandle, MascotProps>(function Mascot({ size, mood, reduced = false, className = '', style }, ref) {
  const root = useRef<HTMLDivElement>(null)
  const s = useRef({
    mood,
    reduced,
    t0: performance.now(),
    nextBlink: performance.now() + 900,
    blinkAt: -1,
    secondBlink: -1,
    squashAt: -1,
    dis: 0,
    disAnim: null as null | { from: number; target: number; start: number; ms: number; done(): void },
    g: { x: 0, y: 0 },
    sac: { x: 0, y: 0, next: 0 },
    ptr: { x: 0, y: 0, active: false },
    forced: null as null | { x: number; y: number },
  })

  useEffect(() => {
    const st = s.current
    if (st.mood !== mood) {
      st.mood = mood
      st.t0 = performance.now()
      st.sac.next = 0
    }
    st.reduced = reduced
  }, [mood, reduced])

  useImperativeHandle(ref, () => ({
    blink: () => void (s.current.blinkAt = performance.now()),
    squash: () => void (s.current.squashAt = performance.now()),
    gaze: (x, y = 0) => void (s.current.forced = x === null ? null : { x, y }),
    dissolveTo: (target, ms) =>
      new Promise<void>((done) => {
        s.current.disAnim = { from: s.current.dis, target, start: performance.now(), ms, done }
      }),
    setDissolve: (v) => {
      s.current.dis = v
      s.current.disAnim = null
    },
  }))

  // Look follows the pointer anywhere on the page, relative to the eyes.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = root.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.37
      // Soft falloff so a pointer across the screen still reads as "over there".
      const dx = (e.clientX - cx) / (r.width * 1.1), dy = (e.clientY - cy) / r.height
      const k = Math.max(1, Math.hypot(dx, dy) ** 0.6)
      s.current.ptr = { x: clamp(dx / k, -1, 1), y: clamp(dy / k, -1, 1), active: true }
    }
    const onLeave = () => void (s.current.ptr.active = false)
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  useEffect(() => {
    const el = root.current!
    const body = el.querySelector<HTMLElement>('.lz__body')!
    const fill = el.querySelector<HTMLElement>('.lz__fill')!
    const shadow = el.querySelector<HTMLElement>('.lz__shadow')!
    const eyes = [...el.querySelectorAll<HTMLElement>('.lz__eye')]
    let lastFilter = ''
    const lastMask = ['', '']
    let raf = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const st = s.current
      const S = el.clientWidth || 1
      const t = (now - st.t0) / 1000
      const calm = st.reduced
      let x = 0, y = 0, r = 0, sx = 1, sy = 1
      let tx = 0, ty = 0, follow = 0.3
      const L: Eye = { sx: 1, sy: 1, rot: 0, lt: 0, lb: 0, dy: 0, arc: 0, slant: 0 }
      const R: Eye = { sx: 1, sy: 1, rot: 0, lt: 0, lb: 0, dy: 0, arc: 0, slant: 0 }
      let autoBlink = true

      if (st.disAnim) {
        const a = st.disAnim
        const k = clamp((now - a.start) / a.ms, 0, 1)
        st.dis = a.from + (a.target - a.from) * smooth(k)
        if (k >= 1) {
          st.disAnim = null
          a.done()
        }
      }
      const breathe = (period: number, amp: number) => {
        const b = Math.sin((TAU * t) / period) * (calm ? amp * 0.4 : amp)
        sx *= 1 + b
        sy *= 1 - b
      }
      const saccade = (rx: number, ry: number, centerBias = 0.35, minHold = 1200, maxHold = 2800) => {
        if (now > st.sac.next) {
          if (Math.random() < centerBias) st.sac = { x: rand(-0.12, 0.12), y: rand(-0.1, 0.1), next: 0 }
          else st.sac = { x: rand(-rx, rx), y: rand(-ry, ry), next: 0 }
          st.sac.next = now + rand(minHold, maxHold)
        }
        return st.sac
      }

      switch (st.mood) {
        case 'idle': {
          breathe(3.6, 0.012)
          const g = saccade(calm ? 0.25 : 0.6, calm ? 0.2 : 0.45)
          tx = g.x
          ty = g.y
          break
        }
        case 'look': {
          breathe(3.6, 0.012)
          if (st.ptr.active) {
            tx = st.ptr.x * 1.15
            ty = st.ptr.y * 1.15
          } else {
            const g = saccade(0.9, 0.7, 0.2, 700, 1600)
            tx = g.x
            ty = g.y
          }
          follow = 0.22
          const near = 1 - clamp(Math.hypot(st.ptr.x, st.ptr.y) / 0.3, 0, 1)
          if (st.ptr.active && near > 0) {
            L.sy = R.sy = 1 + 0.14 * near
            L.sx = R.sx = 1 + 0.1 * near
          }
          r = calm ? 0 : st.g.x * 6
          x = calm ? 0 : st.g.x * 0.025 * S
          y = st.g.y * 0.012 * S
          break
        }
        case 'happy': {
          autoBlink = false
          ty = -0.25
          L.arc = R.arc = 0.62
          L.sx = R.sx = 1.25
          L.sy = R.sy = 0.92
          if (calm) {
            breathe(2.4, 0.01)
            break
          }
          const c = (t * 1.6) % 1
          const hop = Math.sin(Math.PI * c)
          y = -hop * 0.12 * S
          if (c < 0.1 || c > 0.92) {
            sy = 0.9
            sx = 1.08
          } else {
            sy = 1 + 0.05 * hop
            sx = 1 - 0.03 * hop
          }
          L.dy = R.dy = Math.cos(Math.PI * c) * 0.015 * S
          L.rot = -6
          R.rot = 6
          break
        }
        case 'curious': {
          breathe(3.2, 0.01)
          r = calm ? 7 : 10 + 2.5 * Math.sin(t * 1.3)
          const c = t % 3.4
          const doubleTake = !calm && c > 2.6 && c < 2.95
          tx = doubleTake ? -0.6 : 0.65
          ty = doubleTake ? -0.05 : -0.2
          follow = doubleTake ? 0.45 : 0.25
          L.sy = 1.16
          L.sx = 1.06
          R.lt = 0.4
          R.sy = 0.96
          sx *= 1.02
          break
        }
        case 'thinking': {
          autoBlink = false
          const c = t % 4.6
          if (c < 1.5) [tx, ty] = [0.7, -0.85]
          else if (c < 2.9) [tx, ty] = [-0.6, -0.9]
          else if (c < 3.5) [tx, ty] = [0.05, -1]
          else [tx, ty] = [0.55, -0.7]
          if (Math.abs(c - 3.2) < 0.02) st.blinkAt = now
          follow = 0.2
          L.lb = R.lb = 0.28
          R.lt = 0.1
          r = calm ? 0 : st.g.x * 4 + 1.5 * Math.sin(t * 0.8)
          breathe(4, 0.01)
          break
        }
        case 'sleepy': {
          autoBlink = false
          breathe(5, 0.03)
          y = 0.02 * S
          sy *= 0.97
          ty = 0.4
          follow = 0.05
          const flutter = !calm && t % 5 > 3.4 && t % 5 < 4
          const lid = flutter ? 0.4 : 0.7 + 0.04 * Math.sin(t * 1.2)
          L.lt = R.lt = lid
          L.lb = R.lb = 0.06
          L.rot = 4
          R.rot = -4
          break
        }
        case 'surprised': {
          autoBlink = false
          const c = (t % 2.6) / 2.6
          const ant = smooth(seg(c, 0, 0.12)) * (1 - smooth(seg(c, 0.12, 0.18)))
          const pop = smooth(seg(c, 0.12, 0.2)) * (1 - smooth(seg(c, 0.62, 0.9)))
          L.sx = R.sx = 1 + 0.42 * pop
          L.sy = R.sy = 1 - 0.3 * ant + 0.1 * pop
          ty = -0.3 * pop
          if (calm) break
          const up = Math.sin(Math.PI * seg(c, 0.15, 0.48))
          const land = Math.sin(Math.PI * seg(c, 0.46, 0.6))
          y = -up * 0.18 * S
          sy = 1 - 0.12 * ant + 0.1 * up - 0.1 * land
          sx = 1 + 0.08 * ant - 0.06 * up + 0.09 * land
          follow = 0.5
          break
        }
        case 'oops': {
          const c = t % 3.4
          tx = 0.05
          ty = 0.6
          follow = 0.15
          L.rot = 8
          R.rot = -8
          L.lt = R.lt = 0.34
          L.slant = -26
          R.slant = 26
          y = 0.015 * S
          sy *= 0.95
          sx *= 1.03
          if (!calm && c < 0.5) x = Math.sin(c * 42) * 0.022 * S * (1 - c / 0.5)
          if (Math.abs(c - 1.8) < 0.02) st.blinkAt = now
          autoBlink = false
          break
        }
        case 'melt':
          autoBlink = false
          breathe(3.6, 0.01)
          ty = -0.1
          break
      }
      if (st.forced) {
        tx = st.forced.x
        ty = st.forced.y
        follow = 0.3
      }

      if (st.squashAt > 0 && !calm) {
        const k = (now - st.squashAt) / 420
        if (k < 1) {
          const q = Math.exp(-5 * k) * Math.cos(k * 14)
          sy *= 1 - 0.16 * q
          sx *= 1 + 0.12 * q
        }
      }

      st.g.x += (clamp(tx, -1.1, 1.1) - st.g.x) * follow
      st.g.y += (clamp(ty, -1.1, 1.1) - st.g.y) * follow

      if (autoBlink && now > st.nextBlink) {
        st.blinkAt = now
        if (Math.random() < 0.22) st.secondBlink = now + 240
        st.nextBlink = now + rand(2500, 5200)
      }
      if (st.secondBlink > 0 && now > st.secondBlink) {
        st.blinkAt = now
        st.secondBlink = -1
      }
      let bl = 0
      if (st.blinkAt > 0) {
        const k = (now - st.blinkAt) / 160
        if (k < 1) bl = Math.sin(Math.PI * k)
      }

      // Sinking into the canvas: eyes close first, then the body shrinks back, blurs and fades.
      const d = st.dis
      const eyesShut = smooth(clamp(d / 0.35, 0, 1))
      const bodyGo = smooth(clamp((d - 0.2) / 0.8, 0, 1))
      sx *= 1 - 0.18 * bodyGo
      sy *= 1 - 0.18 * bodyGo

      // Gaze reaches the rim; sideways, the eyes narrow and draw together like on a sphere.
      const ax = Math.abs(st.g.x)
      const w = 0.0673 * S, gap = 0.0344 * S
      const half = ((w + gap) / 2) * (1 - 0.3 * ax)
      const gx = st.g.x * 0.21 * S, gy = st.g.y * 0.16 * S
      const nearEye = st.g.x > 0 ? R : L, farEye = st.g.x > 0 ? L : R
      nearEye.sy *= 1 + 0.07 * ax
      farEye.sy *= 1 - 0.1 * ax
      L.sx *= 1 - 0.3 * ax
      R.sx *= 1 - 0.3 * ax
      const up = Math.max(0, -st.g.y)
      L.sy *= 1 - 0.1 * up
      R.sy *= 1 - 0.1 * up

      ;([[L, -half], [R, half]] as const).forEach(([e, off], i) => {
        const node = eyes[i]
        const lid = Math.max(bl, eyesShut) * 0.5
        const lt = clamp(Math.max(e.lt, lid), 0, 0.97)
        const lb = Math.min(clamp(Math.max(e.lb, lid), 0, 0.97), 0.98 - lt)
        node.style.transform = `translate(${gx + off}px, ${gy + e.dy}px) rotate(${e.rot}deg) scale(${e.sx}, ${e.sy})`
        // Straight lids are a clip; a slanted lid (worry) and a crescent cut from below use a mask.
        node.style.clipPath = `inset(${(lt * 100).toFixed(1)}% -2% ${(lb * 100).toFixed(1)}% -2%)`
        const layers: string[] = []
        if (e.slant) layers.push(`linear-gradient(${180 + e.slant}deg, transparent ${(lt * 100).toFixed(1)}%, #000 ${(lt * 100 + 1).toFixed(1)}%)`)
        if (e.arc > 0) layers.push(`radial-gradient(ellipse 34% ${(e.arc * 100).toFixed(1)}% at 50% 100%, transparent 98%, #000 100%)`)
        const m = layers.join(', ') || 'none'
        if (lastMask[i] !== m) {
          node.style.maskImage = m
          node.style.setProperty('-webkit-mask-image', m)
          lastMask[i] = m
        }
      })

      const f = `blur(${(S * (0.015 + 0.14 * bodyGo)).toFixed(2)}px)`
      if (f !== lastFilter) {
        fill.style.filter = f
        lastFilter = f
      }
      body.style.opacity = String(1 - smooth(clamp((d - 0.45) / 0.55, 0, 1)))
      shadow.style.opacity = String((1 - d) * (1 - clamp(-y / (0.2 * S), 0, 0.7)))
      shadow.style.transform = `scaleX(${1 - clamp(-y / S, 0, 0.3)})`
      body.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sx}, ${sy})`
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={root} className={`lz ${className}`} data-mood={mood} style={{ '--s': `${size}px`, ...style } as CSSProperties} aria-hidden="true">
      <div className="lz__shadow" />
      <div className="lz__body">
        <div className="lz__fill" />
        <div className="lz__eyes">
          <i className="lz__eye" />
          <i className="lz__eye" />
        </div>
      </div>
      <div className="lz__z">
        <i>z</i>
        <i>z</i>
        <i>z</i>
      </div>
      <div className="lz__think">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
})
