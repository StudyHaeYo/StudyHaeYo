"use client"

import { useRef, useState, type PointerEvent, type ReactNode } from "react"
import { Eraser, Hand, Highlighter, PenLine, Redo2, Trash2, Undo2 } from "lucide-react"
import {
  DRAWING_COLORS,
  HIGHLIGHTER_OPACITY,
  STROKE_WIDTHS,
  hitStrokeIndex,
  shouldAppend,
  strokePath,
  toDrawingPoint,
} from "@/lib/drawing"
import type { DrawingStroke, DrawingTool } from "@/lib/study-pages"

// Shared by the drawing block and PDF note-taking: tool picker, stroke rendering, pointer input.
// "hand" (PDF only) leaves the pointer to the page so touch screens can scroll.
export type Tool = DrawingTool | "eraser" | "hand"

export interface ToolState {
  tool: Tool
  colors: Record<DrawingTool, string>
  widthLevel: Record<DrawingTool, 0 | 1 | 2>
}

export function useToolState(initial: Tool = "pen") {
  return useState<ToolState>({
    tool: initial,
    colors: { pen: DRAWING_COLORS[0].value, highlighter: DRAWING_COLORS[4].value },
    widthLevel: { pen: 1, highlighter: 1 },
  })
}

export function DrawingToolbar({
  state,
  onState,
  withHand = false,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  clearLabel = "전체 지우기",
  canClear,
  className = "",
}: {
  state: ToolState
  onState: (next: ToolState) => void
  withHand?: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  clearLabel?: string
  canClear: boolean
  className?: string
}) {
  const { tool, colors, widthLevel } = state
  const activeTool: DrawingTool | null = tool === "pen" || tool === "highlighter" ? tool : null
  const setTool = (next: Tool) => onState({ ...state, tool: next })

  return (
    <div role="toolbar" aria-label="그리기 도구" className={`flex flex-wrap items-center gap-1 ${className}`}>
      {withHand && (
        <ToolButton label="이동 (스크롤)" active={tool === "hand"} onClick={() => setTool("hand")}>
          <Hand className="size-4" />
        </ToolButton>
      )}
      <ToolButton label="펜" active={tool === "pen"} onClick={() => setTool("pen")}>
        <PenLine className="size-4" />
      </ToolButton>
      <ToolButton label="형광펜" active={tool === "highlighter"} onClick={() => setTool("highlighter")}>
        <Highlighter className="size-4" />
      </ToolButton>
      <ToolButton label="지우개 (닿은 획 지우기)" active={tool === "eraser"} onClick={() => setTool("eraser")}>
        <Eraser className="size-4" />
      </ToolButton>

      <Divider />
      <div role="radiogroup" aria-label="색상" className="flex items-center gap-0.5">
        {DRAWING_COLORS.map((c) => {
          const selected = activeTool !== null && colors[activeTool] === c.value
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.label}
              title={c.label}
              disabled={activeTool === null}
              onClick={() => activeTool && onState({ ...state, colors: { ...colors, [activeTool]: c.value } })}
              className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-muted disabled:opacity-40"
            >
              <span
                className={`size-4 rounded-full ${selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`}
                style={{ backgroundColor: c.value }}
              />
            </button>
          )
        })}
      </div>

      <Divider />
      <div role="radiogroup" aria-label="굵기" className="flex items-center gap-0.5">
        {(["가늘게", "보통", "굵게"] as const).map((label, level) => {
          const selected = activeTool !== null && widthLevel[activeTool] === level
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`굵기 ${label}`}
              title={label}
              disabled={activeTool === null}
              onClick={() =>
                activeTool && onState({ ...state, widthLevel: { ...widthLevel, [activeTool]: level as 0 | 1 | 2 } })
              }
              className={`flex size-8 items-center justify-center rounded-md transition-colors hover:bg-muted disabled:opacity-40 ${
                selected ? "bg-muted" : ""
              }`}
            >
              <span className="rounded-full bg-foreground" style={{ width: 4 + level * 4, height: 4 + level * 4 }} />
            </button>
          )
        })}
      </div>

      <Divider />
      <ToolButton label="되돌리기" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" />
      </ToolButton>
      <ToolButton label="다시 실행" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-4" />
      </ToolButton>
      <ToolButton label={clearLabel} disabled={!canClear} onClick={onClear}>
        <Trash2 className="size-4" />
      </ToolButton>
    </div>
  )
}

// Strokes stored as width fractions; viewBox width 1 + "slice" scales them by the surface width.
export function StrokeLayer({ strokes }: { strokes: DrawingStroke[] }) {
  return (
    <svg
      viewBox="0 0 1 1000"
      preserveAspectRatio="xMinYMin slice"
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
    >
      {strokes.map((stroke, i) => (
        <path
          key={i}
          d={strokePath(stroke.points)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeOpacity={stroke.tool === "highlighter" ? HIGHLIGHTER_OPACITY : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

// Pointer input for one drawing surface. `getStrokes`/`setStrokes` read and write the stored strokes
// (pointer events outpace renders, so reads go through the getter); `onGesture(before)` runs once per
// finished stroke or eraser drag that changed something, for the owner's undo history.
export function useStrokeInput({
  enabled,
  toolState,
  getStrokes,
  setStrokes,
  onGesture,
}: {
  enabled: boolean
  toolState: ToolState
  getStrokes: () => DrawingStroke[]
  setStrokes: (strokes: DrawingStroke[]) => void
  onGesture: (before: DrawingStroke[]) => void
}) {
  const [draft, setDraft] = useState<DrawingStroke | null>(null)
  const draftRef = useRef<DrawingStroke | null>(null)
  const gesture = useRef<{ pointerId: number; before: DrawingStroke[]; changed: boolean } | null>(null)
  const { tool, colors, widthLevel } = toolState
  const drawing = enabled && tool !== "hand"

  const eraseAt = (clientX: number, clientY: number, rect: DOMRect) => {
    const strokes = getStrokes()
    const index = hitStrokeIndex(strokes, toDrawingPoint(clientX, clientY, rect), rect.width)
    if (index === -1 || !gesture.current) return
    gesture.current.changed = true
    setStrokes(strokes.filter((_, i) => i !== index))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!drawing || gesture.current) return
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    gesture.current = { pointerId: e.pointerId, before: getStrokes(), changed: false }
    if (tool === "eraser") {
      eraseAt(e.clientX, e.clientY, rect)
      return
    }
    const penTool = tool as DrawingTool
    const stroke: DrawingStroke = {
      tool: penTool,
      color: colors[penTool],
      width: STROKE_WIDTHS[penTool][widthLevel[penTool]],
      points: [toDrawingPoint(e.clientX, e.clientY, rect)],
    }
    draftRef.current = stroke
    setDraft(stroke)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const samples = e.nativeEvent.getCoalescedEvents?.() ?? []
    const events = samples.length > 0 ? samples : [e.nativeEvent]
    if (tool === "eraser") {
      for (const sample of events) eraseAt(sample.clientX, sample.clientY, rect)
      return
    }
    const current = draftRef.current
    if (!current) return
    const points = [...current.points]
    for (const sample of events) {
      const point = toDrawingPoint(sample.clientX, sample.clientY, rect)
      if (shouldAppend(points, point)) points.push(point)
    }
    if (points.length === current.points.length) return
    draftRef.current = { ...current, points }
    setDraft(draftRef.current)
  }

  const finish = (e: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (active?.pointerId !== e.pointerId) return
    gesture.current = null
    const stroke = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (stroke) {
      onGesture(active.before)
      setStrokes([...getStrokes(), stroke])
    } else if (active.changed) {
      onGesture(active.before)
    }
  }

  return {
    draft,
    // Touch moves the page when not drawing (hand tool or not editing).
    touchAction: drawing ? ("none" as const) : ("auto" as const),
    cursor: !drawing ? "" : tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
  }
}

export function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        active ? "bg-indigo-50 text-indigo-700" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
}
