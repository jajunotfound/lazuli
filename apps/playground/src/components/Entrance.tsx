import { useEffect, useRef, useState } from 'react'
import { Mascot, type MascotHandle, type Mood } from './Mascot'

// First visit: "meet lazuli". Lazuli peeks up from the bottom edge, looks around, looks up at its
// own name, grins, climbs up over the words, then sinks back into the canvas where the first frame
// is, and that frame's blob grows out of the spot (onReveal). Click or any key skips.
interface EntranceProps {
  /** Where Lazuli sinks: the first frame, in viewport pixels. */
  target: { x: number; y: number; w: number; h: number }
  reduced: boolean
  onReveal(): void
  onDone(): void
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function Entrance({ target, reduced, onReveal, onDone }: EntranceProps) {
  const actor = useRef<HTMLDivElement>(null)
  const words = useRef<HTMLParagraphElement>(null)
  const lz = useRef<MascotHandle>(null)
  const [mood, setMood] = useState<Mood>('idle')
  const [S] = useState(() => Math.round(Math.min(innerHeight * 0.36, 320)))
  const finished = useRef(false)
  const revealed = useRef(false)

  const reveal = () => {
    if (revealed.current) return
    revealed.current = true
    onReveal()
  }
  const finish = () => {
    if (finished.current) return
    finished.current = true
    reveal()
    onDone()
  }

  useEffect(() => {
    let live = true
    const a = actor.current!, text = words.current!
    const [meet, name] = [...text.querySelectorAll('span')]
    const h = innerHeight, vw = innerWidth
    const anim = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) =>
      el.animate(frames, { fill: 'forwards', ...opts }).finished.catch(() => {})
    const wordIn = (el: Element, delay: number) =>
      anim(el, [{ opacity: 0, transform: 'translateY(0.25em)' }, { opacity: 1, transform: 'none' }], { duration: reduced ? 200 : 520, delay, easing: 'cubic-bezier(.2,.8,.2,1)' })
    const wordsOut = () => Promise.all([meet, name].map((el) => anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 })))

    // The sink target: the first frame's middle, where its main blob sits.
    const sinkT = `translate(${target.x + target.w / 2 - vw / 2}px, ${target.y + target.h / 2 - h / 2}px) scale(${Math.max(0.3, Math.min(target.w, target.h) / S) * 0.55})`

    const run = async () => {
      const below = `translateY(${h / 2 + S}px)`
      const low = `translateY(${h / 2 + S * 0.1}px)`
      a.animate([{ transform: below }], { fill: 'forwards' })
      await Promise.all([wordIn(meet, 0), wordIn(name, 160)])
      if (!live) return

      if (reduced) {
        await anim(a, [{ transform: 'none', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300 })
        await wait(600)
        await wordsOut()
        reveal()
        await lz.current?.dissolveTo(1, 400)
        return live && finish()
      }

      await anim(a, [{ transform: below }, { transform: low }], { duration: 640, easing: 'cubic-bezier(.2,.8,.2,1)' })
      if (!live) return
      lz.current?.gaze(-1, -0.3)
      await wait(520)
      lz.current?.gaze(1, -0.3)
      await wait(520)
      lz.current?.gaze(0, -1.1) // up at its name
      lz.current?.blink()
      await wait(620)
      if (!live) return
      lz.current?.gaze(null)
      setMood('happy')
      await wait(700)
      setMood('idle')
      lz.current?.gaze(0, -0.2)
      if (!live) return

      // Climbs up over the words: big enough to cover them.
      const cover = Math.max(1, (text.getBoundingClientRect().width * 0.95) / S)
      const coverT = `translateY(${-h * 0.08}px) scale(${cover})`
      await Promise.all([
        anim(a, [{ transform: low }, { transform: `translateY(${-h * 0.14}px) scale(${cover * 0.94}, ${cover * 1.08})`, offset: 0.72 }, { transform: coverT }], {
          duration: 820,
          easing: 'cubic-bezier(.3,0,.2,1)',
        }),
        wait(520).then(wordsOut),
      ])
      lz.current?.squash()
      lz.current?.gaze(null)
      await wait(380)
      lz.current?.blink()
      await wait(420)
      if (!live) return

      // Sinks back into the canvas; the frame's blob grows out of that spot.
      setMood('melt')
      await Promise.all([
        anim(a, [{ transform: coverT }, { transform: sinkT }], { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)' }),
        lz.current?.dissolveTo(1, 1500),
        wait(450).then(reveal),
      ])
      if (live) finish()
    }
    run()

    const skip = () => finish()
    window.addEventListener('pointerdown', skip, true)
    window.addEventListener('keydown', skip)
    return () => {
      live = false
      window.removeEventListener('pointerdown', skip, true)
      window.removeEventListener('keydown', skip)
    }
    // Runs once; the target is measured before the entrance mounts.
  }, [])

  return (
    <div className="entrance" aria-label="Meet Lazuli" role="img">
      <p className="entrance__words" ref={words}>
        <span>meet</span> <span className="entrance__name">lazuli</span>
      </p>
      <div className="entrance__actor" ref={actor} style={{ marginLeft: -S / 2, marginTop: -S / 2 }}>
        <Mascot ref={lz} size={S} mood={mood} reduced={reduced} />
      </div>
    </div>
  )
}
