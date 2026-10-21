"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookMarked, Folder, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { deleteGroup, flattenTree, plansInSubtree, setGroupKind, useWorkspace, type WorkspaceGroup } from "@/lib/workspace"
import { plansTargetingSubject, usePlans } from "@/lib/plans"
import { deleteNoteText, menuItemClass } from "@/components/page-actions-menu"
import { ConfirmDeleteModal } from "@/components/sidebar/confirm-delete-modal"

export function GroupActionsMenu({
  group,
  triggerClassName,
  onRename,
}: {
  group: WorkspaceGroup
  triggerClassName: string
  // The caller owns the rename UI (inline input in the sidebar row).
  onRename: () => void
}) {
  const plans = usePlans()
  const workspace = useWorkspace()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const isSubject = group.kind === "subject"
  const blockingPlans = isSubject ? plansTargetingSubject(plans, group.id).length : 0
  const nested = flattenTree(workspace, group.id)
  const kindLabel = isSubject ? "과목" : "폴더"

  useEffect(() => {
    if (!open) return
    const handlePointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const handleDelete = () => {
    // Leave the screen first if it shows the group or anything inside it.
    const removed = new Set([group.id, ...nested.map((e) => e.node.id)])
    const [, section, id] = pathname.split("/")
    const onRemoved = (section === "subject" || section === "record") && id !== undefined && removed.has(id)
    if (!deleteGroup(group.id)) return
    if (onRemoved) router.push("/")
  }

  const blockedNote = (action: string) => (
    <div role="menuitem" aria-disabled="true" tabIndex={-1} className="flex items-start gap-2 px-2 py-1.5">
      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs leading-relaxed text-muted-foreground">
        {`이 과목을 대상으로 한 학습 계획이 ${blockingPlans}개 있어서 ${action}. 계획을 먼저 삭제해 주세요.`}
      </span>
    </div>
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${group.name} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${triggerClassName} ${open ? "opacity-100" : ""}`}
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${group.name} 메뉴`}
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          <button
            role="menuitem"
            type="button"
            className={`${menuItemClass} text-foreground`}
            onClick={() => {
              setOpen(false)
              onRename()
            }}
          >
            <Pencil className="size-4 text-muted-foreground" />
            이름 바꾸기
          </button>

          {blockingPlans > 0 ? (
            blockedNote("폴더로 바꿀 수 없어요")
          ) : (
            <button
              role="menuitem"
              type="button"
              className={`${menuItemClass} text-foreground`}
              onClick={() => {
                setOpen(false)
                setGroupKind(group.id, isSubject ? "folder" : "subject")
              }}
            >
              {isSubject ? (
                <Folder className="size-4 text-muted-foreground" />
              ) : (
                <BookMarked className="size-4 text-muted-foreground" />
              )}
              {isSubject ? "폴더로 바꾸기" : "과목으로 바꾸기"}
            </button>
          )}

          <div role="separator" className="my-1 border-t border-border" />
          <button
            role="menuitem"
            type="button"
            className={`${menuItemClass} text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10`}
            onClick={() => {
              setOpen(false)
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
        title={group.name}
        targetLabel={kindLabel}
        note={deleteNoteText(nested.length, plansInSubtree(workspace, group.id).length)}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          handleDelete()
        }}
      />
    </div>
  )
}
