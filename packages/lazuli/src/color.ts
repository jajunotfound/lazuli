const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Returns `#rrggbb` (lowercase) or `fallback` if the input isn't a hex color. */
export function normalizeHex(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const m = v.trim().match(HEX_RE)
  if (!m) return fallback
  let h = m[1].toLowerCase()
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  return '#' + h
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(normalizeHex(hex, '#000000').slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
