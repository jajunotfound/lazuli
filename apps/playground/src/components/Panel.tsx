import type { ReactNode } from 'react'

/** Popover body: small title + Reset link, then 48px rows. */
export function Panel({ title, onReset, children }: { title: string; onReset(): void; children: ReactNode }) {
  return (
    <div className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{title}</h2>
        <button type="button" className="panel__reset" onClick={onReset}>
          Reset
        </button>
      </div>
      {children}
    </div>
  )
}

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`row ${className}`}>{children}</div>
}
