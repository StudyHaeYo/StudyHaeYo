"use client"

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { ChevronsDown, Eraser, Highlighter, PenLine, Redo2, Trash2, Undo2, X } from "lucide-react"
import {
  DRAWING_COLORS,
  DRAWING_GROW_STEP,
  HIGHLIGHTER_OPACITY,
  STROKE_WIDTHS,
  hitStrokeIndex,
  shouldAppend,
  strokePath,
  toDrawingPoint,
} from "@/lib/drawing"
import type { DrawingBlock, DrawingStroke, DrawingTool } from "@/lib/study-pages"

type Tool = DrawingTool | "eraser"

const HISTORY_LIMIT = 100

interface DrawingBlockViewProps {
  block: DrawingBlock
  onChange: (block: DrawingBlock) => void
  onRemove: () => void
  // Moves the caret to the nearest text line above (-1) or below (1), skipping this block.
  onNavigate: (step: -1 | 1) => void
  onActivate: () => void
  autoEdit?: boolean
}

export function DrawingBlockView({ block, onChange, onRemove, onNavigate, onActivate, autoEdit = false }: DrawingBlockViewProps) {
  const [editing, setEditing] = useState(autoEdit)
  const [tool, setTool] = useState<Tool>("pen")
  const [colors, setColors] = useState<Record<DrawingTool, string>>({
    pen: DRAWING_COLORS[0].value,
    highlighter: DRAWING_COLORS[4].value,
  })
  const [widthLevel, setWidthLevel] = useState<Record<DrawingTool, 0 | 1 | 2>>({ pen: 1, highlighter: 1 })
  const [draft, setDraft] = useState<DrawingStroke | null>(null)
  const [past, setPast] = useState<DrawingStroke[][]>([])
  const [future, setFuture] = useState<DrawingStroke[][]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  // Pointer events fire faster than React re-renders; handlers read and write these refs directly.
  const latest = useRef(block)
  const draftRef = useRef<DrawingStroke | null>(null)
  const gesture = useRef<{ pointerId: number; before: DrawingStroke[]; changed: boolean } | null>(null)

  useLayoutEffect(() => {
    latest.current = block
  })

  useEffect(() => {
    if (autoEdit) rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [autoEdit])

  useEffect(() => {
    if (!editing) return
    const handleOutside = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setEditing(false)
    }
    document.addEventListener("pointerdown", handleOutside, true)
    return () => document.removeEventListener("pointerdown", handleOutside, true)
  }, [editing])

  const apply = (strokes: DrawingStroke[]) => {
    latest.current = { ...latest.current, strokes }
    onChange(latest.current)
  }

  const record = (before: DrawingStroke[]) => {
    setPast((p) => [...p, before].slice(-HISTORY_LIMIT))
    setFuture([])
  }

  const undo = () => {
    const previous = past[past.length - 1]
    if (!previous) return
    setPast(past.slice(0, -1))
    setFuture([latest.current.strokes, ...future])
    apply(previous)
  }

  const redo = () => {
    const [next, ...rest] = future
    if (!next) return
    setFuture(rest)
    setPast([...past, latest.current.strokes])
    apply(next)
  }

  const clearAll = () => {
    if (latest.current.strokes.length === 0) return
    record(latest.current.strokes)
    apply([])
  }

  const eraseAt = (clientX: number, clientY: number, rect: DOMRect) => {
    const strokes = latest.current.strokes
    const index = hitStrokeIndex(strokes, toDrawingPoint(clientX, clientY, rect), rect.width)
    if (index === -1 || !gesture.current) return
    gesture.current.changed = true
    apply(strokes.filter((_, i) => i !== index))
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!editing || gesture.current) return
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    gesture.current = { pointerId: e.pointerId, before: latest.current.strokes, changed: false }
    if (tool === "eraser") {
      eraseAt(e.clientX, e.clientY, rect)
      return
    }
    const stroke: DrawingStroke = {
      tool,
      color: colors[tool],
      width: STROKE_WIDTHS[tool][widthLevel[tool]],
      points: [toDrawingPoint(e.clientX, e.clientY, rect)],
    }
    draftRef.current = stroke
    setDraft(stroke)
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
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

  const finishGesture = (e: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (active?.pointerId !== e.pointerId) return
    gesture.current = null
    const stroke = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (stroke) {
      record(active.before)
      apply([...latest.current.strokes, stroke])
    } else if (active.changed) {
      record(active.before)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.target !== e.currentTarget && !editing) return
    if (editing) {
      if (e.key === "Escape") {
        e.preventDefault()
        setEditing(false)
        rootRef.current?.focus()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
      }
      return
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setEditing(true)
    } else if (e.key === "Backspace" || e.key === "Delete") {
      // Like attachments, the block is never removed by Backspace; only the delete button removes it.
      e.preventDefault()
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault()
      onNavigate(-1)
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault()
      onNavigate(1)
    }
  }

  const strokes = draft ? [...block.strokes, draft] : block.strokes
  const isEmpty = block.strokes.length === 0 && !draft
  const activeTool: DrawingTool | null = tool === "eraser" ? null : tool

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="group"
      aria-label={editing ? "그림 블록 (편집 중, Esc로 끝내기)" : "그림 블록 (Enter로 편집)"}
      onPointerDown={() => {
        onActivate()
        if (!editing) setEditing(true)
      }}
      onFocus={onActivate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col gap-2 rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      {editing && (
        <div
          role="toolbar"
          aria-label="그리기 도구"
          className="sticky top-16 z-[5] flex flex-wrap items-center gap-1 self-start rounded-lg border border-border bg-card p-1"
        >
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
                  onClick={() => activeTool && setColors({ ...colors, [activeTool]: c.value })}
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
                  onClick={() => activeTool && setWidthLevel({ ...widthLevel, [activeTool]: level as 0 | 1 | 2 })}
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
          <ToolButton label="되돌리기" disabled={past.length === 0} onClick={undo}>
            <Undo2 className="size-4" />
          </ToolButton>
          <ToolButton label="다시 실행" disabled={future.length === 0} onClick={redo}>
            <Redo2 className="size-4" />
          </ToolButton>
          <ToolButton label="전체 지우기" disabled={block.strokes.length === 0} onClick={clearAll}>
            <Trash2 className="size-4" />
          </ToolButton>
        </div>
      )}

      <div className="relative">
        <div
          ref={surfaceRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishGesture}
          onPointerCancel={finishGesture}
          style={{ height: block.height, touchAction: editing ? "none" : "auto" }}
          className={`relative overflow-hidden rounded-lg border bg-card transition-colors ${
            editing
              ? `border-indigo-300 ring-2 ring-indigo-100 ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`
              : "cursor-pointer border-border hover:border-muted-foreground/40"
          }`}
        >
          {/* viewBox width 1 + "slice" scales by the block width, matching the stored width-fraction coordinates. */}
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
          {isEmpty && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {editing ? "펜이나 손가락으로 그려보세요" : "클릭해서 그리기"}
            </p>
          )}
        </div>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          aria-label="그림 블록 삭제"
          title="그림 삭제"
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground opacity-0 [@media(hover:none)]:opacity-100 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...latest.current, height: latest.current.height + DRAWING_GROW_STEP })}
        className={`inline-flex items-center justify-center gap-1 self-center rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 ${
          editing ? "opacity-100" : "opacity-0 [@media(hover:none)]:opacity-100 group-hover:opacity-100"
        }`}
      >
        <ChevronsDown className="size-3.5" aria-hidden="true" />
        아래로 늘리기
      </button>
    </div>
  )
}

function ToolButton({
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
  children: React.ReactNode
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
