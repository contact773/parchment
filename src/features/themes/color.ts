/** Convert "#rrggbb" → "r g b" triplet string used by theme tokens. */
export function hexToTriplet(hex: string): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

/** Convert "r g b" triplet → "#rrggbb". */
export function tripletToHex(triplet: string): string {
  const [r, g, b] = triplet.split(/\s+/).map((n) => Math.max(0, Math.min(255, parseInt(n, 10) || 0)))
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}
