import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Fragment, useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type SVGProps } from 'react'
import type { PanelId } from '../state'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

export type ToolbarItem =
  | { kind: 'action'; id: string; label: string; icon: Icon; onClick(): void; shortcut?: string; flash?: boolean }
  | { kind: 'panel'; id: PanelId; label: string; icon: Icon; content: ReactNode; keepOpenOnCanvas?: boolean }

interface ToolbarProps {
  groups: ToolbarItem[][]
  open: PanelId | null
  setOpen(id: PanelId | null): void
  /** Phone layout: horizontal dock at the bottom, popovers above. */
  compact: boolean
  /** Dock-style magnification on hover (off on phones, with reduced motion, or while a panel is open). */
  magnify: boolean
  hidden: boolean
  canvas: HTMLElement | null
}

// Sizes from frame 02: hovered 64, neighbours 52, then 44, rest 40.
const MAGNIFIED = [64, 52, 44]

export function Toolbar({ groups, open, setOpen, compact, magnify, hidden, canvas }: ToolbarProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  // Radix restores focus after unmount, so read the latest open panel from a ref.
  const openRef = useRef(open)
  openRef.current = open

  // Opening or closing a panel mid-click must not magnify (the button would move out from
  // under the pointer and swallow the click). Wait for the pointer to move again.
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    setHovered(null)
  }
  const active = magnify && !compact && open === null ? hovered : null
  let index = 0

  return (
    <nav
      className="toolbar"
      aria-label="Controls"
      data-hidden={hidden || undefined}
      inert={hidden}
      onPointerLeave={() => setHovered(null)}
    >
      {groups.map((group, g) => (
        <Fragment key={g}>
          {g > 0 && <span className="toolbar__divider" aria-hidden="true" />}
          {group.map((item) => {
            const i = index++
            const distance = active === null ? Infinity : Math.abs(active - i)
            const size = MAGNIFIED[distance] ?? 40
            // Only override when magnified so the CSS default (and its phone variant) applies otherwise.
            const style = size === 40 ? undefined : ({ '--size': `${size}px` } as CSSProperties)
            const onPointerMove = (e: React.PointerEvent) => e.pointerType === 'mouse' && setHovered(i)
            const tooltipOffset = size === 40 ? 14 : 5

            if (item.kind === 'action') {
              return (
                <Tip key={item.id} label={item.label} shortcut={item.shortcut} compact={compact} offset={tooltipOffset}>
                  <button
                    type="button"
                    className="tool"
                    style={style}
                    aria-label={item.label}
                    aria-keyshortcuts={item.shortcut}
                    data-flash={item.flash || undefined}
                    onPointerMove={onPointerMove}
                    onClick={item.onClick}
                  >
                    <item.icon className="tool__icon" />
                  </button>
                </Tip>
              )
            }

            const isOpen = open === item.id
            return (
              <Popover.Root key={item.id} open={isOpen} onOpenChange={(o) => setOpen(o ? item.id : null)}>
                <Tip label={item.label} compact={compact} offset={tooltipOffset} disabled={isOpen}>
                  <Popover.Trigger className="tool" style={style} aria-label={item.label} onPointerMove={onPointerMove}>
                    <item.icon className="tool__icon" />
                  </Popover.Trigger>
                </Tip>
                <Popover.Portal>
                  <Popover.Content
                    className="popover"
                    side={compact ? 'top' : 'right'}
                    align={compact ? 'center' : 'start'}
                    sideOffset={compact ? 17 : 21}
                    alignOffset={compact ? 0 : -1}
                    collisionPadding={16}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onInteractOutside={(e) => {
                      // Cursor stays open while you try it on the canvas.
                      if (item.keepOpenOnCanvas && canvas && e.target instanceof Node && canvas.contains(e.target)) e.preventDefault()
                    }}
                    onCloseAutoFocus={(e) => {
                      // Switching straight to another panel: don't pull focus back to this trigger,
                      // or the new panel sees "focus outside" and closes. Esc still returns focus.
                      if (openRef.current !== null) e.preventDefault()
                    }}
                  >
                    {item.content}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            )
          })}
        </Fragment>
      ))}
    </nav>
  )
}

function Tip({
  label,
  shortcut,
  compact,
  offset,
  disabled,
  children,
}: {
  label: string
  shortcut?: string
  compact: boolean
  offset: number
  disabled?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Forget a pending open while the popover is up, so the tip doesn't pop back when it closes.
  if (disabled && open) setOpen(false)
  // Touch layouts have no hover; the icons carry aria-labels for screen readers.
  if (compact) return <>{children}</>
  return (
    <Tooltip.Root open={open && !disabled} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" side="right" sideOffset={offset}>
          {label}
          {shortcut && <kbd className="tooltip__kbd">{shortcut}</kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
