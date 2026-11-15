import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from '../icons'

interface Chapter {
  t: number
  title: string
}

const SEEN = 'lazuli.tour.seen'

/** Has this browser been offered the tour yet? */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN) === '1'
  } catch {
    return true // storage blocked: don't pop it up on every visit
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // Storage blocked: nothing to remember it in.
  }
}

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/**
 * The tour: the recorded tutorial (public/tutorial.mp4) with its chapters (public/tutorial.json)
 * beside it. Opens once on a first visit; the welcome card's "Watch the tour" brings it back.
 */
export function TutorialDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!open || chapters.length) return
    fetch('/tutorial.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { chapters?: Chapter[] } | null) => j?.chapters && setChapters(j.chapters))
      .catch(() => {})
  }, [open, chapters.length])

  const current = chapters.reduce((at, c, i) => (c.t <= now + 0.05 ? i : at), -1)
  const jump = (t: number) => {
    const v = video.current
    if (!v) return
    v.currentTime = t
    v.play().catch(() => {})
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="tour" aria-describedby={undefined}>
          <div className="tour__head">
            <Dialog.Title className="tour__title">A quick tour</Dialog.Title>
            <Dialog.Close className="code-dialog__close" aria-label="Close">
              <CloseIcon width={12} height={12} />
            </Dialog.Close>
          </div>
          <div className="tour__body">
            <video
              ref={video}
              className="tour__video"
              src="/tutorial.mp4"
              controls
              muted
              playsInline
              preload="auto"
              onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            />
            {chapters.length > 0 && (
              <ol className="tour__chapters" aria-label="Chapters">
                {chapters.map((c, i) => (
                  <li key={c.t}>
                    <button type="button" aria-current={i === current || undefined} onClick={() => jump(c.t)}>
                      <span className="tour__time">{clock(c.t)}</span>
                      {c.title}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
