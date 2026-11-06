"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { BookMarked, Folder, Home, X } from "lucide-react"
import { canMoveNode, flattenTree, moveNode, useWorkspace } from "@/lib/workspace"
import { useFocusTrap } from "@/hooks/use-focus-trap"

// [옮기기] (D-31): puts a note into another subject or folder, or back to the top, without drag and drop
// (phones have none). Only groups are offered; a note goes under another note by dragging on a computer.
export function MoveDialog({ pageId, title, onClose }: { pageId: string; title: string; onClose: () => void }) {
  const workspace = useWorkspace()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)
  const currentParent = workspace.pages.find((p) => p.id === pageId)?.parentId ?? null

  const targets = [
    { id: null, name: "맨 위 (내 페이지)", kind: "root" as const, depth: 0 },
    ...flattenTree(workspace)
      .filter((e) => e.node.kind !== "page")
      .map((e) => ({ id: e.node.id, name: e.node.name, kind: e.node.kind, depth: e.depth })),
  ].filter((t) => t.id === currentParent || canMoveNode(workspace, pageId, t.id, "inside"))

  // The latest onClose without re-running the effect below (that would move focus on every render).
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    // Start on the current place so the list opens where the note is.
    dialogRef.current?.querySelector<HTMLButtonElement>("[aria-current=true]")?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const move = (target: (typeof targets)[number]) => {
    if (target.id === currentParent) return onClose()
    moveNode(pageId, target.id, "inside")
    // "안으로" reads right after any name (어학으로 / 자료구조로 would need the 조사 picked per word).
    toast.success(target.id ? `${target.name || "제목 없음"} 안으로 옮겼어요` : "맨 위로 옮겼어요")
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-dialog-title"
        className="flex max-h-[80dvh] w-full max-w-sm flex-col rounded-t-2xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-xl sm:pb-0"
      >
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
          <h2 id="move-dialog-title" className="min-w-0 truncate text-sm font-semibold text-foreground">
            {`“${title || "제목 없음"}” 옮기기`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-action-500"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <ul className="overflow-y-auto overscroll-contain px-2 pb-3">
          {targets.map((t) => {
            const here = t.id === currentParent
            const Icon = t.kind === "root" ? Home : t.kind === "subject" ? BookMarked : Folder
            return (
              <li key={t.id ?? "root"}>
                <button
                  type="button"
                  aria-current={here}
                  onClick={() => move(t)}
                  style={{ paddingLeft: `${0.75 + t.depth * 1}rem` }}
                  className={`flex w-full items-center gap-2 rounded-lg py-2.5 pr-3 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action-500 ${
                    here ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {t.kind === "subject" && <span className="shrink-0 text-xs text-muted-foreground">과목</span>}
                  {here && <span className="shrink-0 text-xs text-muted-foreground">지금 위치</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
