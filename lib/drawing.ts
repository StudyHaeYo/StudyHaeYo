import { newBlockId, type DrawingBlock, type DrawingPoint, type DrawingStroke, type DrawingTool } from "@/lib/study-pages"

export const DRAWING_INITIAL_HEIGHT = 320
export const DRAWING_GROW_STEP = 120

// Stroke colors are user content, not theme colors.
export const DRAWING_COLORS = [
  { value: "#1f2937", label: "검정" },
  { value: "#dc2626", label: "빨강" },
  { value: "#2563eb", label: "파랑" },
  { value: "#16a34a", label: "초록" },
  { value: "#facc15", label: "노랑" },
  { value: "#9333ea", label: "보라" },
] as const

export const STROKE_WIDTHS: Record<DrawingTool, [number, number, number]> = {
  pen: [2, 4, 8],
  highlighter: [12, 20, 32],
}

export const HIGHLIGHTER_OPACITY = 0.35

// Points closer than this (fraction of block width, ~2px at 600px) to the previous one are dropped.
const MIN_POINT_GAP = 0.004

export function newDrawingBlock(): DrawingBlock {
  return { id: newBlockId(), type: "drawing", strokes: [], height: DRAWING_INITIAL_HEIGHT }
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

// Client coordinates → block-width fractions, clamped to the drawing area.
export function toDrawingPoint(clientX: number, clientY: number, rect: DOMRect): DrawingPoint {
  const w = rect.width || 1
  const x = Math.min(Math.max((clientX - rect.left) / w, 0), 1)
  const y = Math.min(Math.max((clientY - rect.top) / w, 0), rect.height / w)
  return [round3(x), round3(y)]
}

export function shouldAppend(points: DrawingPoint[], next: DrawingPoint) {
  const last = points[points.length - 1]
  if (!last) return true
  return Math.hypot(next[0] - last[0], next[1] - last[1]) >= MIN_POINT_GAP
}

// Quadratic curves through segment midpoints, so the stroke passes smoothly near each sampled point.
export function strokePath(points: DrawingPoint[]) {
  if (points.length === 0) return ""
  const [x0, y0] = points[0]
  if (points.length === 1) return `M${x0} ${y0}L${x0} ${y0}`
  let d = `M${x0} ${y0}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    d += `Q${x} ${y} ${((x + nx) / 2).toFixed(4)} ${((y + ny) / 2).toFixed(4)}`
  }
  const [lx, ly] = points[points.length - 1]
  return `${d}L${lx} ${ly}`
}

function distanceToSegment(p: DrawingPoint, a: DrawingPoint, b: DrawingPoint) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

// Index of the topmost stroke under `point`, or -1. `blockWidth` converts pixel tolerances to fractions.
export function hitStrokeIndex(strokes: DrawingStroke[], point: DrawingPoint, blockWidth: number) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const { points, width } = strokes[i]
    const tolerance = (width / 2 + 6) / (blockWidth || 1)
    if (points.length === 1 && Math.hypot(point[0] - points[0][0], point[1] - points[0][1]) <= tolerance) return i
    for (let j = 1; j < points.length; j++) {
      if (distanceToSegment(point, points[j - 1], points[j]) <= tolerance) return i
    }
  }
  return -1
}
