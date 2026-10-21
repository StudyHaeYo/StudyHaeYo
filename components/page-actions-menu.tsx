"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Copy, Lock, MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from "lucide-react"
import { resolvePageLayout } from "@/lib/templates"
import { deletePage, duplicatePage, flattenTree, plansInSubtree, setPageStudyEnabled, useWorkspace } from "@/lib/workspace"
import { ConfirmDeleteModal } from "@/components/sidebar/confirm-delete-modal"

// Confirmation line for deleting a page or group: what else goes with it.
export function deleteNoteText(nestedCount: number, planCount: number) {
  const parts = [
    nestedCount > 0 ? `하위 항목 ${nestedCount}개와 그 학습 기록` : null,
    planCount > 0 ? `이 항목을 대상으로 한 학습 계획 ${planCount}개` : null,
  ].filter(Boolean)
  return parts.length > 0 ? `${parts.join(", ")}도 함께 삭제됩니다.` : undefined
}

export const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"

interface PageActionsMenuProps {
  pageId: string
  title: string
  // The caller owns the rename UI (inline input in the sidebar, title field on the page).
  onRename: () => void
  onDeleted?: () => void
  onOpenChange?: (open: boolean) => void
  showStudyToggle?: boolean
  // Caller-specific items rendered between 복제하기 and the delete separator.
  extraItems?: (close: () => void) => ReactNode
  className?: string
  triggerClassName?: (open: boolean) => string
}

// Shared page actions for the sidebar row and the page header: one behavior, one delete confirmation.
export function PageActionsMenu({
  pageId,
  title,
  onRename,
  onDeleted,
  onOpenChange,
  showStudyToggle = false,
  extraItems,
  className = "",
  triggerClassName,
}: PageActionsMenuProps) {
  const workspace = useWorkspace()
  const [open, setOpenState] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const page = workspace.pages.find((p) => p.id === pageId)
  const nested = flattenTree(workspace, pageId).length
  const planCount = plansInSubtree(workspace, pageId).length
  const deleteNote = deleteNoteText(nested, planCount)
  const layout = page ? resolvePageLayout(page) : null

  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const handlePointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenState(false)
        onOpenChange?.(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenState(false)
        onOpenChange?.(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`${title} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          triggerClassName?.(open) ??
          "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        }
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${title} 메뉴`}
          className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          <button
            role="menuitem"
            type="button"
            className={`${menuItemClass} text-foreground`}
            onClick={() => {
              close()
              onRename()
            }}
          >
            <Pencil className="size-4 text-muted-foreground" />
            이름 바꾸기
          </button>
          <button
            role="menuitem"
            type="button"
            className={`${menuItemClass} text-foreground`}
            onClick={() => {
              close()
              duplicatePage(pageId)
            }}
          >
            <Copy className="size-4 text-muted-foreground" />
            복제하기
          </button>
          {extraItems?.(close)}

          {showStudyToggle &&
            layout &&
            (layout.studyControl === "locked" ? (
              <div role="menuitem" aria-disabled="true" tabIndex={-1} className="flex items-start gap-2 px-2 py-1.5">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs leading-relaxed text-muted-foreground">학습 기능은 항상 켜져 있어요</span>
              </div>
            ) : (
              <button
                role="menuitem"
                type="button"
                className={`${menuItemClass} text-foreground`}
                onClick={() => {
                  close()
                  setPageStudyEnabled(pageId, !layout.studyOn)
                }}
              >
                {layout.studyOn ? (
                  <PowerOff className="size-4 text-muted-foreground" />
                ) : (
                  <Power className="size-4 text-muted-foreground" />
                )}
                {layout.studyOn ? "학습 기능 끄기" : "학습 기능 켜기"}
              </button>
            ))}

          <div role="separator" className="my-1 border-t border-border" />
          <button
            role="menuitem"
            type="button"
            className={`${menuItemClass} text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10`}
            onClick={() => {
              close()
              setConfirmOpen(true)
            }}
          >
            <Trash2 className="size-4" />
            삭제하기
          </button>
        </div>
      )}

      <ConfirmDeleteModal
        open={confirmOpen}
        title={title}
        note={deleteNote}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          if (deletePage(pageId)) onDeleted?.()
        }}
      />
    </div>
  )
}
