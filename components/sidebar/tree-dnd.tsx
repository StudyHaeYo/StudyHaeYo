"use client"

import { createContext, useContext, useState, type DragEvent, type ReactNode } from "react"
import { canMoveNode, moveNode, useWorkspace, type DropPosition } from "@/lib/workspace"

interface DropTarget {
  id: string | null
  position: DropPosition
}

interface TreeDndValue {
  dragId: string | null
  over: DropTarget | null
  setDragId: (id: string | null) => void
  setOver: (target: DropTarget | null) => void
}

const TreeDndContext = createContext<TreeDndValue | null>(null)

export function TreeDndProvider({ children }: { children: ReactNode }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<DropTarget | null>(null)
  return (
    <TreeDndContext.Provider value={{ dragId, over, setDragId, setOver }}>{children}</TreeDndContext.Provider>
  )
}

function useTreeDnd() {
  const ctx = useContext(TreeDndContext)
  if (!ctx) throw new Error("useTreeDnd must be used inside TreeDndProvider")
  return ctx
}

// An expanded node with visible children has no "after" zone: the gap below it belongs to its first child.
function positionFor(e: DragEvent<HTMLElement>, allowAfter: boolean): DropPosition {
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = (e.clientY - rect.top) / rect.height
  if (ratio < 0.3) return "before"
  if (ratio > 0.7 && allowAfter) return "after"
  return "inside"
}

export function useTreeDrag(id: string, { allowAfter = true }: { allowAfter?: boolean } = {}) {
  const { dragId, over, setDragId, setOver } = useTreeDnd()
  const workspace = useWorkspace()

  const reset = () => {
    setDragId(null)
    setOver(null)
  }

  const rowProps = {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      e.stopPropagation()
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", id)
      setDragId(id)
    },
    onDragEnd: reset,
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.stopPropagation()
      const position = positionFor(e, allowAfter)
      if (!canMoveNode(workspace, dragId, id, position)) {
        if (over?.id === id) setOver(null)
        return
      }
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      if (over?.id !== id || over.position !== position) setOver({ id, position })
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return
      if (over?.id === id) setOver(null)
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (dragId) moveNode(dragId, id, positionFor(e, allowAfter))
      reset()
    },
  }

  return {
    rowProps,
    indicator: over?.id === id ? over.position : null,
    isDragging: dragId === id,
  }
}

export function dropIndicatorClass(indicator: DropPosition | null) {
  if (indicator === "inside") return "bg-indigo-50 ring-1 ring-inset ring-indigo-300"
  if (indicator === "before") return "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-indigo-500"
  if (indicator === "after") return "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-indigo-500"
  return ""
}

// Empty space under the tree while dragging. Dropping there moves the node to the end of the top level,
// shown with the same line indicator as every other drop, so there is no separate "move to top level" box.
export function RootDropZone() {
  const { dragId, over, setDragId, setOver } = useTreeDnd()
  if (!dragId) return null
  const active = over?.id === null

  return (
    <li
      aria-hidden="true"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (!active) setOver({ id: null, position: "after" })
      }}
      onDragLeave={() => active && setOver(null)}
      onDrop={(e) => {
        e.preventDefault()
        moveNode(dragId, null, "after")
        setDragId(null)
        setOver(null)
      }}
      className={`relative min-h-10 flex-1 ${active ? dropIndicatorClass("before") : ""}`}
    />
  )
}
