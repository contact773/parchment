import { useEffect, useRef, useState } from 'react'
import {
  MousePointer2,
  Pencil,
  Scissors,
  Building2,
  Mountain,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Waves,
  Undo2,
  Redo2,
  List,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'
import type { MapMarker, MapPoint, MapRegion, MarkerKind, RegionKind, WorldMap } from '@/types'
import { getOrCreateMap, updateMap } from '@/data/repo'
import { uid } from '@/lib/id'
import { cn } from '@/lib/utils'

type Tool = 'select' | 'draw' | 'cut' | 'city' | 'place'
type Sel = { kind: 'region' | 'marker'; id: string } | null
type Snap = { regions: MapRegion[]; markers: MapMarker[] }

const PALETTE = ['#e8553e', '#e8893e', '#e6c14a', '#6fb74e', '#46b6a6', '#4e84c6', '#9a6fb0', '#b5705a', '#8a8f98', '#cfc2a8']
const OCEANS = ['#cfe3ef', '#bcd9e8', '#dbe7d3', '#efe6d2', '#26323f']
const STROKE = '#1f2933'

const regionKind = (r: MapRegion): RegionKind => r.kind ?? 'continent'
const markerKind = (m: MapMarker): MarkerKind => m.kind ?? 'city'

/** Smooth closed curve through the points (Catmull-Rom → cubic bézier) — organic blobs. */
function smoothClosedPath(pts: MapPoint[]): string {
  if (pts.length === 0) return ''
  if (pts.length < 3) return 'M ' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') + ' Z'
  const n = pts.length
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `
  }
  return d + 'Z'
}

function centroid(pts: MapPoint[]): MapPoint {
  if (!pts.length) return { x: 0, y: 0 }
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 })
  return { x: s.x / pts.length, y: s.y / pts.length }
}

function pointInPolygon(pt: MapPoint, poly: MapPoint[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
    if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Clip a polygon to one side of the infinite line through a→b (Sutherland-Hodgman). */
function clipHalfPlane(poly: MapPoint[], a: MapPoint, b: MapPoint, keepLeft: boolean): MapPoint[] {
  const side = (p: MapPoint) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  const inside = (p: MapPoint) => (keepLeft ? side(p) >= 0 : side(p) <= 0)
  const intersect = (p1: MapPoint, p2: MapPoint): MapPoint => {
    const d1 = side(p1)
    const d2 = side(p2)
    const t = d1 / (d1 - d2)
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }
  }
  const out: MapPoint[] = []
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]
    const prev = poly[(i + poly.length - 1) % poly.length]
    const curIn = inside(cur)
    const prevIn = inside(prev)
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur))
      out.push(cur)
    } else if (prevIn) {
      out.push(intersect(prev, cur))
    }
  }
  return out
}

/** Lighten (pct>0) or darken (pct<0) a hex color. */
function hexShade(hex: string, pct: number): string {
  const m = hex.replace('#', '')
  if (m.length < 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  const t = pct < 0 ? 0 : 255
  const p = Math.abs(pct)
  const adj = (c: number) => Math.round((t - c) * p + c)
  const h2 = (c: number) => c.toString(16).padStart(2, '0')
  return `#${h2(adj(r))}${h2(adj(g))}${h2(adj(b))}`
}

function dist2(a: MapPoint, b: MapPoint) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function WorldMapEditor({ projectId }: { projectId: string }) {
  const [map, setMap] = useState<WorldMap | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(PALETTE[3])
  const [sel, setSel] = useState<Sel>(null)
  const [drawPts, setDrawPts] = useState<MapPoint[]>([])
  const [cutLine, setCutLine] = useState<{ a: MapPoint; b: MapPoint } | null>(null)
  const [vb, setVb] = useState({ x: 0, y: 0, w: 1000, h: 640 })
  const [past, setPast] = useState<Snap[]>([])
  const [future, setFuture] = useState<Snap[]>([])
  const [showRegionLabels, setShowRegionLabels] = useState(true)
  const [showMarkerLabels, setShowMarkerLabels] = useState(true)
  const [showLegend, setShowLegend] = useState(true)

  const svgRef = useRef<SVGSVGElement>(null)
  const mapRef = useRef<WorldMap | null>(null)
  const drawRef = useRef<MapPoint[]>([])
  const gesture = useRef<
    | { kind: 'draw' }
    | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number }
    | { kind: 'region'; id: string; last: MapPoint }
    | { kind: 'marker'; id: string }
    | { kind: 'cut'; regionId: string; start: MapPoint; end: MapPoint }
    | null
  >(null)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    getOrCreateMap(projectId).then((m) => {
      if (!active) return
      mapRef.current = m
      setMap(m)
      setVb({ x: 0, y: 0, w: m.width, h: m.height })
      setPast([])
      setFuture([])
    })
    return () => {
      active = false
    }
  }, [projectId])

  const schedule = (m: WorldMap) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void updateMap(m.id, { name: m.name, background: m.background, regions: m.regions, markers: m.markers, width: m.width, height: m.height })
    }, 300)
  }
  /** Mutate + save. */
  const apply = (updater: (m: WorldMap) => WorldMap) =>
    setMap((m) => {
      if (!m) return m
      const next = updater(m)
      mapRef.current = next
      schedule(next)
      return next
    })
  /** Mutate without saving (during a continuous drag). */
  const setLive = (updater: (m: WorldMap) => WorldMap) =>
    setMap((m) => {
      if (!m) return m
      const next = updater(m)
      mapRef.current = next
      return next
    })
  /** Snapshot the current map onto the undo stack (call before a discrete edit). */
  const pushHistory = () => {
    const m = mapRef.current
    if (!m) return
    setPast((p) => [...p.slice(-49), { regions: m.regions, markers: m.markers }])
    setFuture([])
  }
  const edit = (updater: (m: WorldMap) => WorldMap) => {
    pushHistory()
    apply(updater)
  }
  const undo = () => {
    const m = mapRef.current
    if (!m || !past.length) return
    const snap = past[past.length - 1]
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [...f, { regions: m.regions, markers: m.markers }])
    const next = { ...m, regions: snap.regions, markers: snap.markers }
    mapRef.current = next
    setMap(next)
    schedule(next)
    setSel(null)
  }
  const redo = () => {
    const m = mapRef.current
    if (!m || !future.length) return
    const snap = future[future.length - 1]
    setFuture((f) => f.slice(0, -1))
    setPast((p) => [...p, { regions: m.regions, markers: m.markers }])
    const next = { ...m, regions: snap.regions, markers: snap.markers }
    mapRef.current = next
    setMap(next)
    schedule(next)
    setSel(null)
  }

  const toMap = (e: { clientX: number; clientY: number }): MapPoint => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const sp = pt.matrixTransform(ctm.inverse())
    return { x: sp.x, y: sp.y }
  }
  const capture = (e: React.PointerEvent) => {
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic / inactive pointer */
    }
  }
  const release = (e: React.PointerEvent) => {
    try {
      svgRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* not captured */
    }
  }

  const zoomBy = (factor: number, center?: MapPoint) =>
    setVb((v) => {
      const nw = Math.max(140, Math.min(v.w * factor, 4000))
      const f = nw / v.w
      const nh = v.h * f
      const cx = center?.x ?? v.x + v.w / 2
      const cy = center?.y ?? v.y + v.h / 2
      return { x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f, w: nw, h: nh }
    })
  const fit = () => map && setVb({ x: 0, y: 0, w: map.width, h: map.height })

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(e.deltaY > 0 ? 1.1 : 0.9, toMap(e))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.id])

  // Keyboard: undo/redo + delete selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, past, future])

  const regionAt = (p: MapPoint): MapRegion | null => {
    const regions = mapRef.current?.regions ?? []
    for (let i = regions.length - 1; i >= 0; i--) if (pointInPolygon(p, regions[i].points)) return regions[i]
    return null
  }

  const onBgPointerDown = (e: React.PointerEvent) => {
    if (!map) return
    const p = toMap(e)
    capture(e)
    if (tool === 'draw') {
      gesture.current = { kind: 'draw' }
      drawRef.current = [p]
      setDrawPts([p])
      setSel(null)
    } else if (tool === 'cut') {
      const r = regionAt(p)
      if (r) {
        gesture.current = { kind: 'cut', regionId: r.id, start: p, end: p }
        setCutLine({ a: p, b: p })
      }
      setSel(null)
    } else if (tool === 'city' || tool === 'place') {
      const kind: MarkerKind = tool === 'city' ? 'city' : 'place'
      const marker: MapMarker = { id: uid(), name: kind === 'city' ? 'New city' : 'New place', x: p.x, y: p.y, color, kind }
      edit((m) => ({ ...m, markers: [...m.markers, marker] }))
      setSel({ kind: 'marker', id: marker.id })
    } else {
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: vb.x, oy: vb.y }
      setSel(null)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'draw') {
      const p = toMap(e)
      const last = drawRef.current[drawRef.current.length - 1]
      if (last && dist2(p, last) < 49) return
      drawRef.current = [...drawRef.current, p]
      setDrawPts(drawRef.current)
    } else if (g.kind === 'pan') {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const dx = ((e.clientX - g.sx) / rect.width) * vb.w
      const dy = ((e.clientY - g.sy) / rect.height) * vb.h
      setVb((v) => ({ ...v, x: g.ox - dx, y: g.oy - dy }))
    } else if (g.kind === 'region') {
      const p = toMap(e)
      const dx = p.x - g.last.x
      const dy = p.y - g.last.y
      g.last = p
      setLive((m) => ({ ...m, regions: m.regions.map((r) => (r.id === g.id ? { ...r, points: r.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) } : r)) }))
    } else if (g.kind === 'marker') {
      const p = toMap(e)
      setLive((m) => ({ ...m, markers: m.markers.map((mk) => (mk.id === g.id ? { ...mk, x: p.x, y: p.y } : mk)) }))
    } else if (g.kind === 'cut') {
      const p = toMap(e)
      g.end = p
      setCutLine({ a: g.start, b: p })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    release(e)
    if (!g) return
    if (g.kind === 'draw') {
      const pts = drawRef.current
      drawRef.current = []
      setDrawPts([])
      if (pts.length >= 3) {
        const region: MapRegion = { id: uid(), name: 'New land', color, kind: 'continent', points: pts }
        edit((m) => ({ ...m, regions: [...m.regions, region] }))
        setSel({ kind: 'region', id: region.id })
        setTool('select')
      }
    } else if (g.kind === 'region' || g.kind === 'marker') {
      apply((m) => m) // persist moved positions (history pushed at drag start)
    } else if (g.kind === 'cut') {
      performCut(g.regionId, g.start, g.end)
      setCutLine(null)
      setTool('select')
    }
  }

  const performCut = (regionId: string, a: MapPoint, b: MapPoint) => {
    const m = mapRef.current
    if (!m || dist2(a, b) < 64) return // need a real line
    const region = m.regions.find((r) => r.id === regionId)
    if (!region) return
    const left = clipHalfPlane(region.points, a, b, true)
    const right = clipHalfPlane(region.points, a, b, false)
    if (left.length < 3 || right.length < 3) return
    const c1: MapRegion = { id: uid(), name: 'New country', color: region.color, kind: 'country', points: left }
    const c2: MapRegion = { id: uid(), name: 'New country', color: hexShade(region.color, 0.16), kind: 'country', points: right }
    edit((mm) => ({ ...mm, regions: mm.regions.flatMap((r) => (r.id === regionId ? [c1, c2] : [r])) }))
    setSel({ kind: 'region', id: c1.id })
  }

  const deleteSelected = () => {
    if (!sel) return
    if (sel.kind === 'region') edit((m) => ({ ...m, regions: m.regions.filter((r) => r.id !== sel.id) }))
    else edit((m) => ({ ...m, markers: m.markers.filter((mk) => mk.id !== sel.id) }))
    setSel(null)
  }

  const recolorSelection = (c: string) => {
    setColor(c)
    if (sel?.kind === 'region') edit((m) => ({ ...m, regions: m.regions.map((r) => (r.id === sel.id ? { ...r, color: c } : r)) }))
    else if (sel?.kind === 'marker') edit((m) => ({ ...m, markers: m.markers.map((mk) => (mk.id === sel.id ? { ...mk, color: c } : mk)) }))
  }

  if (!map) return <div className="flex h-full items-center justify-center text-sm text-muted">Loading map…</div>

  const selRegion = sel?.kind === 'region' ? map.regions.find((r) => r.id === sel.id) ?? null : null
  const selMarker = sel?.kind === 'marker' ? map.markers.find((mk) => mk.id === sel.id) ?? null : null
  const empty = map.regions.length === 0 && map.markers.length === 0
  const continents = map.regions.filter((r) => regionKind(r) === 'continent')
  const countries = map.regions.filter((r) => regionKind(r) === 'country')
  const cities = map.markers.filter((mk) => markerKind(mk) === 'city')
  const places = map.markers.filter((mk) => markerKind(mk) === 'place')

  const ToolBtn = ({ t, icon, label }: { t: Tool; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setTool(t)}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
        tool === t ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface text-muted hover:text-text',
      )}
    >
      {icon}
    </button>
  )
  const IconBtn = ({ onClick, icon, label, disabled, active }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean; active?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface transition-colors disabled:opacity-40',
        active ? 'text-accent' : 'text-muted hover:text-text',
      )}
    >
      {icon}
    </button>
  )

  const renderMarker = (mk: MapMarker) => {
    const isSel = sel?.kind === 'marker' && sel.id === mk.id
    const r = isSel ? 9 : 7
    const onDown = (e: React.PointerEvent) => {
      if (tool !== 'select') return
      e.stopPropagation()
      capture(e)
      setSel({ kind: 'marker', id: mk.id })
      pushHistory()
      gesture.current = { kind: 'marker', id: mk.id }
    }
    return (
      <g key={mk.id} style={{ cursor: tool === 'select' ? 'move' : undefined }} onPointerDown={onDown}>
        {markerKind(mk) === 'place' ? (
          <path d={`M ${mk.x} ${mk.y - r} L ${mk.x + r * 0.95} ${mk.y + r * 0.8} L ${mk.x - r * 0.95} ${mk.y + r * 0.8} Z`} fill={mk.color} stroke={STROKE} strokeWidth={2.5} strokeLinejoin="round" />
        ) : (
          <>
            <circle cx={mk.x} cy={mk.y} r={r} fill={mk.color} stroke={STROKE} strokeWidth={2.5} />
            <circle cx={mk.x} cy={mk.y} r={2.6} fill={STROKE} />
          </>
        )}
        {showMarkerLabels && (
          <text x={mk.x + 12} y={mk.y + 5} fontSize={15} fontWeight={600} fill={STROKE} stroke="#ffffff" strokeWidth={3.5} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
            {mk.name}
          </text>
        )}
      </g>
    )
  }

  const cursor = tool === 'draw' ? 'crosshair' : tool === 'cut' ? 'crosshair' : tool === 'city' || tool === 'place' ? 'copy' : gesture.current?.kind === 'pan' ? 'grabbing' : 'grab'

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/60 px-3 py-2">
        <div className="flex items-center gap-1">
          <ToolBtn t="select" icon={<MousePointer2 size={16} />} label="Select / pan / move" />
          <ToolBtn t="draw" icon={<Pencil size={16} />} label="Draw a continent — click & drag" />
          <ToolBtn t="cut" icon={<Scissors size={16} />} label="Cut a continent into countries — drag a line across it" />
          <ToolBtn t="city" icon={<Building2 size={16} />} label="Add a city" />
          <ToolBtn t="place" icon={<Mountain size={16} />} label="Add a place (mountains / point of interest)" />
        </div>
        <div className="mx-1 h-6 w-px bg-border" />
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => recolorSelection(c)}
              title="Color"
              className={cn('h-6 w-6 rounded-full border-2 transition-transform hover:scale-110', color === c ? 'border-text' : 'border-white/70')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn onClick={undo} icon={<Undo2 size={16} />} label="Undo (Ctrl+Z)" disabled={!past.length} />
          <IconBtn onClick={redo} icon={<Redo2 size={16} />} label="Redo (Ctrl+Shift+Z)" disabled={!future.length} />
          <div className="mx-1 h-6 w-px bg-border" />
          <span className="mr-0.5 flex items-center text-muted" title="Ocean color">
            <Waves size={14} />
          </span>
          {OCEANS.map((c) => (
            <button
              key={c}
              onClick={() => edit((m) => ({ ...m, background: c }))}
              title="Ocean color"
              className={cn('h-6 w-6 rounded-md border-2', map.background === c ? 'border-text' : 'border-white/70')}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="mx-1 h-6 w-px bg-border" />
          <IconBtn onClick={() => zoomBy(0.8)} icon={<ZoomIn size={16} />} label="Zoom in" />
          <IconBtn onClick={() => zoomBy(1.25)} icon={<ZoomOut size={16} />} label="Zoom out" />
          <IconBtn onClick={fit} icon={<Maximize2 size={16} />} label="Fit map" />
          <IconBtn onClick={() => setShowLegend((v) => !v)} icon={<List size={16} />} label="Toggle legend" active={showLegend} />
        </div>
      </div>

      {/* Canvas */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="h-full w-full touch-none select-none"
          style={{ cursor }}
          onPointerDown={onBgPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <rect x={-4000} y={-4000} width={9000} height={9000} fill={map.background} />

          {/* Regions */}
          {map.regions.map((r) => (
            <path
              key={r.id}
              d={smoothClosedPath(r.points)}
              fill={r.color}
              stroke={STROKE}
              strokeWidth={sel?.kind === 'region' && sel.id === r.id ? 4 : regionKind(r) === 'country' ? 2 : 2.6}
              strokeLinejoin="round"
              style={{ cursor: tool === 'select' ? 'move' : tool === 'cut' ? 'crosshair' : undefined }}
              onPointerDown={(e) => {
                if (tool !== 'select') return
                e.stopPropagation()
                capture(e)
                setSel({ kind: 'region', id: r.id })
                pushHistory()
                gesture.current = { kind: 'region', id: r.id, last: toMap(e) }
              }}
            />
          ))}

          {/* In-progress drawing */}
          {drawPts.length > 1 && (
            <polyline points={drawPts.map((p) => `${p.x},${p.y}`).join(' ')} fill={`${color}55`} stroke={color} strokeWidth={2.5} strokeDasharray="6 5" strokeLinejoin="round" />
          )}

          {/* Cut line preview */}
          {cutLine && <line x1={cutLine.a.x} y1={cutLine.a.y} x2={cutLine.b.x} y2={cutLine.b.y} stroke={STROKE} strokeWidth={2} strokeDasharray="7 5" />}

          {/* Region labels */}
          {showRegionLabels &&
            map.regions.map((r) => {
              if (!r.name.trim()) return null
              const c = centroid(r.points)
              return (
                <text key={`l-${r.id}`} x={c.x} y={c.y} textAnchor="middle" fontSize={regionKind(r) === 'country' ? 15 : 18} fontWeight={600} fill={STROKE} stroke="#ffffff" strokeWidth={3.5} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                  {r.name}
                </text>
              )
            })}

          {/* Markers */}
          {map.markers.map(renderMarker)}
        </svg>

        {/* Empty hint */}
        {empty && drawPts.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border border-dashed border-border/70 bg-surface/80 px-5 py-4 text-center text-sm text-muted backdrop-blur">
              <div className="mb-1 font-medium text-text">Craft your world</div>
              Draw a <Pencil size={13} className="mx-0.5 inline" /> continent, slice it into countries with <Scissors size={13} className="mx-0.5 inline" />,
              <br />
              and drop <Building2 size={13} className="mx-0.5 inline" /> cities &amp; <Mountain size={13} className="mx-0.5 inline" /> places.
            </div>
          </div>
        )}

        {/* Legend */}
        {showLegend && (
          <div className="absolute right-3 top-3 flex max-h-[calc(100%-1.5rem)] w-52 flex-col rounded-xl border border-border bg-surface/95 shadow-panel backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold">Legend</span>
              <button onClick={() => setShowLegend(false)} className="text-muted hover:text-text" title="Hide legend">
                <X size={13} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
              <LegendGroup title="Continents" items={continents} onSelect={(id) => setSel({ kind: 'region', id })} selId={selRegion?.id} />
              <LegendGroup title="Countries" items={countries} onSelect={(id) => setSel({ kind: 'region', id })} selId={selRegion?.id} />
              <LegendGroup title="Cities" items={cities} onSelect={(id) => setSel({ kind: 'marker', id })} selId={selMarker?.id} marker />
              <LegendGroup title="Places" items={places} onSelect={(id) => setSel({ kind: 'marker', id })} selId={selMarker?.id} marker triangle />
              {empty && <p className="text-xs text-muted">Nothing yet.</p>}
            </div>
            <div className="space-y-1 border-t border-border px-3 py-2">
              <LabelToggle on={showRegionLabels} onToggle={() => setShowRegionLabels((v) => !v)} label="Land names" />
              <LabelToggle on={showMarkerLabels} onToggle={() => setShowMarkerLabels((v) => !v)} label="City / place names" />
            </div>
          </div>
        )}

        {/* Selection inspector */}
        {(selRegion || selMarker) && (
          <div className="absolute bottom-4 left-4 w-64 rounded-xl border border-border bg-surface/95 p-3 shadow-panel backdrop-blur">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{selRegion ? 'Land' : 'Marker'}</div>
            <input
              value={selRegion ? selRegion.name : selMarker!.name}
              onFocus={pushHistory}
              onChange={(e) => {
                const v = e.target.value
                if (selRegion) apply((m) => ({ ...m, regions: m.regions.map((r) => (r.id === selRegion.id ? { ...r, name: v } : r)) }))
                else apply((m) => ({ ...m, markers: m.markers.map((mk) => (mk.id === selMarker!.id ? { ...mk, name: v } : mk)) }))
              }}
              placeholder="Name"
              className="input-base mb-2 w-full py-1.5 text-sm"
            />
            {/* Kind switch */}
            <div className="mb-2 flex gap-1">
              {selRegion
                ? (['continent', 'country'] as RegionKind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => edit((m) => ({ ...m, regions: m.regions.map((r) => (r.id === selRegion.id ? { ...r, kind: k } : r)) }))}
                      className={cn('flex-1 rounded-md border px-2 py-1 text-xs capitalize', regionKind(selRegion) === k ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-text')}
                    >
                      {k}
                    </button>
                  ))
                : (['city', 'place'] as MarkerKind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => edit((m) => ({ ...m, markers: m.markers.map((mk) => (mk.id === selMarker!.id ? { ...mk, kind: k } : mk)) }))}
                      className={cn('flex-1 rounded-md border px-2 py-1 text-xs capitalize', markerKind(selMarker!) === k ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-text')}
                    >
                      {k}
                    </button>
                  ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => recolorSelection(c)}
                  className={cn('h-5 w-5 rounded-full border-2', (selRegion?.color ?? selMarker?.color) === c ? 'border-text' : 'border-white/70')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button onClick={deleteSelected} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-danger/30 bg-danger/5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function LegendGroup({
  title,
  items,
  onSelect,
  selId,
  marker,
  triangle,
}: {
  title: string
  items: { id: string; name: string; color: string }[]
  onSelect: (id: string) => void
  selId?: string
  marker?: boolean
  triangle?: boolean
}) {
  if (!items.length) return null
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted/70">
        {title} ({items.length})
      </div>
      <div className="space-y-0.5">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onSelect(it.id)}
            className={cn('flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs', selId === it.id ? 'bg-accent/15 text-accent' : 'hover:bg-surface-2')}
          >
            <span
              className={cn('h-3 w-3 shrink-0 border', marker && !triangle && 'rounded-full', triangle && 'rounded-sm')}
              style={{ backgroundColor: it.color, borderColor: STROKE }}
            />
            <span className="truncate">{it.name || <span className="text-muted">Unnamed</span>}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function LabelToggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between rounded px-1 py-0.5 text-xs text-muted hover:text-text">
      <span>{label}</span>
      {on ? <Eye size={14} className="text-accent" /> : <EyeOff size={14} />}
    </button>
  )
}
