"use client"

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { ChevronsDown, X } from "lucide-react"
import { DRAWING_GROW_STEP } from "@/lib/drawing"
import type { DrawingBlock, DrawingStroke } from "@/lib/study-pages"
import { DrawingToolbar, StrokeLayer, useStrokeInput, useToolState } from "@/components/study-page/drawing-kit"

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
  const [toolState, setToolState] = useToolState()
  const [past, setPast] = useState<DrawingStroke[][]>([])
  const [future, setFuture] = useState<DrawingStroke[][]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  // Pointer events fire faster than React re-renders; handlers read and write this ref directly.
  const latest = useRef(block)

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

  const input = useStrokeInput({
    enabled: editing,
    toolState,
    getStrokes: () => latest.current.strokes,
    setStrokes: apply,
    onGesture: record,
  })

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

  const strokes = input.draft ? [...block.strokes, input.draft] : block.strokes
  const isEmpty = block.strokes.length === 0 && !input.draft

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="group"
      aria-label={editing ? "그림 블록 (편집 중, Esc로 끝내기)" : "그림 블록 (Enter로 편집)"}
      onPointerDown={() => {
        onActivate()
        if (!editing) setEditing(true)
        // Drawing calls preventDefault, which skips focus; focus here so Ctrl+Z / Esc reach this block.
        rootRef.current?.focus({ preventScroll: true })
      }}
      onFocus={onActivate}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col gap-2 rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      {editing && (
        <DrawingToolbar
          state={toolState}
          onState={setToolState}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onUndo={undo}
          onRedo={redo}
          onClear={clearAll}
          canClear={block.strokes.length > 0}
          className="sticky top-16 z-[5] self-start rounded-lg border border-border bg-card p-1"
        />
      )}

      <div className="relative">
        <div
          {...input.handlers}
          style={{ height: block.height, touchAction: input.touchAction }}
          className={`relative overflow-hidden rounded-lg border bg-card transition-colors ${
            editing
              ? `border-indigo-300 ring-2 ring-indigo-100 ${input.cursor}`
              : "cursor-pointer border-border hover:border-muted-foreground/40"
          }`}
        >
          <StrokeLayer strokes={strokes} />
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
